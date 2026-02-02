"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, ChevronLeft, Settings, Plus, FileText, Terminal, Users, Clock, Zap } from 'lucide-react';

type ViewType = 'main' | 'sessions' | 'agents' | 'history';

interface Session {
  id: string;
  timestamp: string;
  agent: string;
  blockCount: number;
  status: 'active' | 'success' | 'warning';
}

interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  isActive: boolean;
}

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string;
  icon?: React.ReactNode;
  action: () => void;
}

interface RecentItem {
  id: string;
  type: 'shell' | 'agent' | 'nav';
  content: string;
  timestamp: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  initialView?: ViewType;
  onClose: () => void;
  onExecuteShell: (command: string) => void;
  onExecuteAgent: (prompt: string) => void;
  onSelectSession?: (sessionId: string) => void;
  onSelectAgent?: (agentId: string) => void;
  onNewSession?: () => void;
  onOpenSettings?: () => void;
  onClear?: () => void;
  onOpenInspector?: () => void;
  onToggleInspect?: () => void;
  onShowPlan?: () => void;
  onExportRunSummary?: () => void;
  onRunNextPhase?: () => void;
  sessions?: Session[];
  agents?: Agent[];
  recentItems?: RecentItem[];
  currentSessionId?: string;
  currentAgentId?: string;
  nextRoleLabel?: string;
}

export function CommandPalette({
  isOpen,
  initialView,
  onClose,
  onExecuteShell,
  onExecuteAgent,
  onSelectSession,
  onSelectAgent,
  onNewSession,
  onOpenSettings,
  onClear,
  onOpenInspector,
  onToggleInspect,
  onShowPlan,
  onExportRunSummary,
  onRunNextPhase,
  sessions = [],
  agents = [],
  recentItems = [],
  currentSessionId,
  currentAgentId,
  nextRoleLabel,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewType>('main');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setView(initialView ?? 'main');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialView]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        if (view !== 'main') {
          setView('main');
          setQuery('');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, view, onClose]);

  // Determine if query is a command
  const queryMode = useMemo(() => {
    if (query.startsWith('> ')) return 'shell';
    if (query.startsWith('@ ')) return 'agent';
    return 'search';
  }, [query]);

  const navigationCommands: CommandItem[] = useMemo(() => [
    { id: 'sessions', label: 'Sessions', hint: 'List & switch runs', shortcut: '⌘⇧S', icon: <Clock className="w-4 h-4" />, action: () => setView('sessions') },
    { id: 'agents', label: 'Agents', hint: 'Switch role', shortcut: '⌘⇧R', icon: <Users className="w-4 h-4" />, action: () => setView('agents') },
    { id: 'history', label: 'History', hint: 'Full command history', shortcut: '⌘Y', icon: <Terminal className="w-4 h-4" />, action: () => setView('history') },
  ], []);

  const engineerLabel = agents.find((agent) => agent.id === 'BUILD')?.name || 'Engineer';
  const primaryCommands: CommandItem[] = useMemo(() => [
    { id: 'switch-engineer', label: `switch role: ${engineerLabel}`, shortcut: '⌘2', action: () => { onSelectAgent?.('BUILD'); onClose(); } },
    { id: 'next-phase', label: `run: next phase (${nextRoleLabel || 'Next'})`, action: () => { onRunNextPhase?.(); onClose(); } },
    { id: 'open-inspector', label: 'open: Source Inspector', action: () => { onOpenInspector?.(); onClose(); } },
    { id: 'toggle-mode', label: 'toggle: Focus / Inspect Mode', shortcut: '⌥I', action: () => { onToggleInspect?.(); onClose(); } },
    { id: 'show-plan', label: 'show: Execution Plan', action: () => { onShowPlan?.(); onClose(); } },
    { id: 'export-summary', label: 'export: Run Summary (markdown)', action: () => { onExportRunSummary?.(); onClose(); } },
  ], [engineerLabel, nextRoleLabel, onClose, onExportRunSummary, onOpenInspector, onRunNextPhase, onSelectAgent, onShowPlan, onToggleInspect]);

  const actionCommands: CommandItem[] = useMemo(() => [
    { id: 'new', label: 'New Session', shortcut: '⌘N', icon: <Plus className="w-4 h-4" />, action: () => { onNewSession?.(); onClose(); } },
    { id: 'clear', label: 'Clear Output', shortcut: '⌘L', icon: <Zap className="w-4 h-4" />, action: () => { onClear?.(); onClose(); } },
    { id: 'export-md', label: 'Export Markdown', hint: 'Session as .md', icon: <FileText className="w-4 h-4" />, action: () => onClose() },
    { id: 'settings', label: 'Settings', shortcut: '⌘,', icon: <Settings className="w-4 h-4" />, action: () => { onOpenSettings?.(); onClose(); } },
  ], [onClose, onNewSession, onOpenSettings, onClear]);

  // Filter items based on query
  const filteredRecent = useMemo(() => {
    if (queryMode !== 'search' || !query) return recentItems.slice(0, 3);
    const q = query.toLowerCase();
    return recentItems.filter(item => 
      item.content.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [recentItems, query, queryMode]);

  const filteredHistory = useMemo(() => {
    if (!query) return recentItems;
    const q = query.toLowerCase();
    return recentItems.filter(item => item.content.toLowerCase().includes(q));
  }, [recentItems, query]);

  const filteredPrimary = useMemo(() => {
    if (queryMode !== 'search') return [];
    if (!query) return primaryCommands;
    const q = query.toLowerCase();
    return primaryCommands.filter(cmd =>
      cmd.label.toLowerCase().includes(q) || cmd.hint?.toLowerCase().includes(q)
    );
  }, [primaryCommands, query, queryMode]);

  const filteredNav = useMemo(() => {
    if (queryMode !== 'search') return [];
    if (!query) return navigationCommands;
    const q = query.toLowerCase();
    return navigationCommands.filter(cmd => 
      cmd.label.toLowerCase().includes(q) || cmd.hint?.toLowerCase().includes(q)
    );
  }, [navigationCommands, query, queryMode]);

  const filteredActions = useMemo(() => {
    if (queryMode !== 'search') return [];
    if (!query) return actionCommands;
    const q = query.toLowerCase();
    return actionCommands.filter(cmd => 
      cmd.label.toLowerCase().includes(q) || cmd.hint?.toLowerCase().includes(q)
    );
  }, [actionCommands, query, queryMode]);

  // All selectable items for keyboard navigation
  const allItems = useMemo(() => {
    if (view === 'sessions') {
      return sessions.map(s => ({ itemType: 'session' as const, ...s }));
    }
    if (view === 'agents') {
      return agents.map(a => ({ itemType: 'agent' as const, ...a }));
    }
    if (view === 'history') {
      return filteredHistory.map(item => ({ itemType: 'recent' as const, ...item }));
    }
    return [
      ...filteredRecent.map(r => ({ itemType: 'recent' as const, ...r })),
      ...filteredPrimary.map(p => ({ itemType: 'action' as const, ...p })),
      ...filteredNav.map(n => ({ itemType: 'nav' as const, ...n })),
      ...filteredActions.map(a => ({ itemType: 'action' as const, ...a })),
    ];
  }, [view, sessions, agents, filteredHistory, filteredRecent, filteredPrimary, filteredNav, filteredActions]);

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [allItems.length, query]);

  const handleSelect = useCallback((index: number) => {
    const item = allItems[index];
    if (!item) return;

    if ('action' in item && typeof item.action === 'function') {
      item.action();
    } else if (item.itemType === 'session') {
      onSelectSession?.(item.id);
      onClose();
    } else if (item.itemType === 'agent') {
      onSelectAgent?.(item.id);
      onClose();
    } else if (item.itemType === 'recent') {
      const recentItem = item as RecentItem & { itemType: 'recent' };
      if (recentItem.type === 'shell') {
        onExecuteShell(recentItem.content);
      } else if (recentItem.type === 'agent') {
        onExecuteAgent(recentItem.content);
      }
      onClose();
    }
  }, [allItems, onClose, onSelectSession, onSelectAgent, onExecuteShell, onExecuteAgent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (queryMode === 'shell') {
        onExecuteShell(query.slice(2).trim());
        onClose();
      } else if (queryMode === 'agent') {
        onExecuteAgent(query.slice(2).trim());
        onClose();
      } else {
        handleSelect(selectedIndex);
      }
    } else if (e.key === 'Backspace' && !query && view !== 'main') {
      setView('main');
    }
  };

  if (!isOpen) return null;

  const getPromptElement = () => {
    if (queryMode === 'shell') {
      return <span className="text-[var(--accent-emerald)] font-mono font-semibold">{'>'}</span>;
    }
    if (queryMode === 'agent') {
      return <span className="text-[var(--accent-violet)] font-mono font-semibold">@</span>;
    }
    return <Search className="command-palette__icon w-4 h-4" />;
  };

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={e => e.stopPropagation()}>
        {/* Breadcrumb for sub-views */}
        {view !== 'main' && (
          <div 
            className="command-palette__breadcrumb"
            onClick={() => { setView('main'); setQuery(''); }}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>⌘←</span>
            <span className="ml-2 capitalize">{view}</span>
          </div>
        )}

        {/* Input */}
        <div className="command-palette__input-wrapper">
          {getPromptElement()}
          <input
            ref={inputRef}
            type="text"
            className="command-palette__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={view === 'main' ? 'Search commands... (> shell, @ agent)' : `Search ${view}...`}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <span className="command-palette__kbd">esc</span>
        </div>

        {/* Results */}
        <div className="command-palette__results">
          {view === 'main' && queryMode === 'search' && (
            <>
              {/* Recent */}
              {filteredRecent.length > 0 && (
                <div className="command-palette__section">
                  <div className="command-palette__section-title">Recent</div>
                  {filteredRecent.map((item, idx) => {
                    const isSelected = selectedIndex === idx;
                    const itemClass = isSelected 
                      ? 'command-palette__item command-palette__item--selected' 
                      : 'command-palette__item';
                    const prefixClass = item.type === 'shell' 
                      ? 'text-[var(--accent-emerald)]' 
                      : item.type === 'agent' 
                        ? 'text-[var(--accent-violet)]' 
                        : 'text-[var(--text-secondary)]';
                    return (
                      <div
                        key={item.id}
                        className={itemClass}
                        onClick={() => handleSelect(idx)}
                      >
                        <span className={`font-mono text-sm ${prefixClass}`}>
                          {item.type === 'shell' ? '>' : item.type === 'agent' ? '@' : ''}
                        </span>
                        <span className="command-palette__item-label truncate">{item.content}</span>
                        <span className="command-palette__item-hint">{item.timestamp}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {filteredPrimary.length > 0 && (
                <div className="command-palette__section">
                  <div className="command-palette__section-title">Commands</div>
                  {filteredPrimary.map((cmd, idx) => {
                    const actualIdx = filteredRecent.length + idx;
                    const isSelected = selectedIndex === actualIdx;
                    const itemClass = isSelected
                      ? 'command-palette__item command-palette__item--selected'
                      : 'command-palette__item';
                    return (
                      <div
                        key={cmd.id}
                        className={itemClass}
                        onClick={() => handleSelect(actualIdx)}
                      >
                        <span className="command-palette__item-icon">{cmd.icon}</span>
                        <span className="command-palette__item-label">{cmd.label}</span>
                        {cmd.hint && <span className="command-palette__item-hint">{cmd.hint}</span>}
                        {cmd.shortcut && <span className="command-palette__item-shortcut">{cmd.shortcut}</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Navigation */}
              {filteredNav.length > 0 && (
                <div className="command-palette__section">
                  <div className="command-palette__section-title">Navigation</div>
                  {filteredNav.map((cmd, idx) => {
                    const actualIdx = filteredRecent.length + filteredPrimary.length + idx;
                    const isSelected = selectedIndex === actualIdx;
                    const itemClass = isSelected 
                      ? 'command-palette__item command-palette__item--selected' 
                      : 'command-palette__item';
                    return (
                      <div
                        key={cmd.id}
                        className={itemClass}
                        onClick={() => handleSelect(actualIdx)}
                      >
                        <span className="command-palette__item-icon">{cmd.icon}</span>
                        <span className="command-palette__item-label">{cmd.label}</span>
                        <span className="command-palette__item-hint">{cmd.hint}</span>
                        {cmd.shortcut && <span className="command-palette__item-shortcut">{cmd.shortcut}</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Actions */}
              {filteredActions.length > 0 && (
                <div className="command-palette__section">
                  <div className="command-palette__section-title">Actions</div>
                  {filteredActions.map((cmd, idx) => {
                    const actualIdx = filteredRecent.length + filteredPrimary.length + filteredNav.length + idx;
                    const isSelected = selectedIndex === actualIdx;
                    const itemClass = isSelected 
                      ? 'command-palette__item command-palette__item--selected' 
                      : 'command-palette__item';
                    return (
                      <div
                        key={cmd.id}
                        className={itemClass}
                        onClick={() => handleSelect(actualIdx)}
                      >
                        <span className="command-palette__item-icon">{cmd.icon}</span>
                        <span className="command-palette__item-label">{cmd.label}</span>
                        {cmd.hint && <span className="command-palette__item-hint">{cmd.hint}</span>}
                        {cmd.shortcut && <span className="command-palette__item-shortcut">{cmd.shortcut}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Execute hint for shell/agent mode */}
          {queryMode !== 'search' && query.length > 2 && (
            <div className="command-palette__section">
              <div className="command-palette__item command-palette__item--selected">
                <span className="command-palette__item-icon">
                  {queryMode === 'shell' ? <Terminal className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                </span>
                <span className="command-palette__item-label">
                  {queryMode === 'shell' ? 'Execute shell command' : 'Send to agent'}
                </span>
                <span className="command-palette__item-shortcut">⌘↵</span>
              </div>
            </div>
          )}

          {/* History view */}
          {view === 'history' && (
            <div className="command-palette__section">
              <div className="command-palette__section-title">History</div>
              {filteredHistory.length === 0 ? (
                <div className="command-palette__empty">No history yet.</div>
              ) : (
                filteredHistory.map((item, idx) => {
                  const isSelected = selectedIndex === idx;
                  const itemClass = isSelected
                    ? 'command-palette__item command-palette__item--selected'
                    : 'command-palette__item';
                  const prefixClass = item.type === 'shell'
                    ? 'text-[var(--accent-emerald)]'
                    : item.type === 'agent'
                      ? 'text-[var(--accent-violet)]'
                      : 'text-[var(--text-secondary)]';
                  return (
                    <div
                      key={item.id}
                      className={itemClass}
                      onClick={() => handleSelect(idx)}
                    >
                      <span className={`font-mono text-sm ${prefixClass}`}>
                        {item.type === 'shell' ? '>' : item.type === 'agent' ? '@' : '•'}
                      </span>
                      <span className="command-palette__item-label truncate">{item.content}</span>
                      <span className="command-palette__item-hint">{item.timestamp}</span>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Sessions view */}
          {view === 'sessions' && (
            <div className="command-palette__section">
              {sessions.map((session, idx) => {
                const isActive = currentSessionId === session.id;
                const isSelected = selectedIndex === idx;
                let itemClass = 'command-palette__item';
                if (isActive) itemClass += ' command-palette__item--active';
                if (isSelected) itemClass += ' command-palette__item--selected';
                return (
                  <div
                    key={session.id}
                    className={itemClass}
                    onClick={() => handleSelect(idx)}
                  >
                    <span className="font-mono text-sm">{session.id}</span>
                    <span className="flex-1 text-[var(--text-secondary)] text-sm">{session.timestamp}</span>
                    <span className="text-[var(--text-tertiary)] text-xs">{session.agent}</span>
                    <span className="text-[var(--text-tertiary)] text-xs">
                      {session.status === 'success' && '✓'}
                      {session.status === 'warning' && '⚠'}
                      {' '}{session.blockCount} blocks
                    </span>
                  </div>
                );
              })}
              <div className="border-t border-[var(--border-subtle)] mt-2 pt-2">
                <div
                  className="command-palette__item"
                  onClick={() => { onNewSession?.(); onClose(); }}
                >
                  <Plus className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span>New session</span>
                  <span className="command-palette__item-shortcut">⌘N</span>
                </div>
              </div>
            </div>
          )}

          {/* Agents view */}
          {view === 'agents' && (
            <div className="command-palette__section">
              {agents.map((agent, idx) => {
                const isActive = currentAgentId === agent.id;
                const isSelected = selectedIndex === idx;
                let itemClass = 'command-palette__item';
                if (isActive) itemClass += ' command-palette__item--active';
                if (isSelected) itemClass += ' command-palette__item--selected';
                return (
                  <div
                    key={agent.id}
                    className={itemClass}
                    onClick={() => handleSelect(idx)}
                  >
                    <span className="font-medium">{agent.name}</span>
                    {agent.isActive && <span className="text-[var(--accent-sky)] text-xs">Active</span>}
                    <span className="flex-1 text-[var(--text-secondary)] text-sm truncate">{agent.description}</span>
                    <span className="text-[var(--text-tertiary)] text-xs font-mono">{agent.model}</span>
                  </div>
                );
              })}
              <div className="border-t border-[var(--border-subtle)] mt-2 pt-2">
                <div
                  className="command-palette__item"
                  onClick={() => { onOpenSettings?.(); onClose(); }}
                >
                  <Settings className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span>Configure agents...</span>
                  <span className="command-palette__item-shortcut">⌘,</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
