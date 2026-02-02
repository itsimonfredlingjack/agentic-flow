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
import { Command, PanelLeftClose, PanelLeft, ExternalLink, Search, X, ChevronUp, ChevronDown, HelpCircle, Check } from 'lucide-react';

type OutputAction = { kind: 'permission'; requestId: string; command: string };

export interface OutputItem {
  id: string;
  type: BlockType;
  command: string;
  content: string;
  status: BlockStatus;
  duration?: number;
  timestamp: string;
  agentRole?: RoleId;
  action?: OutputAction;
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
  onGrantPermission?: (requestId: string) => void;
  onDenyPermission?: (requestId: string) => void;
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
  onGrantPermission,
  onDenyPermission,
  showTimeline = true,
  sessions = [],
  agents = [],
  executionTasks = [],
  tokenCounts,
  headerActions,
}: TerminalLayoutProps) {
  const [inputMode, setInputMode] = useState<InputMode>('agent');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteInitialView, setPaletteInitialView] = useState<'main' | 'sessions' | 'agents' | 'history'>('main');
  const [crtEnabled, setCrtEnabled] = useState(true);
  const [focusExpanded, setFocusExpanded] = useState(false);
  const [artifactsOpen, setArtifactsOpen] = useState(false);
  const [artifactFilter, setArtifactFilter] = useState<'all' | 'patch' | 'snippet'>('all');
  const [artifactPreviewItem, setArtifactPreviewItem] = useState<InspectorItem | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const [timelineVisible, setTimelineVisible] = useState(showTimeline);
  const [mode, setMode] = useState<LayoutMode>('focus');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('inspector');
  const [selectedInspectorId, setSelectedInspectorId] = useState<string | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [roleTransition, setRoleTransition] = useState<{ from: RoleId; to: RoleId; accent: string } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const prevRoleRef = useRef<RoleId>(currentRole);

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
    setRecentItems(prev => [newRecent, ...prev].slice(0, 50));

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
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShortcutsOpen(prev => !prev);
      }

      // Cmd+K for palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteInitialView('main');
        setPaletteOpen(prev => !prev);
      }
      // Cmd/Ctrl+Y for history
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        setPaletteInitialView('history');
        setPaletteOpen(true);
      }
      // Cmd/Ctrl+F for search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
      if ((e.metaKey || e.ctrlKey) && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const roleOrder: RoleId[] = ['PLAN', 'BUILD', 'REVIEW', 'DEPLOY'];
        const currentIndex = roleOrder.indexOf(currentRole);
        if (currentIndex !== -1) {
          const delta = e.key === 'ArrowRight' ? 1 : -1;
          const nextIndex = (currentIndex + delta + roleOrder.length) % roleOrder.length;
          onRoleChange(roleOrder[nextIndex]);
        }
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
  }, [currentRole, onClear, onNewSession, onRoleChange]);

  useEffect(() => {
    if (!shortcutsOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShortcutsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcutsOpen]);

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
      PLAN: 'output-item--agent output-item--agent-architect',
      BUILD: 'output-item--agent output-item--agent-engineer',
      REVIEW: 'output-item--agent output-item--agent-critic',
      DEPLOY: 'output-item--agent output-item--agent-deployer',
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

  const artifactCounts = useMemo(() => {
    const counts = { all: 0, patch: 0, snippet: 0 };
    inspectorItems.forEach((item) => {
      if (item.kind === 'patch') counts.patch += 1;
      if (item.kind === 'snippet') counts.snippet += 1;
      counts.all += 1;
    });
    return counts;
  }, [inspectorItems]);

  const filteredArtifacts = useMemo(() => {
    const items = inspectorItems.filter((item) => item.kind === 'patch' || item.kind === 'snippet');
    if (artifactFilter === 'all') return items;
    return items.filter((item) => item.kind === artifactFilter);
  }, [artifactFilter, inspectorItems]);

  const artifactRoleCounts = useMemo(() => {
    const counts: Partial<Record<RoleId, number>> = {};
    inspectorItems.forEach((item) => {
      if (!item.role) return;
      counts[item.role] = (counts[item.role] ?? 0) + 1;
    });
    return counts;
  }, [inspectorItems]);

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
  const visibleOutputs = useMemo(() => {
    if (searchOpen) return outputs;
    if (mode === 'focus' && !focusExpanded) return outputs.slice(-2);
    return outputs.slice(-6);
  }, [outputs, searchOpen, mode, focusExpanded]);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!normalizedSearch) return [];
    return visibleOutputs
      .filter((output) => {
        const haystack = `${output.command}
${output.content || ''}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .map((output) => output.id);
  }, [visibleOutputs, normalizedSearch]);
  const searchResultSet = useMemo(() => new Set(searchResults), [searchResults]);
  const activeSearchId = searchResults[searchIndex] ?? null;
  const searchCountLabel = searchResults.length ? `${searchIndex + 1}/${searchResults.length}` : '0';

  const artifactItems = filteredArtifacts;
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

  const scrollToSearchResult = useCallback((index: number) => {
    const id = searchResults[index];
    if (!id) return;
    setAutoScroll(false);
    const target = document.querySelector(`[data-block-id="${id}"]`);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchResults]);

  const handleSearchNavigate = useCallback((direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;
    const nextIndex = direction === 'next'
      ? (searchIndex + 1) % searchResults.length
      : (searchIndex - 1 + searchResults.length) % searchResults.length;
    setSearchIndex(nextIndex);
    scrollToSearchResult(nextIndex);
  }, [searchIndex, searchResults, scrollToSearchResult]);

  const getOutputIdFromInspector = useCallback((itemId: string) => {
    if (!itemId) return null;
    const patchIndex = itemId.indexOf('-patch-');
    if (patchIndex > 0) return itemId.slice(0, patchIndex);
    const codeIndex = itemId.indexOf('-code-');
    if (codeIndex > 0) return itemId.slice(0, codeIndex);
    return itemId;
  }, []);

  const getPreviewText = useCallback((value: string) => {
    if (!value) return '';
    const lines = value.split('\n');
    const preview = lines.slice(0, 2).join('\n');
    return preview.length < value.length ? `${preview}\n…` : preview;
  }, []);

  const scrollToOutputId = useCallback((outputId: string | null) => {
    if (!outputId) return;
    setAutoScroll(false);
    const target = document.querySelector(`[data-block-id="${outputId}"]`);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  useEffect(() => {
    if (searchOpen) {
      setAutoScroll(false);
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!searchResults.length) {
      setSearchIndex(0);
      return;
    }
    setSearchIndex((prev) => Math.min(prev, searchResults.length - 1));
  }, [searchResults.length]);

  useEffect(() => {
    if (searchOpen && searchResults.length > 0) {
      scrollToSearchResult(searchIndex);
    }
  }, [searchOpen, searchResults.length, searchIndex, scrollToSearchResult]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setSearchIndex(0);
    }
  }, [searchQuery]);

  const batchResults = outputs.slice(-4).map((output) => ({
    id: output.id,
    label: output.command,
    status: output.status,
  }));

  const roleNames = useMemo<Record<RoleId, string>>(() => ({
    PLAN: 'Architect',
    BUILD: 'Engineer',
    REVIEW: 'Critic',
    DEPLOY: 'Deployer',
  }), []);
  const roleAccents = useMemo<Record<RoleId, string>>(() => ({
    PLAN: 'var(--agent-architect)',
    BUILD: 'var(--agent-engineer)',
    REVIEW: 'var(--agent-critic)',
    DEPLOY: 'var(--agent-deployer)',
  }), []);
  const roleHandles: Record<RoleId, string> = {
    PLAN: 'architect',
    BUILD: 'engineer',
    REVIEW: 'critic',
    DEPLOY: 'deployer',
  };

  const rolePlaceholders: Record<RoleId, string> = {
    PLAN: 'Describe your project architecture...',
    BUILD: 'Request implementation or code changes...',
    REVIEW: 'Ask for review or improvements...',
    DEPLOY: 'Configure deployment...',
  };

  const commandPlaceholder = inputMode === 'agent'
    ? rolePlaceholders[currentRole]
    : 'Enter command...';

  const breadcrumbCommand = lastOutput?.command ? lastOutput.command : 'Ready';

  const roleOrder: RoleId[] = ['PLAN', 'BUILD', 'REVIEW', 'DEPLOY'];
  const currentRoleIndex = roleOrder.indexOf(currentRole);
  const nextRole = currentRoleIndex >= 0 && currentRoleIndex < roleOrder.length - 1
    ? roleOrder[currentRoleIndex + 1]
    : roleOrder[0];
  const roleShortcutLabel = roleOrder.map((role) => roleNames[role]).join(' / ');

  const shortcutSections = [
    {
      title: 'Global',
      items: [
        { keys: ['Shift', '/'], label: 'Shortcut help' },
        { keys: ['⌘/Ctrl', 'K'], label: 'Command palette' },
        { keys: ['⌘/Ctrl', 'Y'], label: 'Command history' },
        { keys: ['⌘/Ctrl', 'F'], label: 'Search output' },
        { keys: ['⌘/Ctrl', 'B'], label: 'Toggle timeline' },
        { keys: ['⌥/Alt', 'I'], label: 'Toggle Focus/Inspect mode' },
        { keys: ['⌘/Ctrl', '⌥/Alt', '←/→'], label: 'Cycle roles' },
        { keys: ['⌘/Ctrl', '1-4'], label: `Switch roles (${roleShortcutLabel})` },
        { keys: ['⌘/Ctrl', 'N'], label: 'New session' },
        { keys: ['⌘/Ctrl', 'L'], label: 'Clear output' },
      ],
    },
    {
      title: 'Editor',
      items: [
        { keys: ['Enter'], label: 'Run command' },
        { keys: ['Shift', 'Enter'], label: 'New line' },
        { keys: ['⌘/Ctrl', 'Shift', 'A'], label: 'Toggle Agent/Shell input' },
        { keys: ['↑', '↓'], label: 'Command history' },
        { keys: ['Tab'], label: 'Focus next panel', note: 'Shift+Tab goes back' },
        { keys: ['Esc'], label: 'Clear input / close panels' },
      ],
    },
  ];

  useEffect(() => {
    if (prevRoleRef.current === currentRole) return;
    const from = prevRoleRef.current;
    const to = currentRole;
    prevRoleRef.current = currentRole;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setRecentItems(prev => [
      {
        id: `${Date.now()}-${to}`,
        type: 'nav' as const,
        content: `Switch → ${roleNames[to]}`,
        timestamp,
      },
      ...prev,
    ].slice(0, 50));
    setRoleTransition({ from, to, accent: roleAccents[to] });
    const timer = window.setTimeout(() => setRoleTransition(null), 650);
    return () => window.clearTimeout(timer);
  }, [currentRole, roleAccents, roleNames]);

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
    <div
      className={`app-shell ${crtEnabled ? 'app-shell--crt' : ''}`}
      data-role={currentRole.toLowerCase()}
      style={{ '--role-accent': roleAccents[currentRole] } as React.CSSProperties}
    >
      {roleTransition && (
        <div
          className="role-transition"
          style={{ '--role-accent': roleTransition.accent } as React.CSSProperties}
        >
          <div className="role-transition__label">
            {roleNames[roleTransition.from]} → {roleNames[roleTransition.to]}
          </div>
        </div>
      )}
      <header className="app-chrome">
        <div className="app-titlebar">
          <div className="window-controls" aria-hidden="true">
            <span className="window-dot window-dot--red" />
            <span className="window-dot window-dot--yellow" />
            <span className="window-dot window-dot--green" />
          </div>
          <div className="app-identity">
            <span className="app-name">LLM Creative</span>
            <span className="app-session">Session {sessionId}</span>
          </div>
          <div className="app-status" />
        </div>

        <div className="app-toolbar">
          <div className="toolbar-left">
            <button
              onClick={() => setTimelineVisible(!timelineVisible)}
              className="toolbar-icon"
              title="Toggle timeline (⌘B)"
            >
              {timelineVisible ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeft className="w-4 h-4" />
              )}
            </button>
            <RoleSelector
              currentRole={currentRole}
              roleStates={effectiveRoleStates}
              onSelectRole={onRoleChange}
            />
          </div>

          <div className="toolbar-center">
            <div className="mode-toggle">
              {(['focus', 'inspect', 'batch'] as LayoutMode[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`mode-toggle__button ${mode === item ? 'mode-toggle__button--active' : ''}`}
                  onClick={() => setMode(item)}
                  aria-pressed={mode === item}
                >
                  --{item}
                </button>
              ))}
            </div>
          </div>

          <div className="toolbar-right">
            {headerActions}
          </div>
        </div>
        
      </header>

      

      <div className="app-workspace">
        {showLeftRail && (
          <aside className="sidebar sidebar--left">
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

        <div className="workspace-content">
          <section className="workspace-primary">
            <div className="terminal-panel terminal-panel--output flex-1 min-h-0">
              <div className="terminal-panel__header terminal-panel__header--compact">
                <div className="terminal-panel__header-actions">
                  <span className="panel-chip">Artifact container</span>
                  <span className="terminal-panel__meta">Truth: runtime</span>
                  {mode === 'focus' && outputs.length > 2 && (
                    <button
                      type="button"
                      className="output-focus-toggle"
                      onClick={() => setFocusExpanded((prev) => !prev)}
                    >
                      {focusExpanded ? 'Show recent' : `Show all (${outputs.length})`}
                    </button>
                  )}
                  {artifactCounts.all > 0 && (
                    <div className="artifacts-rail">
                      <button
                        type="button"
                        className="artifacts-rail__toggle"
                        onClick={() => setArtifactsOpen((prev) => !prev)}
                      >
                        Artifacts {artifactCounts.all}
                      </button>
                      <span className="artifacts-rail__summary">
                        {artifactCounts.patch} patch{artifactCounts.patch === 1 ? '' : 'es'} • {artifactCounts.snippet} snippet{artifactCounts.snippet === 1 ? '' : 's'}
                      </span>
                      {artifactsOpen && (
                        <div className="artifacts-rail__panel">
                          <div className="artifacts-rail__filters">
                            {(['all', 'patch', 'snippet'] as const).map((filter) => (
                              <button
                                key={filter}
                                type="button"
                                className={`artifacts-rail__filter ${artifactFilter === filter ? 'artifacts-rail__filter--active' : ''}`}
                                onClick={() => setArtifactFilter(filter)}
                              >
                                {filter === 'all' ? 'All' : filter === 'patch' ? 'Patches' : 'Snippets'}
                              </button>
                            ))}
                          </div>
                          {Object.keys(artifactRoleCounts).length > 0 && (
                            <div className="artifacts-rail__roles">
                              {Object.entries(artifactRoleCounts).map(([role, count]) => (
                                <span
                                  key={role}
                                  className={`artifacts-rail__role artifacts-rail__role--${role.toLowerCase()}`}
                                >
                                  {roleNames[role as RoleId]} {count}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="artifacts-rail__list">
                            {artifactItems.length === 0 && (
                              <div className="artifacts-rail__empty">No artifacts match this filter.</div>
                            )}
                            {artifactItems.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className="artifacts-rail__item"
                                onMouseEnter={() => {
                                  if (previewTimerRef.current) {
                                    window.clearTimeout(previewTimerRef.current);
                                  }
                                  previewTimerRef.current = window.setTimeout(() => {
                                    setArtifactPreviewItem(item);
                                  }, 180);
                                }}
                                onMouseLeave={() => {
                                  if (previewTimerRef.current) {
                                    window.clearTimeout(previewTimerRef.current);
                                  }
                                  setArtifactPreviewItem(null);
                                }}
                                onClick={() => {
                                  setSelectedInspectorId(item.id);
                                  setArtifactsOpen(false);
                                  scrollToOutputId(getOutputIdFromInspector(item.id));
                                }}
                              >
                                <span className="artifacts-rail__label">{item.label}</span>
                                <span className="artifacts-rail__meta">
                                  <span className="artifacts-rail__kind">{item.kind}</span>
                                  {item.role && (
                                    <span className={`artifacts-rail__role artifacts-rail__role--${item.role.toLowerCase()}`}>
                                      {roleNames[item.role]}
                                    </span>
                                  )}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {artifactPreviewItem && (
                        <div className="artifacts-rail__preview">
                          <div className="artifacts-rail__preview-title">
                            {artifactPreviewItem.label}
                          </div>
                          <div className="artifacts-rail__preview-meta">
                            <span>{artifactPreviewItem.kind}</span>
                            {artifactPreviewItem.role && <span>• {roleNames[artifactPreviewItem.role]}</span>}
                            {artifactPreviewItem.status && <span>• {artifactPreviewItem.status}</span>}
                          </div>
                          {artifactPreviewItem.kind === 'snippet' ? (
                            <SyntaxHighlighter
                              language={artifactPreviewItem.language || 'text'}
                              style={vscDarkPlus}
                              customStyle={{
                                margin: 0,
                                background: 'transparent',
                                padding: '8px 10px',
                                fontSize: '11px',
                                lineHeight: '1.4',
                              }}
                              codeTagProps={{
                                style: { fontFamily: 'var(--font-terminal), var(--font-geist-mono), monospace' },
                              }}
                            >
                              {getPreviewText(artifactPreviewItem.content)}
                            </SyntaxHighlighter>
                          ) : (
                            <pre className="artifacts-rail__preview-body">{getPreviewText(artifactPreviewItem.content)}</pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <div className={`output-search ${searchOpen ? 'output-search--open' : ''}`}>
                    {searchOpen ? (
                      <div className="output-search__field" role="search">
                        <Search className="w-3.5 h-3.5 text-[var(--accent-sky)]" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSearchNavigate(e.shiftKey ? 'prev' : 'next');
                            }
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              handleSearchNavigate('next');
                            }
                            if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              handleSearchNavigate('prev');
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              setSearchOpen(false);
                              setSearchQuery('');
                            }
                          }}
                          placeholder="Search output..."
                          aria-label="Search terminal output"
                          className="output-search__input"
                        />
                        <span className="output-search__count">{searchCountLabel}</span>
                        <button
                          type="button"
                          className="output-search__nav-btn"
                          onClick={() => handleSearchNavigate('prev')}
                          aria-label="Previous match"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          className="output-search__nav-btn"
                          onClick={() => handleSearchNavigate('next')}
                          aria-label="Next match"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          className="output-search__close"
                          onClick={() => {
                            setSearchOpen(false);
                            setSearchQuery('');
                          }}
                          aria-label="Close search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="output-search__toggle"
                        onClick={() => {
                          setSearchOpen(true);
                          requestAnimationFrame(() => searchInputRef.current?.focus());
                        }}
                        aria-label="Open search"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>Find</span>
                        <span className="output-search__kbd">⌘F</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div
                ref={mainRef}
                className="terminal-panel__body space-y-4"
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

                {visibleOutputs.map((output) => {
                  const isMatch = searchResultSet.has(output.id);
                  const isActive = activeSearchId === output.id;
                  const searchClass = isActive ? 'output-block--search-active' : isMatch ? 'output-block--search-hit' : '';

                  const permissionRequestId = output.action?.kind === 'permission' ? output.action.requestId : null;

                  return (
                    <div
                      key={output.id}
                      data-output-id={output.id}
                      className={['output-item', getAgentClass(output.agentRole), searchClass].filter(Boolean).join(' ')}
                    >
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
                        actions={
                          permissionRequestId && onGrantPermission && onDenyPermission ? (
                            <>
                              <button
                                type="button"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--bg-base)] bg-[var(--accent-rose)] rounded hover:opacity-90"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (!permissionRequestId) return;
                                  onDenyPermission(permissionRequestId);
                                }}
                              >
                                Deny
                              </button>
                              <button
                                type="button"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--bg-base)] bg-[var(--accent-emerald)] rounded hover:opacity-90"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (!permissionRequestId) return;
                                  onGrantPermission(permissionRequestId);
                                }}
                              >
                                Approve
                              </button>
                            </>
                          ) : undefined
                        }
                      />
                    </div>
                  );
                })}

                <span ref={outputsEndRef} className="output-end" />
              </div>
            </div>

            <CommandInput
              mode={inputMode}
              onModeToggle={handleModeToggle}
              onSubmit={handleSubmit}
              disabled={agentStatus === 'running' || agentStatus === 'thinking'}
              onFocusCycle={(direction) => handleFocusCycle('input', direction)}
              inputRef={inputRef}
              promptLabel={`${roleHandles[currentRole]}@llm-creative:~$`}
              placeholder={commandPlaceholder}
            />
          </section>

          {showRightPanel && (
            <aside className="sidebar sidebar--right">
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

      <footer className="status-bar" role="status" aria-live="polite">
        <div className="status-group">
          <span className="status-item">Mode: --{mode}</span>
          <span className="status-sep">•</span>
          <span className="status-item">Role: {roleNames[currentRole]}</span>
        </div>
        <span className="status-divider" aria-hidden="true" />
        <div className="status-group status-group--center">
          <StatusPill
            status={agentStatus}
            agentName={activeAgent?.name}
            modelName={modelName}
            sessionId={sessionId}
          />
          <span className="status-sep">•</span>
          {tokenCounts && (
            <>
              <TokenCounter
                inputTokens={tokenCounts.input}
                outputTokens={tokenCounts.output}
                totalTokens={tokenCounts.total}
              />
              <span className="status-sep">•</span>
            </>
          )}
          <ModelSelector
            currentModel={modelName}
            status={modelStatus}
            onSelectModel={handleModelChange}
          />
        </div>
        <span className="status-divider" aria-hidden="true" />
        <div className="status-group status-group--right">
          <button
            type="button"
            className="status-action"
            onClick={() => setShortcutsOpen(true)}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            aria-haspopup="dialog"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Help
          </button>
          <button
            type="button"
            className="status-action"
            onClick={() => {
              setPaletteInitialView('main');
              setPaletteOpen(true);
            }}
            title="Command palette (⌘K)"
          >
            <Command className="w-3.5 h-3.5" />
            ⌘K
          </button>
          <button
            type="button"
            className="status-action status-action--hide-sm"
            title="Focus next panel (TAB)"
          >
            TAB
          </button>
          <button
            type="button"
            className={`status-action status-action--hide-sm ${crtEnabled ? 'status-action--active' : ''}`}
            onClick={() => setCrtEnabled((prev) => !prev)}
            aria-pressed={crtEnabled}
            title="Toggle CRT effects"
          >
            CRT
          </button>
        </div>
      </footer>

      {/* Command Palette */}
      <CommandPalette
        isOpen={paletteOpen}
        initialView={paletteInitialView}
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

      {shortcutsOpen && (
        <div className="shortcut-modal-overlay" onClick={() => setShortcutsOpen(false)}>
          <div
            className="shortcut-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shortcut-modal__header">
              <div className="shortcut-modal__title-group">
                <span className="shortcut-modal__title">Keyboard Shortcuts</span>
                <span className="shortcut-modal__subtitle">Global + editor commands</span>
              </div>
              <button type="button" className="shortcut-modal__close" onClick={() => setShortcutsOpen(false)}>
                Close
              </button>
            </div>
            <div className="shortcut-modal__body">
              {shortcutSections.map((section) => (
                <div className="shortcut-modal__section" key={section.title}>
                  <div className="shortcut-modal__section-title">{section.title}</div>
                  <div className="shortcut-modal__list">
                    {section.items.map((item) => (
                      <div className="shortcut-modal__item" key={`${section.title}-${item.label}`}>
                        <div className="shortcut-modal__item-label">
                          <span>{item.label}</span>
                          {item.note && <span className="shortcut-modal__item-note">{item.note}</span>}
                        </div>
                        <div className="shortcut-modal__keys">
                          {item.keys.map((key, index) => (
                            <React.Fragment key={`${item.label}-${key}-${index}`}>
                              <kbd className="shortcut-kbd">{key}</kbd>
                              {index < item.keys.length - 1 && <span className="shortcut-kbd__sep">+</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
