// src/lib/terminal.ts
import { spawn, type ChildProcess } from 'child_process';
import treeKill from 'tree-kill';
import { RuntimeEvent, MessageHeader } from '@/types';

/**
 * Create a sanitized environment for spawned processes.
 * Only includes safe variables needed for command execution.
 * Excludes potentially sensitive variables (API keys, secrets, tokens, etc.)
 */
function createSafeEnv(): Record<string, string | undefined> {
    const env = process.env;
    const safe: Record<string, string | undefined> = {};

    // Essential system variables
    const allowedVars = [
        'PATH',           // Required for command lookup
        'HOME',           // Often needed by tools
        'USER',           // Current user
        'SHELL',          // Default shell info
        'LANG',           // Locale
        'LC_ALL',         // Locale
        'TERM',           // Terminal type
        'TMPDIR',         // Temp directory
        'TMP',            // Temp directory (Windows)
        'TEMP',           // Temp directory (Windows)
        'PWD',            // Current directory
        'EDITOR',         // Default editor
        'XDG_RUNTIME_DIR',// Linux runtime dir
        'XDG_DATA_HOME',  // Linux data home
        'XDG_CONFIG_HOME',// Linux config home
        'XDG_CACHE_HOME', // Linux cache home
    ];

    // Copy only allowed variables
    for (const key of allowedVars) {
        if (env[key] !== undefined) {
            safe[key] = env[key];
        }
    }

    // Add terminal-specific overrides
    safe['FORCE_COLOR'] = 'true';
    safe['TERM'] = 'xterm-256color';

    // Explicitly block sensitive patterns (defense in depth)
    // These should already be excluded, but this makes intent clear
    const sensitivePatterns = ['API_KEY', 'SECRET', 'TOKEN', 'PASSWORD', 'PRIVATE', 'AUTH', 'CREDENTIAL'];
    for (const key of Object.keys(safe)) {
        if (sensitivePatterns.some(pattern => key.toUpperCase().includes(pattern))) {
            delete safe[key];
        }
    }

    return safe;
}

export class TerminalService {
    private activeProcesses = new Map<string, ChildProcess>(); // correlationId -> Process
    private projectRoot = process.cwd(); // Default to current CWD
    private readonly defaultTimeoutMs = 10 * 60 * 1000; // 10 minutes
    private readonly maxOutputBytes = 512 * 1024; // 512KB per stream
    private readonly safeEnv: Record<string, string | undefined>;

    constructor() {
        // Create safe environment once at construction
        this.safeEnv = createSafeEnv();
    }

    public executeParsed(
        header: MessageHeader,
        program: string,
        args: string[],
        onEvent: (e: RuntimeEvent) => void
    ) {
        // Spawn without a shell to avoid shell injection via operators (&&, ;, |, redirects).
        // Use sanitized environment to prevent leaking secrets to child processes.
        const child = spawn(program, args, {
            cwd: this.projectRoot,
            shell: false,
            env: this.safeEnv as NodeJS.ProcessEnv
        });

        // Set up timeout first (will be cleared on error/close)
        const timeoutId = setTimeout(() => {
            this.kill(header.correlationId);
        }, this.defaultTimeoutMs);

        // Handle spawn errors (e.g., command not found, permission denied)
        // This MUST be registered before other handlers to prevent crashes
        child.on('error', (error) => {
            clearTimeout(timeoutId);
            this.activeProcesses.delete(header.correlationId);
            onEvent({
                type: 'WORKFLOW_ERROR',
                header,
                error: `Failed to spawn process '${program}': ${error.message}`,
                severity: 'fatal'
            });
        });

        // Verify we got a valid PID before proceeding
        if (!child.pid) {
            clearTimeout(timeoutId);
            onEvent({
                type: 'WORKFLOW_ERROR',
                header,
                error: `Failed to start process '${program}': No PID assigned`,
                severity: 'fatal'
            });
            return;
        }

        this.activeProcesses.set(header.correlationId, child);

        const renderedCommand = [program, ...args].join(' ');
        onEvent({
            type: 'PROCESS_STARTED',
            header,
            pid: child.pid,
            command: renderedCommand
        });

        // Stream Output
        let stdoutBytes = 0;
        let stderrBytes = 0;

        child.stdout?.on('data', (data) => {
            if (stdoutBytes >= this.maxOutputBytes) return;
            const chunk = data.toString();
            stdoutBytes += Buffer.byteLength(chunk, 'utf8');
            const content = stdoutBytes > this.maxOutputBytes
                ? `${chunk}\n... (stdout truncated)`
                : chunk;
            onEvent({ type: 'STDOUT_CHUNK', header, content });
        });

        child.stderr?.on('data', (data) => {
            if (stderrBytes >= this.maxOutputBytes) return;
            const chunk = data.toString();
            stderrBytes += Buffer.byteLength(chunk, 'utf8');
            const content = stderrBytes > this.maxOutputBytes
                ? `${chunk}\n... (stderr truncated)`
                : chunk;
            onEvent({ type: 'STDERR_CHUNK', header, content });
        });

        // Handle Exit (normal completion)
        child.on('close', (code, signal) => {
            clearTimeout(timeoutId);
            this.activeProcesses.delete(header.correlationId);
            // Use -1 for null exit codes (killed by signal without exit code)
            const exitCode = code ?? (signal ? -1 : 0);
            onEvent({ type: 'PROCESS_EXITED', header, code: exitCode });
        });
    }

    public kill(correlationId: string) {
        const child = this.activeProcesses.get(correlationId);
        if (child && child.pid) {
            const pid = child.pid;
            treeKill(pid, (error) => {
                if (error) {
                    console.warn(`[Terminal] Failed to kill PID ${pid}:`, error.message);
                }
            });
            this.activeProcesses.delete(correlationId);
        }
    }
}
