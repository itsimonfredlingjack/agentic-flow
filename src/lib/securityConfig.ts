export const DEFAULT_DENY_PROGRAMS = new Set([
  'rm',
  'rmdir',
  'dd',
  'mkfs',
  'shutdown',
  'reboot',
  'poweroff',
  'killall',
  'chmod',
  'chown',
  'sudo',
  // Added per security audit - these bypass other restrictions:
  'env',      // Can execute arbitrary commands: env bash -c 'malicious'
  'ln',       // Can create symlinks to bypass path traversal checks
]);

export const DEFAULT_REQUIRE_PERMISSION_PROGRAMS = new Set([
  // Interpreters / shells - too powerful for free-form input
  'sh',
  'bash',
  'zsh',
  'fish',
  'node',
  'python',
  'python3',
  'deno',
  'ruby',
  'perl',
  // Networking tools (can exfiltrate / fetch)
  'curl',
  'wget',
  'ssh',
  'scp',
  // File modification tools - can overwrite files
  'sed',
  'mv',       // Can move/rename critical files
  'cp',       // Can overwrite existing files
  'find',     // Dangerous with -exec flag
  'xargs',    // Can execute commands with arbitrary args
  'tee',      // Can write to arbitrary files
  'awk',      // Can modify files with -i flag (gawk)
]);

export const SAFE_ALLOW_PROGRAMS = new Set([
  'npm',
  'npx',
  'git',
  'ls',
  'cat',
  'rg',
  'pwd',
  'echo',
]);

// NOTE: 'sed' was removed from SAFE_ALLOW_PROGRAMS because 'sed -i' can modify
// any file in the project without permission. If sed is needed, it now requires
// explicit user permission via DEFAULT_REQUIRE_PERMISSION_PROGRAMS.
