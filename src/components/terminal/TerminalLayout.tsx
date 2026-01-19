"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CommandInput, InputMode } from './CommandInput';
import { OutputBlock, BlockType, BlockStatus } from './OutputBlock';
import { ModelSelector, ModelStatus } from './ModelSelector';
import { CommandPalette } from './CommandPalette';
import { ExecutionPlan, ExecutionTask } from "./ExecutionPlan";
import { TokenCounter } from "./TokenCounter";
import { StatusPill } from "./StatusPill";
import { RoleSelector, RoleId, RoleState } from './RoleSelector';
import { SessionTimeline } from './SessionTimeline';
import { Command, PanelLeftClose, PanelLeft, ExternalLink } from 'lucide-react';

export interface OutputItem {
  id: string;
  type: BlockType;
  command: string;
  content: string;
  status: BlockStatus;
  duration?: number;
  timestamp: string;
  agentRole?: RoleId;
}

type LayoutMode = 'focus' | 'inspect' | 'batch';
type InspectorTab = 'inspector' | 'canvas';
type FocusKey = 'output' | 'input' | 'plan';

type InspectorItem = {
  id: string;
  label: string;
  kind: 'patch' | 'snippet';
  content: string;
  language?: string;
  source?: string;
  timestamp?: string;
  filePath?: string;
  fileGroup?: string[];
  status?: BlockStatus;
  role?: RoleId;
};

interface TerminalLayoutProps {
  sessionId: string;
  currentRole: RoleId;
  roleStates?: Record<RoleId, RoleState>;
  onRoleChange: (role: RoleId) => void;
  agentStatus?: 'ready' | 'running' | 'thinking' | 'error';
  modelName?: string;
  outputs?: OutputItem[];
  onExecuteShell: (command: string) => void;
  onExecuteAgent: (prompt: string) => void;
  onModelChange?: (modelId: string) => void;
  onNewSession?: () => void;
  onSelectSession?: (id: string) => void;
  onClear?: () => void;
  onOpenSettings?: () => void;
  showTimeline?: boolean;
  sessions?: Array<{
    id: string;
    timestamp: string;
    agent: string;
    blockCount: number;
    status: 'active' | 'success' | 'warning';
  }>;
  agents?: Array<{
    id: string;
    name: string;
    description: string;
    model: string;
    isActive: boolean;
  }>;
  executionTasks?: ExecutionTask[];
  tokenCounts?: {
    input: number;
    output: number;
    total: number;
  };
  headerActions?: React.ReactNode;
}

const CODE_BLOCK_REGEX = /```([\w-]+)?\n([\s\S]*?)```/g;

const extractCodeBlocks = (content: string) => {
  const blocks: Array<{ language: string; content: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = CODE_BLOCK_REGEX.exec(content)) !== null) {
    const language = match[1] || 'text';
    const blockContent = match[2].trim();
    if (blockContent) {
      blocks.push({ language, content: blockContent });
    }
  }
  return blocks;
};

const hasPatchContent = (content: string) => {
  return /(^diff --git|^\+\+\+ |^--- |^@@ )/m.test(content);
};

const normalizeDiffPath = (value?: string) => {
  if (!value || value === '/dev/null') return undefined;
  return value.replace(/^a\//, '').replace(/^b\//, '');
};

const splitDiffByFile = (content: string) => {
  const lines = content.split('\n');
  const segments: Array<{ filePath?: string; content: string }> = [];
  let current: { filePath?: string; lines: string[] } | null = null;
  let hasHeader = false;

  const pushCurrent = () => {
    if (!current) return;
    const joined = current.lines.join('\n').trim();
    if (joined) {
      segments.push({
        filePath: normalizeDiffPath(current.filePath),
        content: joined,
      });
    }
    current = null;
  };

  for (const line of lines) {
    const headerMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (headerMatch) {
      hasHeader = true;
      pushCurrent();
      current = { filePath: headerMatch[2], lines: [line] };
      continue;
    }

    const plusMatch = line.match(/^\+\+\+ b\/(.+)$/);
    const minusMatch = line.match(/^--- a\/(.+)$/);
    if (!current && (plusMatch || minusMatch)) {
      current = { filePath: plusMatch?.[1] || minusMatch?.[1], lines: [line] };
      continue;
    }

    if (!current) {
      if (!hasPatchContent(content)) {
        continue;
      }
      current = { filePath: undefined, lines: [] };
    }

    current.lines.push(line);
  }

  pushCurrent();

  if (!segments.length && hasPatchContent(content)) {
    return [{ filePath: undefined, content }];
  }

  return segments;
};

export function TerminalLayout({
  sessionId,
  currentRole,
  roleStates,
  onRoleChange,
  agentStatus = 'ready',
  modelName = 'qwen2.5-coder:3b',
  outputs = [],
  onExecuteShell,
  onExecuteAgent,
  onModelChange,
  onNewSession,
  onSelectSession,
  onClear,
  onOpenSettings,
  showTimeline = true,
  sessions = [],
  agents = [],
  executionTasks = [],
  tokenCounts,
  headerActions,
}: TerminalLayoutProps) {
  const [inputMode, setInputMode] = useState<InputMode>('agent');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [timelineVisible, setTimelineVisible] = useState(showTimeline);
  const [mode, setMode] = useState<LayoutMode>('focus');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('inspector');
  const [selectedInspectorId, setSelectedInspectorId] = useState<string | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [recentItems, setRecentItems] = useState<Array<{
    id: string;
    type: 'shell' | 'agent' | 'nav';
    content: string;
    timestamp: string;
  }>>([]);
  const outputsEndRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const planPanelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Default role states if not provided
  const effectiveRoleStates: Record<RoleId, RoleState> = roleStates || {
    PLAN: currentRole === 'PLAN' ? 'active' : 'available',
    BUILD: currentRole === 'BUILD' ? 'active' : 'available',
    REVIEW: currentRole === 'REVIEW' ? 'active' : 'available',
    DEPLOY: currentRole === 'DEPLOY' ? 'active' : 'available',
  };

  // Map agent status to model status
  const modelStatus: ModelStatus =
    agentStatus === 'running' || agentStatus === 'thinking' ? 'loading' :
    agentStatus === 'error' ? 'error' : 'ready';

  // Get last output for auto-scroll triggers
  const lastOutput = outputs[outputs.length - 1];
  const lastOutputContent = lastOutput?.content;
  const lastOutputStatus = lastOutput?.status;

  // Toggle mode
  const handleModeToggle = useCallback(() => {
    setInputMode(prev => prev === 'shell' ? 'agent' : 'shell');
  }, []);

  // Handle command submission
  const handleSubmit = useCallback((value: string, mode: InputMode) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newRecent = {
      id: Date.now().toString(),
      type: mode as 'shell' | 'agent',
      content: value,
      timestamp,
    };
    setRecentItems(prev => [newRecent, ...prev].slice(0, 20));

    // Re-enable auto-scroll when user submits
    setAutoScroll(true);

    if (mode === 'shell') {
      onExecuteShell(value);
    } else {
      onExecuteAgent(value);
    }
  }, [onExecuteShell, onExecuteAgent]);

  // Handle model change
  const handleModelChange = useCallback((modelId: string) => {
    onModelChange?.(modelId);
  }, [onModelChange]);

  // Detect manual scroll to disable auto-scroll
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = main;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setAutoScroll(isAtBottom);
    };

    main.addEventListener('scroll', handleScroll);
    return () => main.removeEventListener('scroll', handleScroll);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K for palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const roleOrder: RoleId[] = ['PLAN', 'BUILD', 'REVIEW', 'DEPLOY'];
        const roleIndex = Number(e.key) - 1;
        const role = roleOrder[roleIndex];
        if (role) {
          onRoleChange(role);
        }
      }
      if (e.altKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setMode(prev => {
          if (prev === 'inspect') return 'focus';
          return 'inspect';
        });
      }
      // Cmd+L for clear
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        onClear?.();
      }
      // Cmd+N for new session
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        onNewSession?.();
      }
      // Cmd+B for toggle timeline
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setTimelineVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClear, onNewSession]);

  // Auto-scroll to bottom when:
  // 1. New outputs appear
  // 2. Content updates during streaming
  // 3. Status changes (running → success/error)
  useEffect(() => {
    if (autoScroll) {
      outputsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [outputs.length, lastOutputContent, lastOutputStatus, autoScroll]);

  // Get agent-specific class for output blocks
  const getAgentClass = (role?: RoleId) => {
    if (!role) return '';
    const classes: Record<RoleId, string> = {
      PLAN: 'output-block--agent-architect',
      BUILD: 'output-block--agent-engineer',
      REVIEW: 'output-block--agent-critic',
      DEPLOY: 'output-block--agent-deployer',
    };
    return classes[role] || '';
  };

  const inspectorItems = useMemo<InspectorItem[]>(() => {
    const items: InspectorItem[] = [];
    outputs.forEach((output) => {
      if (!output.content) return;
      const safeLabel = output.command.length > 36
        ? `${output.command.slice(0, 33)}...`
        : output.command;
      if (hasPatchContent(output.content)) {
        const segments = splitDiffByFile(output.content);
        const fileGroup = segments
          .map((segment) => segment.filePath)
          .filter((value): value is string => Boolean(value));
        if (segments.length > 0) {
          segments.forEach((segment, index) => {
            const label = segment.filePath || safeLabel || 'Patch';
            items.push({
              id: `${output.id}-patch-${index}`,
              label,
              kind: 'patch',
              content: segment.content,
              source: output.type,
              timestamp: output.timestamp,
              filePath: segment.filePath,
              fileGroup: fileGroup.length > 1 ? fileGroup : undefined,
              status: output.status,
              role: output.agentRole,
            });
          });
        } else {
          items.push({
            id: `${output.id}-patch`,
            label: safeLabel || 'Patch',
            kind: 'patch',
            content: output.content,
            source: output.type,
            timestamp: output.timestamp,
            status: output.status,
            role: output.agentRole,
          });
        }
      }
      const blocks = extractCodeBlocks(output.content);
      blocks.forEach((block, index) => {
        items.push({
          id: `${output.id}-code-${index}`,
          label: safeLabel || `Snippet ${index + 1}`,
          kind: 'snippet',
          content: block.content,
          language: block.language,
          source: output.type,
          timestamp: output.timestamp,
          status: output.status,
          role: output.agentRole,
        });
      });
    });
    return items;
  }, [outputs]);

  useEffect(() => {
    if (inspectorItems.length === 0) {
      setSelectedInspectorId(null);
      return;
    }
    setSelectedInspectorId((prev) => {
      if (prev && inspectorItems.some((item) => item.id === prev)) {
        return prev;
      }
      return inspectorItems[0].id;
    });
  }, [inspectorItems]);

  const selectedInspectorItem = inspectorItems.find((item) => item.id === selectedInspectorId) || inspectorItems[0];
  const showRightPanel = mode !== 'focus';
  const showLeftRail = mode !== 'focus' && timelineVisible;
  const activeAgent = agents.find((agent) => agent.id === currentRole);
  const visibleOutputs = outputs.slice(-6);

  const focusTargets = useMemo(() => {
    const targets: Array<FocusKey> = ['output', 'input'];
    if (showLeftRail) {
      targets.push('plan');
    }
    return targets;
  }, [showLeftRail]);

  const focusByKey = useCallback((key: FocusKey) => {
    if (key === 'output') {
      mainRef.current?.focus();
      return;
    }
    if (key === 'input') {
      inputRef.current?.focus();
      return;
    }
    if (key === 'plan') {
      planPanelRef.current?.focus();
    }
  }, []);

  const handleFocusCycle = useCallback((currentKey: FocusKey, direction: 'next' | 'prev') => {
    const order = focusTargets;
    const currentIndex = order.indexOf(currentKey);
    if (currentIndex === -1) return;
    const step = direction === 'next' ? 1 : -1;
    const nextIndex = (currentIndex + step + order.length) % order.length;
    focusByKey(order[nextIndex]);
  }, [focusByKey, focusTargets]);

  const batchResults = outputs.slice(-4).map((output) => ({
    id: output.id,
    label: output.command,
    status: output.status,
  }));

  const roleNames: Record<RoleId, string> = {
    PLAN: 'Architect',
    BUILD: 'Engineer',
    REVIEW: 'Critic',
    DEPLOY: 'Deployer',
  };

  const roleOrder: RoleId[] = ['PLAN', 'BUILD', 'REVIEW', 'DEPLOY'];
  const currentRoleIndex = roleOrder.indexOf(currentRole);
  const nextRole = currentRoleIndex >= 0 && currentRoleIndex < roleOrder.length - 1
    ? roleOrder[currentRoleIndex + 1]
    : roleOrder[0];

  const handleOpenInspector = useCallback(() => {
    setMode('inspect');
    setInspectorTab('inspector');
  }, []);

  const handleToggleInspect = useCallback(() => {
    setMode(prev => (prev === 'inspect' ? 'focus' : 'inspect'));
  }, []);

  const handleShowPlan = useCallback(() => {
    setTimelineVisible(true);
    setMode('inspect');
  }, []);

  const handleExportRunSummary = useCallback(async () => {
    const summary = [
      `# Run Summary (${sessionId})`,
      '',
      `Role: ${roleNames[currentRole]}`,
      `Mode: ${mode}`,
      '',
      '## Latest Output',
      ...visibleOutputs.map((output) => (
        `- **${output.command}** (${output.status})`
      )),
      '',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(summary);
    } catch (err) {
      console.error('Failed to export summary:', err);
    }
  }, [currentRole, mode, roleNames, sessionId, visibleOutputs]);

  const handlePlanSelect = useCallback((task: ExecutionTask) => {
    const query = task.text.toLowerCase();
    const match = [...outputs].reverse().find((output) => output.command.toLowerCase().includes(query));
    if (match) {
      const block = document.querySelector(`[data-block-id="${match.id}"]`);
      if (block instanceof HTMLElement) {
        block.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    mainRef.current?.focus();
  }, [outputs]);

  return (
    <div className="flex h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Session Timeline Sidebar */}
      {showLeftRail && (
        <aside className="hidden lg:flex w-56 border-r border-[var(--border-subtle)] p-3 flex-col gap-3">
          <SessionTimeline
            currentRole={currentRole}
            roleStates={effectiveRoleStates}
            onSelectRole={onRoleChange}
          />
          <div
            ref={planPanelRef}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                handleFocusCycle('plan', e.shiftKey ? 'prev' : 'next');
              }
            }}
          >
            <ExecutionPlan tasks={executionTasks} onSelectTask={handlePlanSelect} />
          </div>
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3 min-w-[260px]">
            <button
              onClick={() => setTimelineVisible(!timelineVisible)}
              className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded transition-colors"
              title="Toggle timeline (⌘B)"
            >
              {timelineVisible ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeft className="w-4 h-4" />
              )}
            </button>

            <div className="flex flex-col">
              <span className="text-sm font-medium tracking-tight">LLM Creative</span>
              <span className="text-xs text-[var(--text-tertiary)]">Session {sessionId}</span>
            </div>

            <RoleSelector
              currentRole={currentRole}
              roleStates={effectiveRoleStates}
              onSelectRole={onRoleChange}
            />
          </div>

          <div className="flex-1 flex justify-center">
            <div className="mode-toggle">
              {(['focus', 'inspect', 'batch'] as LayoutMode[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`mode-toggle__button ${mode === item ? 'mode-toggle__button--active' : ''}`}
                  onClick={() => setMode(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 min-w-[260px] justify-end">
            <button
              type="button"
              className="shortcut-pill shortcut-pill--interactive"
              onClick={() => setPaletteOpen(true)}
              title="Command palette (⌘K)"
            >
              <Command className="w-3.5 h-3.5" />
              <span>⌘K</span>
            </button>
            <div className="shortcut-pill" title="Focus next panel (TAB)">
              TAB
            </div>
            {headerActions}
            <StatusPill
              status={agentStatus}
              agentName={activeAgent?.name}
              modelName={modelName}
              sessionId={sessionId}
            />
            {tokenCounts && (
              <TokenCounter
                inputTokens={tokenCounts.input}
                outputTokens={tokenCounts.output}
                totalTokens={tokenCounts.total}
              />
            )}
            <ModelSelector
              currentModel={modelName}
              status={modelStatus}
              onSelectModel={handleModelChange}
            />
          </div>
        </header>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 px-2 pb-2 pt-3 lg:gap-3 lg:px-3">
          <section className="flex-1 min-w-0 flex flex-col gap-2 lg:gap-3">
            <div className="terminal-panel flex-1 min-h-0">
              <div className="terminal-panel__header">
                <div className="terminal-panel__title-group">
                  <span className="terminal-panel__title">RUN OUTPUT</span>
                  <span className="terminal-panel__subtitle">Artifact container</span>
                </div>
                <span className="terminal-panel__meta">Truth: runtime</span>
              </div>

              <div
                ref={mainRef}
                className="terminal-panel__body space-y-3"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    handleFocusCycle('output', e.shiftKey ? 'prev' : 'next');
                  }
                }}
              >
                {visibleOutputs.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-[var(--text-tertiary)]">
                    <p className="text-sm">Ready to run</p>
                    <p className="text-xs mt-1">
                      Type a command below or press <kbd className="px-1 py-0.5 bg-[var(--bg-elevated)] rounded text-[10px]">⌘K</kbd> for options
                    </p>
                    <p className="text-xs mt-2">
                      Use <kbd className="px-1 py-0.5 bg-[var(--bg-elevated)] rounded text-[10px]">TAB</kbd> to shift focus
                    </p>
                  </div>
                )}

                {visibleOutputs.map((output) => (
                  <div key={output.id} className={getAgentClass(output.agentRole)}>
                    <OutputBlock
                      id={output.id}
                      type={output.type}
                      command={output.command}
                      content={output.content}
                      status={output.status}
                      duration={output.duration}
                      timestamp={output.timestamp}
                      agentRole={output.agentRole}
                      agentLabel={output.agentRole ? roleNames[output.agentRole] : undefined}
                      onCopy={() => {}}
                      onApply={output.type === 'agent' ? () => {} : undefined}
                    />
                  </div>
                ))}

                <div ref={outputsEndRef} />
              </div>
            </div>

            <CommandInput
              mode={inputMode}
              onModeToggle={handleModeToggle}
              onSubmit={handleSubmit}
              disabled={agentStatus === 'running' || agentStatus === 'thinking'}
              onFocusCycle={(direction) => handleFocusCycle('input', direction)}
              inputRef={inputRef}
            />
          </section>

          {showRightPanel && (
            <aside className="w-full lg:w-[360px] xl:w-[420px] flex flex-col gap-3">
              {mode === 'inspect' ? (
                <div className="terminal-panel flex-1 min-h-0">
                  <div className="terminal-panel__header">
                    <div className="terminal-panel__title-group">
                      <span className="terminal-panel__title">SOURCE INSPECTOR</span>
                      <span className="terminal-panel__subtitle">Truth: code</span>
                    </div>
                    <div className="panel-tabs">
                      <button
                        type="button"
                        className={`panel-tab ${inspectorTab === 'inspector' ? 'panel-tab--active' : ''}`}
                        onClick={() => setInspectorTab('inspector')}
                      >
                        Inspector
                      </button>
                      <button
                        type="button"
                        className={`panel-tab ${inspectorTab === 'canvas' ? 'panel-tab--active' : ''}`}
                        onClick={() => setInspectorTab('canvas')}
                      >
                        Canvas
                      </button>
                    </div>
                  </div>

                  <div className="terminal-panel__body space-y-4">
                      {inspectorTab === 'inspector' ? (
                      <>
                        <div>
                          <div className="panel-section__title">Sources</div>
                          {inspectorItems.length === 0 ? (
                            <div className="panel-empty">
                              No patches or code artifacts yet.
                            </div>
                          ) : (
                            <div className="inspector-list">
                              {inspectorItems.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  className={`inspector-item ${item.id === selectedInspectorId ? 'inspector-item--active' : ''}`}
                                  onClick={() => setSelectedInspectorId(item.id)}
                                >
                                  <span className="inspector-item__label">{item.label}</span>
                                  <span className="inspector-item__meta">
                                    {[
                                      item.kind,
                                      item.role ? roleNames[item.role] : null,
                                      item.status,
                                      item.language && item.kind === 'snippet' ? item.language : null,
                                    ].filter(Boolean).join(' • ')}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="panel-section__title panel-section__title--row">
                            <span>Patch / Diff</span>
                            {selectedInspectorItem?.kind === 'patch' && (
                              <button
                                type="button"
                                className="panel-action"
                                onClick={() => setDiffOpen(true)}
                              >
                                Open Diff
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          {selectedInspectorItem ? (
                            <div className="inspector-code">
                              <SyntaxHighlighter
                                language={selectedInspectorItem.kind === 'patch' ? 'diff' : selectedInspectorItem.language}
                                style={vscDarkPlus}
                                customStyle={{
                                  margin: 0,
                                  background: 'transparent',
                                  fontSize: '0.72rem',
                                  lineHeight: '1.5',
                                }}
                              >
                                {selectedInspectorItem.content}
                              </SyntaxHighlighter>
                            </div>
                          ) : (
                            <div className="panel-empty">
                              Select a source artifact to inspect.
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="panel-section__title">Metadata</div>
                          {selectedInspectorItem ? (
                            <div className="panel-metadata">
                              <div className="panel-metadata__row">
                                <span>Type</span>
                                <span>{selectedInspectorItem.kind}</span>
                              </div>
                              <div className="panel-metadata__row">
                                <span>File</span>
                                <span>{selectedInspectorItem.filePath || '—'}</span>
                              </div>
                              {selectedInspectorItem.fileGroup && (
                                <div className="panel-metadata__row">
                                  <span>Patch Set</span>
                                  <span>{selectedInspectorItem.fileGroup.length} files</span>
                                </div>
                              )}
                              <div className="panel-metadata__row">
                                <span>Role</span>
                                <span>{selectedInspectorItem.role ? roleNames[selectedInspectorItem.role] : '—'}</span>
                              </div>
                              <div className="panel-metadata__row">
                                <span>Status</span>
                                <span>{selectedInspectorItem.status || '—'}</span>
                              </div>
                              <div className="panel-metadata__row">
                                <span>Source</span>
                                <span>{selectedInspectorItem.source || 'unknown'}</span>
                              </div>
                              <div className="panel-metadata__row">
                                <span>Time</span>
                                <span>{selectedInspectorItem.timestamp || '—'}</span>
                              </div>
                              {selectedInspectorItem.language && selectedInspectorItem.kind === 'snippet' && (
                                <div className="panel-metadata__row">
                                  <span>Language</span>
                                  <span>{selectedInspectorItem.language}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="panel-empty">
                              Metadata will appear once a source is selected.
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="panel-canvas">
                        <div className="panel-section__title">Code Canvas</div>
                        <div className="panel-empty">
                          Drag code blocks from RUN OUTPUT into a visual canvas.
                        </div>
                        <div className="panel-canvas__hint">
                          Canvas is read-only in this view. Use the full canvas for layout work.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="terminal-panel flex-1 min-h-0">
                  <div className="terminal-panel__header">
                    <div className="terminal-panel__title-group">
                      <span className="terminal-panel__title">QUEUE / RESULTS</span>
                      <span className="terminal-panel__subtitle">Batch runs</span>
                    </div>
                    <span className="terminal-panel__meta">Truth: execution</span>
                  </div>

                  <div className="terminal-panel__body space-y-4">
                    <div>
                      <div className="panel-section__title">Queue</div>
                      {executionTasks.length === 0 ? (
                        <div className="panel-empty">Queue is idle.</div>
                      ) : (
                        <div className="batch-list">
                          {executionTasks.map((task) => (
                            <div key={task.id} className="batch-item">
                              <span className="batch-item__label">{task.text}</span>
                              <span className={`batch-item__status batch-item__status--${task.status}`}>
                                {task.status.replace('-', ' ')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="panel-section__title">Results</div>
                      {batchResults.length === 0 ? (
                        <div className="panel-empty">No results yet.</div>
                      ) : (
                        <div className="batch-list">
                          {batchResults.map((result) => (
                            <div key={result.id} className="batch-item batch-item--result">
                              <span className="batch-item__label">{result.label}</span>
                              <span className={`batch-item__status batch-item__status--${result.status}`}>
                                {result.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onExecuteShell={(cmd) => {
          setInputMode('shell');
          handleSubmit(cmd, 'shell');
        }}
        onExecuteAgent={(prompt) => {
          setInputMode('agent');
          handleSubmit(prompt, 'agent');
        }}
        onNewSession={onNewSession}
        onSelectSession={onSelectSession}
        onSelectAgent={(id) => onRoleChange(id as RoleId)}
        onClear={onClear}
        onOpenSettings={onOpenSettings}
        onOpenInspector={handleOpenInspector}
        onToggleInspect={handleToggleInspect}
        onShowPlan={handleShowPlan}
        onExportRunSummary={handleExportRunSummary}
        onRunNextPhase={() => onRoleChange(nextRole)}
        nextRoleLabel={roleNames[nextRole]}
        sessions={sessions}
        agents={agents}
        recentItems={recentItems}
        currentSessionId={sessionId}
        currentAgentId={currentRole}
      />

      {diffOpen && selectedInspectorItem && (
        <div className="diff-modal-overlay" onClick={() => setDiffOpen(false)}>
          <div className="diff-modal" onClick={(e) => e.stopPropagation()}>
            <div className="diff-modal__header">
              <div className="diff-modal__title-group">
                <span className="diff-modal__title">Open Diff</span>
                <span className="diff-modal__subtitle">{selectedInspectorItem.label}</span>
              </div>
              <button type="button" className="diff-modal__close" onClick={() => setDiffOpen(false)}>
                Close
              </button>
            </div>
            <div className="diff-modal__body">
              <SyntaxHighlighter
                language={selectedInspectorItem.kind === 'patch' ? 'diff' : selectedInspectorItem.language}
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  background: 'transparent',
                  fontSize: '0.78rem',
                  lineHeight: '1.5',
                }}
              >
                {selectedInspectorItem.content}
              </SyntaxHighlighter>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
