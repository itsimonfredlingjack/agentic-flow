"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CommandInput, InputMode } from './CommandInput';
import { OutputBlock, BlockType, BlockStatus } from './OutputBlock';
import { ModelSelector, ModelStatus } from './ModelSelector';
import { CommandPalette } from './CommandPalette';
import { RoleSelector, RoleId, RoleState } from './RoleSelector';
import { SessionTimeline } from './SessionTimeline';
import { ExecutionPlan } from './ExecutionPlan';
import { MetricsBar } from './MetricsBar';
import { Command, PanelLeftClose, PanelLeft } from 'lucide-react';
import type { PlanTask, SessionMetrics } from '@/types';

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
  planTasks?: PlanTask[];
  newTaskIds?: Set<string>;
  metrics?: SessionMetrics;
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
}

// Default empty metrics
const DEFAULT_METRICS: SessionMetrics = {
  totalTokens: 0,
  sessionStartTime: Date.now(),
  phases: {
    PLAN: { phase: 'PLAN', startTime: null, endTime: null, elapsedMs: 0, requests: 0, successes: 0, failures: 0 },
    BUILD: { phase: 'BUILD', startTime: null, endTime: null, elapsedMs: 0, requests: 0, successes: 0, failures: 0 },
    REVIEW: { phase: 'REVIEW', startTime: null, endTime: null, elapsedMs: 0, requests: 0, successes: 0, failures: 0 },
    DEPLOY: { phase: 'DEPLOY', startTime: null, endTime: null, elapsedMs: 0, requests: 0, successes: 0, failures: 0 },
  },
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
  planTasks = [],
  newTaskIds = new Set(),
  metrics = DEFAULT_METRICS,
  sessions = [],
  agents = [],
}: TerminalLayoutProps) {
  const [inputMode, setInputMode] = useState<InputMode>('agent');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [timelineVisible, setTimelineVisible] = useState(showTimeline);
  const [metricsCollapsed, setMetricsCollapsed] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [recentItems, setRecentItems] = useState<Array<{
    id: string;
    type: 'shell' | 'agent' | 'nav';
    content: string;
    timestamp: string;
  }>>([]);
  const outputsEndRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

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

  // Auto-scroll to bottom
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

  return (
    <div className="flex h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Session Timeline Sidebar */}
      {timelineVisible && (
        <aside className="w-80 border-r border-[var(--border-subtle)] p-3 flex flex-col gap-3 transition-all duration-300 ease-in-out">
          <SessionTimeline
            currentRole={currentRole}
            roleStates={effectiveRoleStates}
            onSelectRole={onRoleChange}
          />

          {/* Execution Plan Panel */}
          <div className="border-t border-[var(--border-subtle)] pt-3 mt-auto flex-1 overflow-y-auto">
            <ExecutionPlan
              tasks={planTasks}
              newTaskIds={newTaskIds}
            />
          </div>
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            {/* Timeline toggle */}
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

            <h1 className="text-sm font-medium tracking-tight">Agentic Flow</h1>
            <RoleSelector
              currentRole={currentRole}
              roleStates={effectiveRoleStates}
              onSelectRole={onRoleChange}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              className="flex items-center gap-2 px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              onClick={() => setPaletteOpen(true)}
            >
              <Command className="w-3.5 h-3.5" />
              <span>⌘K</span>
            </button>

            <ModelSelector
              currentModel={modelName}
              status={modelStatus}
              onSelectModel={handleModelChange}
            />
          </div>
        </header>

        {/* Output Area */}
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {outputs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-tertiary)]">
              <p className="text-sm">Ready to go</p>
              <p className="text-xs mt-1">
                Type a command below or press <kbd className="px-1 py-0.5 bg-[var(--bg-elevated)] rounded text-[10px]">⌘K</kbd> for options
              </p>
              <p className="text-xs mt-2">
                Press <kbd className="px-1 py-0.5 bg-[var(--bg-elevated)] rounded text-[10px]">TAB</kbd> to switch agents
              </p>
            </div>
          )}

          {outputs.map((output) => (
            <div key={output.id} className={getAgentClass(output.agentRole)}>
              <OutputBlock
                id={output.id}
                type={output.type}
                command={output.command}
                content={output.content}
                status={output.status}
                duration={output.duration}
                timestamp={output.timestamp}
                onCopy={() => {}}
              />
            </div>
          ))}

          <div ref={outputsEndRef} />
        </main>

        {/* Input */}
        <CommandInput
          mode={inputMode}
          onModeToggle={handleModeToggle}
          onSubmit={handleSubmit}
        />

        {/* Metrics Bar (Footer) */}
        <div className="border-t border-[var(--border-subtle)]">
          <MetricsBar
            metrics={metrics}
            isCollapsed={metricsCollapsed}
            onToggleCollapse={() => setMetricsCollapsed(!metricsCollapsed)}
          />
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
        sessions={sessions}
        agents={agents}
        recentItems={recentItems}
        currentSessionId={sessionId}
        currentAgentId={currentRole}
      />
    </div>
  );
}
