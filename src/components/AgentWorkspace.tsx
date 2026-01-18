"use client";

import React, { useMemo, useRef, useEffect, useReducer } from 'react';
import type { ActionCardProps, OllamaChatMessage, AgentIntent, RuntimeEvent } from '@/types';
import type { RoleId } from '@/lib/roles';
import { ROLES } from '@/lib/roles';
import { AgentControls } from './AgentControls';
import { useAgencyClient } from '@/lib/client';
import { ShadowTerminal } from './ShadowTerminal';

// Smart Context System
import {
    SessionContext,
    createSessionContext,
    buildPhasePrompt,
    storePhaseOutput,
    addError,
    setUserRequest,
    getContextSummary
} from '@/lib/contextProvider';

// Refactored Sub-Components
import { WorkspaceInput } from './WorkspaceInput';
import { WorkspaceHeader } from './WorkspaceHeader';
import { ASCII_LOGOS } from '@/lib/ascii';

// Helper to cap chat history: keep system prompt + last 20 non-system messages
const capChatHistory = (history: OllamaChatMessage[]): OllamaChatMessage[] => {
    if (history.length === 0) return history;
    const nonSystem = history.slice(1);
    const cappedNonSystem = nonSystem.slice(-20);
    return [history[0], ...cappedNonSystem];
};

// Auto-detect and wrap code in markdown fences if not already wrapped
const ensureCodeFencing = (content: string): string => {
    if (/```[\w]*\n/.test(content)) return content;

    const codePatterns = [
        /^(function|const|let|var|class|import|export|interface|type)\s+\w+/m,
        /^(def|class|import|from|async def)\s+\w+/m,
        /^\s*(if|for|while|switch|try)\s*\(/m,
        /=>\s*{/,
        /\(\)\s*{/,
        /^<[A-Z]\w+/m, // JSX/TSX component
        /^\s*return\s+/m,
        /\w+\.\w+\(/,  // method calls
    ];

    const looksLikeCode = codePatterns.some(pattern => pattern.test(content));
    const hasMultipleLines = content.split('\n').length > 3;
    const hasIndentation = /^\s{2,}/m.test(content);

    if (looksLikeCode && (hasMultipleLines || hasIndentation)) {
        let lang = 'typescript'; // default
        if (/^(def|class|import|from)\s+/m.test(content) && !/^(import|export)\s+.*from/m.test(content)) {
            lang = 'python';
        } else if (/^$\s|^npm\s|^yarn\s|^git\s/m.test(content)) {
            lang = 'bash';
        } else if (/<[A-Z]\w+/.test(content) || /className=/.test(content)) {
            lang = 'tsx';
        }

        return '```' + lang + '\n' + content.trim() + '\n```';
    }

    return content;
};

type ExecCmdIntent = Omit<Extract<AgentIntent, { type: 'INTENT_EXEC_CMD' }>, 'header'>;
type OllamaChatIntent = Omit<Extract<AgentIntent, { type: 'INTENT_OLLAMA_CHAT' }>, 'header'>;

// Extend base types for hybrid stream
export interface StreamItem extends ActionCardProps {
    isUser?: boolean;
    isTyping?: boolean;
    payload?: Record<string, unknown>;
}

type Phase = 'plan' | 'build' | 'review' | 'deploy';

interface AgentWorkspaceProps {
    runId: string;
    currentPhase: Phase;
    stream: StreamItem[];
    onSendMessage: (message: string) => void;
}

const phaseToRole = (phase: Phase): RoleId => phase.toUpperCase() as RoleId;

// Reducer Actions
type StreamAction =
    | { type: 'RESET' }
    | { type: 'HYDRATE'; stream: StreamItem[] }
    | { type: 'ADD_ITEM'; item: StreamItem }
    | { type: 'PROCESS_EVENT'; event: RuntimeEvent; runId: string; currentPhase: string };

// Reducer Function
function streamReducer(state: StreamItem[], action: StreamAction): StreamItem[] {
    switch (action.type) {
        case 'RESET':
            return [];
        case 'HYDRATE':
            return action.stream;
        case 'ADD_ITEM':
            return [...state, action.item];
        case 'PROCESS_EVENT': {
            const { event, runId, currentPhase } = action;

            if (event.type === 'OLLAMA_BIT') return state;

            const correlationId = event.header.correlationId;
            const typingId = `typing-${correlationId}`;

            const baseItem: StreamItem = {
                id: `evt-${Date.now()}-${Math.random()}`,
                runId: event.header.sessionId,
                timestamp: new Date(event.header.timestamp).toLocaleTimeString(),
                phase: currentPhase,
                title: 'System Event',
                content: '',
                type: 'log',
                severity: 'info',
                agentId: 'SYSTEM'
            };

            switch (event.type) {
                case 'STDOUT_CHUNK':
                    // Group consecutive STDOUTs into a command block if possible?
                    // For now, simpler to treat each chunk as append target or separate block?
                    // Current simplified approach: Just render text.
                    // Ideally we'd buffer this into a `CommandBlock` state.
                    // BUT: We want rich blocks.
                    // Let's see if we can find the "Active Command Block"
                    // Or just render text for now, but wrapped?
                    // ACTUALLY: We introduced 'command_block' type.
                    // Let's use it.
                    // But wait, STDOUT comes *after* PROCESS_STARTED.
                    // We need to update the EXISTING process_started block or append?
                    // Complex reducers are hard in one shot.
                    // Fallback: Just emit text for now, but mark it as 'log'.
                    // Or better: Let's emit a 'command_block' if it's significant output?
                    // No, 'command_block' should ideally wrap the command execution.
                    // Let's stick to the previous pattern for STDOUT for now (text), 
                    // but we can upgrade 'PROCESS_STARTED' to be a 'command_block'.
                    return [...state, { ...baseItem, type: 'log', title: 'STDOUT', content: event.content }];

                case 'STDERR_CHUNK':
                    return [...state, { ...baseItem, type: 'error', title: 'STDERR', content: event.content, severity: 'error' }];

                case 'PROCESS_STARTED':
                    // Convert PROCESS_STARTED into a CommandBlock
                    return [...state, {
                        ...baseItem,
                        type: 'command_block', // USE NEW TYPE
                        title: 'Executing...', 
                        content: event.command,
                        payload: { isRunning: true, output: '' }
                    }];

                case 'PROCESS_EXITED':
                    // Find the last command block and mark it done? 
                    // In a simple reducer without ID tracking, we append.
                    // To be perfect, we'd find the item with same PID/CorrelationID and update it.
                    // For now, just append an exit log.
                    return [...state, { ...baseItem, type: 'log', title: 'Process Exited', content: `Exit Code: ${event.code}` }];

                case 'PERMISSION_REQUESTED':
                    return [...state, {
                        ...baseItem,
                        type: 'security_gate',
                        title: 'Permission Required',
                        content: `Command: ${event.command}`,
                        payload: { requestId: event.requestId, command: event.command, riskLevel: event.riskLevel }
                    }];

                case 'WORKFLOW_ERROR':
                    return [...state, {
                        ...baseItem,
                        type: 'error',
                        title: 'Workflow Error',
                        content: event.error,
                        severity: event.severity === 'fatal' ? 'error' : 'warn'
                    }];

                case 'OLLAMA_CHAT_STARTED': {
                    const withoutTyping = state.filter((x) => x.id !== typingId);
                    const typingItem: StreamItem = {
                        id: typingId,
                        runId,
                        type: 'log', // or agent message with isTyping
                        title: 'Qwen',
                        content: '',
                        timestamp: new Date(event.header.timestamp).toLocaleTimeString(),
                        phase: currentPhase,
                        agentId: 'QWEN',
                        severity: 'info',
                        isTyping: true,
                    };
                    return [...withoutTyping, typingItem];
                }

                case 'OLLAMA_CHAT_COMPLETED': {
                    const rawContent = event.response.message.content;
                    const processedContent = ensureCodeFencing(rawContent);
                    const item: StreamItem = {
                        ...baseItem,
                        type: 'code', // Will be rendered by AgentMessageCard
                        title: 'Qwen',
                        content: processedContent,
                        agentId: 'QWEN'
                    };

                    const withoutTyping = state.filter((x) => x.id !== typingId);
                    return [...withoutTyping, item];
                }

                case 'OLLAMA_CHAT_FAILED':
                    return [...(state.filter(x => x.id !== typingId)), {
                        ...baseItem,
                        type: 'error',
                        title: 'Ollama Chat Failed',
                        content: event.error,
                        severity: 'error'
                    }];

                case 'OLLAMA_ERROR':
                    return [...(state.filter(x => x.id !== typingId)), {
                        ...baseItem,
                        type: 'error',
                        title: 'Ollama Error',
                        content: event.error,
                        severity: 'error'
                    }];

                case 'SYS_READY':
                    return [...state, {
                        ...baseItem,
                        type: 'log',
                        title: 'System Ready',
                        content: `${ASCII_LOGOS.SYSTEM}\nSystem initialized and ready.`
                    }];

                default:
                    return state;
            }
        }
        default:
            return state;
    }
}

export function AgentWorkspace({ runId, currentPhase, stream: initialStream, onSendMessage }: AgentWorkspaceProps) {
    const [localStream, dispatch] = useReducer(streamReducer, initialStream);

    const activeRole = phaseToRole(currentPhase);

    // Smart Context System - session context persists across phase transitions
    const initialSessionContext = useMemo(() => createSessionContext(), []);
    const sessionContextRef = useRef<SessionContext>(initialSessionContext);

    const chatHistoryRef = useRef<OllamaChatMessage[]>([
        { role: 'system', content: buildPhasePrompt(activeRole, initialSessionContext) }
    ]);
    const hasHydratedStream = useRef(false);
    const prevRunIdRef = useRef(runId);
    const prevPhaseRef = useRef(currentPhase);

    const { lastEvent, client } = useAgencyClient(runId);

    // Sync activeRole with currentPhase and update system prompt
    useEffect(() => {
        if (prevPhaseRef.current === currentPhase) return;
        const oldPhase = prevPhaseRef.current;
        prevPhaseRef.current = currentPhase;
        const newRole = phaseToRole(currentPhase);

        // Add SEMANTIC PHASE CARD
        const transitionMarker: StreamItem = {
            id: `phase-transition-${Date.now()}`,
            runId,
            type: 'phase_transition', // NEW TYPE
            title: `PHASE: ${currentPhase.toUpperCase()}`,
            content: `Switched from ${oldPhase.toUpperCase()} to ${currentPhase.toUpperCase()}`,
            timestamp: new Date().toLocaleTimeString(),
            phase: currentPhase,
            agentId: 'SYSTEM',
            severity: 'info'
        };
        dispatch({ type: 'ADD_ITEM', item: transitionMarker });

        // Update system prompt with new phase context
        const newPrompt = buildPhasePrompt(newRole, sessionContextRef.current);
        const nonSystem = chatHistoryRef.current.slice(1);
        chatHistoryRef.current = capChatHistory([{ role: 'system', content: newPrompt }, ...nonSystem]);

        console.log(`[SmartContext] Phase transition: ${oldPhase} → ${currentPhase}`);
    }, [currentPhase, runId]);

    // Reset local state when run changes
    useEffect(() => {
        if (prevRunIdRef.current === runId) return;
        prevRunIdRef.current = runId;
        hasHydratedStream.current = false;

        sessionContextRef.current = createSessionContext();

        dispatch({ type: 'RESET' });
        const freshPrompt = buildPhasePrompt(activeRole, sessionContextRef.current);
        chatHistoryRef.current = [{ role: 'system', content: freshPrompt }];

    }, [runId, activeRole]);

    // Hydrate stream once per run
    useEffect(() => {
        if (hasHydratedStream.current) return;
        if (initialStream.length === 0) return;
        hasHydratedStream.current = true;

        const currentPrompt = buildPhasePrompt(activeRole, sessionContextRef.current);
        const reconstructedHistory: OllamaChatMessage[] = [{ role: 'system', content: currentPrompt }];
        initialStream.forEach(item => {
            if (item.type === 'log' && item.title === 'User Prompt') {
                reconstructedHistory.push({ role: 'user', content: item.content });
            } else if (item.type === 'code' && item.agentId === 'QWEN') {
                reconstructedHistory.push({ role: 'assistant', content: item.content });
            }
        });

        chatHistoryRef.current = capChatHistory(reconstructedHistory);
        dispatch({ type: 'HYDRATE', stream: initialStream });
    }, [initialStream, activeRole]);

    // Handle Real-time Events
    useEffect(() => {
        if (!lastEvent) return;

        if (lastEvent.type === 'STDERR_CHUNK') {
             addError(sessionContextRef.current, `STDERR: ${lastEvent.content.slice(0, 200)}`);
        } else if (lastEvent.type === 'WORKFLOW_ERROR') {
             addError(sessionContextRef.current, `Workflow: ${lastEvent.error.slice(0, 200)}`);
        } else if (lastEvent.type === 'OLLAMA_CHAT_COMPLETED') {
             const rawContent = lastEvent.response.message.content;
             storePhaseOutput(sessionContextRef.current, activeRole, rawContent);
             chatHistoryRef.current = capChatHistory([
                 ...chatHistoryRef.current,
                 { role: 'assistant', content: rawContent }
             ]);
        }

        dispatch({ type: 'PROCESS_EVENT', event: lastEvent, runId, currentPhase });

    }, [lastEvent, currentPhase, runId, activeRole]);

    const appendSystemLog = (title: string, content: string, severity: 'info' | 'warn' | 'error' = 'info') => {
        const item: StreamItem = {
            id: `sys-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            runId,
            type: severity === 'error' ? 'error' : 'log',
            title,
            content,
            timestamp: new Date().toLocaleTimeString(),
            phase: currentPhase,
            agentId: 'SYSTEM',
            severity
        };
        dispatch({ type: 'ADD_ITEM', item });
    };

    const handleSystemCommand = async (command: string, payload: string) => {
        const trimmedPayload = payload.trim();
        switch (command) {
            case 'help': {
                appendSystemLog('Omnibar Help', 'Commands: /help, /models, /clear, /resume, /context');
                return;
            }
            case 'clear': {
                dispatch({ type: 'RESET' });
                return;
            }
            default:
                appendSystemLog('Command', `Unknown command: /${command}`, 'warn');
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleSendMessage = async (parsed: any) => {
        const agentPrefix = parsed.agentTarget ? `[${parsed.agentTarget.label}] ` : '';
        const payload = `${agentPrefix}${parsed.payload}`;
        const title = parsed.macro
            ? `Macro ${parsed.macro.label}`
            : parsed.mode === 'chat'
                ? 'User Prompt'
                : 'User Command';

        if (parsed.mode === 'chat') {
            setUserRequest(sessionContextRef.current, payload);
        }

        const userMsg: StreamItem = {
            id: Date.now().toString(),
            runId,
            type: 'log',
            title,
            content: payload,
            timestamp: new Date().toLocaleTimeString(),
            phase: currentPhase,
            agentId: 'USER',
            severity: 'info',
            isUser: true // Mark as User for AgentMessageCard
        };
        dispatch({ type: 'ADD_ITEM', item: userMsg });

        if (parsed.mode === 'chat') {
            const nextHistory = capChatHistory([
                ...chatHistoryRef.current,
                { role: 'user', content: payload }
            ]);
            chatHistoryRef.current = nextHistory;

            if (client) {
                const intent: OllamaChatIntent = {
                    type: 'INTENT_OLLAMA_CHAT',
                    messages: nextHistory,
                    model: ROLES[activeRole].model,
                    options: { temperature: 0.2 }
                };
                try {
                    await client.send(intent);
                } catch (error) {
                    dispatch({ type: 'ADD_ITEM', item: { id: `err-${Date.now()}`, runId, type: 'error', title: 'Error', content: String(error), timestamp: '', phase: currentPhase, severity: 'error' }}
                    );
                }
            }
        } else {
            if (client) {
                const intent: ExecCmdIntent = {
                    type: 'INTENT_EXEC_CMD',
                    command: payload
                };
                try {
                    await client.send(intent);
                } catch (error) {
                    dispatch({ type: 'ADD_ITEM', item: { id: `err-${Date.now()}`, runId, type: 'error', title: 'Error', content: String(error), timestamp: '', phase: currentPhase, severity: 'error' }}
                    );
                }
            } else {
                onSendMessage(payload);
            }
        }
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
                e.preventDefault();
                dispatch({ type: 'RESET' });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const config = useMemo(() => {
        switch (currentPhase) {
            case 'plan': return { accent: 'text-[var(--sapphire)]', placeholder: 'Describe your vision or ask for blueprint changes...' };
            case 'build': return { accent: 'text-[var(--emerald)]', placeholder: 'Enter build command, debugging query, or /llm prompt...' };
            case 'review': return { accent: 'text-[var(--amber)]', placeholder: 'Ask about security risks or approve changes...' };
            default: return { accent: 'text-[var(--amethyst)]', placeholder: 'Command deployment...' };
        }
    }, [currentPhase]);

    return (
        <div className="flex flex-col h-full relative overflow-hidden bg-transparent rounded-sm group font-mono">

            <WorkspaceHeader
                currentPhase={currentPhase}
                isConnected={!!client}
                isProcessing={localStream.some(s => s.isTyping)}
            />

            {/* Stream Area */}
            <div className="flex-1 overflow-hidden relative">
                <ShadowTerminal
                    actions={localStream}
                    splitView={currentPhase === 'build'}
                    onApprovePermission={(requestId) => {
                        appendSystemLog('Permission', `Approved: ${requestId}`);
                        void client.send({ type: 'INTENT_GRANT_PERMISSION', requestId });
                    }}
                    onDenyPermission={(requestId) => {
                        appendSystemLog('Permission', `Denied: ${requestId}`, 'warn');
                        void client.send({ type: 'INTENT_DENY_PERMISSION', requestId });
                    }}
                />
            </div>

            <AgentControls phase={currentPhase} />

            <WorkspaceInput
                currentPhase={currentPhase}
                config={config}
                onSend={handleSendMessage}
                onSystemCommand={handleSystemCommand}
            />
        </div>
    );
}
