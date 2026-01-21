"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

export type InputMode = 'shell' | 'agent';

interface CommandInputProps {
  mode: InputMode;
  onModeToggle: () => void;
  onSubmit: (value: string, mode: InputMode) => void;
  onFocusCycle?: (direction: 'next' | 'prev') => void;
  disabled?: boolean;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  promptLabel?: string;
  promptTone?: 'architect' | 'engineer' | 'critic' | 'deployer' | 'shell';
  tokenLimit?: number;
  tokenWarnAt?: number;
}

export function CommandInput({
  mode,
  onModeToggle,
  onSubmit,
  onFocusCycle,
  disabled = false,
  placeholder,
  inputRef,
  promptLabel,
  promptTone = 'shell',
  tokenLimit,
  tokenWarnAt,
}: CommandInputProps) {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const localRef = useRef<HTMLTextAreaElement>(null);
  const resolvedRef = inputRef ?? localRef;
  const highlightRef = useRef<HTMLPreElement>(null);
  const storageKey = mode === 'shell' ? 'terminal-history-shell' : 'terminal-history-agent';
  const [isHistorySearch, setIsHistorySearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [searchPreview, setSearchPreview] = useState('');
  const [promptPulse, setPromptPulse] = useState(false);
  const promptSnapshot = useRef({ label: promptLabel, tone: promptTone });

  const defaultPlaceholder = '';
  const inputMaxHeight = 250;
  const inputMinHeight = 100;
  const approxTokens = Math.ceil(value.length / 4);
  const warnThreshold = tokenLimit ? Math.round(tokenLimit * (tokenWarnAt ?? 0.8)) : null;
  const showTokenCounter = tokenLimit !== undefined && warnThreshold !== null && approxTokens >= warnThreshold;

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    onSubmit(trimmed, mode);
    setHistory(prev => [trimmed, ...prev].slice(0, 50));
    setValue('');
    setHistoryIndex(-1);
  }, [value, mode, disabled, onSubmit]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) {
        setHistory([]);
        setHistoryIndex(-1);
        return;
      }
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setHistory(parsed);
      } else {
        setHistory([]);
      }
    } catch {
      setHistory([]);
    }
    setHistoryIndex(-1);
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(history.slice(0, 50)));
    } catch {
      // ignore storage errors
    }
  }, [history, storageKey]);

  const updateSearchPreview = useCallback((query: string, offset = 0) => {
    if (!query) {
      if (history.length === 0) {
        setSearchPreview('');
        setSearchIndex(0);
        return;
      }
      const normalized = offset % history.length;
      const index = normalized < 0 ? normalized + history.length : normalized;
      setSearchIndex(index);
      setSearchPreview(history[index]);
      return;
    }
    const matches = history.filter((entry) => entry.toLowerCase().includes(query.toLowerCase()));
    if (matches.length === 0) {
      setSearchPreview('');
      setSearchIndex(0);
      return;
    }
    const normalized = offset % matches.length;
    const index = normalized < 0 ? normalized + matches.length : normalized;
    setSearchIndex(index);
    setSearchPreview(matches[index]);
  }, [history]);

  const suggestions = useMemo(() => {
    const seed = [
      '@plan ',
      '@build ',
      '@review ',
      '@deploy ',
      '/clear',
      '/reset',
      '/history',
    ];
    const unique = Array.from(new Set([...seed, ...history]));
    const query = value.trim().toLowerCase();
    if (!query) return [];
    return unique
      .filter((item) => item.toLowerCase().includes(query))
      .slice(0, 6);
  }, [history, value]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isHistorySearch) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (searchPreview) {
          setValue(searchPreview);
        }
        setIsHistorySearch(false);
        setSearchQuery('');
        setSearchPreview('');
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsHistorySearch(false);
        setSearchQuery('');
        setSearchPreview('');
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        const next = searchQuery.slice(0, -1);
        setSearchQuery(next);
        updateSearchPreview(next, 0);
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        updateSearchPreview(searchQuery, searchIndex + 1);
        return;
      }

      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const next = `${searchQuery}${e.key}`;
        setSearchQuery(next);
        updateSearchPreview(next, 0);
        return;
      }

      return;
    }

    if (e.ctrlKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      setIsHistorySearch(true);
      setSearchQuery('');
      updateSearchPreview('', 0);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }

    if (e.key === 'Tab') {
      if (!e.shiftKey && suggestions.length > 0) {
        e.preventDefault();
        setValue(suggestions[0]);
        return;
      }
      e.preventDefault();
      onFocusCycle?.(e.shiftKey ? 'prev' : 'next');
      return;
    }

    if (e.key === 'ArrowUp') {
      if (history.length === 0) return;
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setValue(history[newIndex]);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      if (history.length === 0) return;
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setValue(history[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setValue('');
      }
      return;
    }

    if (e.key === 'Escape') {
      setValue('');
      setHistoryIndex(-1);
    }
  }, [
    handleSubmit,
    history,
    historyIndex,
    isHistorySearch,
    onFocusCycle,
    searchIndex,
    searchPreview,
    searchQuery,
    updateSearchPreview,
    suggestions,
    value.length,
  ]);

  // Global shortcut for mode toggle
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        onModeToggle();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onModeToggle]);

  // Focus input on mount
  useEffect(() => {
    resolvedRef.current?.focus();
  }, [resolvedRef]);

  useEffect(() => {
    const element = resolvedRef.current;
    if (!element) return;
    element.style.height = '0px';
    const nextHeight = Math.min(element.scrollHeight, inputMaxHeight);
    element.style.height = `${Math.max(nextHeight, inputMinHeight)}px`;
  }, [value, resolvedRef]);

  useEffect(() => {
    if (
      promptSnapshot.current.label !== promptLabel ||
      promptSnapshot.current.tone !== promptTone
    ) {
      setPromptPulse(true);
      const timer = setTimeout(() => setPromptPulse(false), 360);
      promptSnapshot.current = { label: promptLabel, tone: promptTone };
      return () => clearTimeout(timer);
    }
  }, [promptLabel, promptTone]);

  const promptClass = `terminal-prompt--${promptTone}`;
  const promptText = promptLabel ?? (mode === 'shell'
    ? 'terminal@llm-creative:~$'
    : 'architect@llm-creative:~$');

  const escapeHtml = (raw: string) => raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const highlightedHtml = useMemo(() => {
    if (!value) return '&nbsp;';
    const patterns = [
      { regex: /@(plan|build|review|deploy|architect|engineer|critic|deployer)\b/gi, className: 'agent', priority: 3 },
      { regex: /(?:\.\.\/|\.\/|~\/|\/)[\w.-]+(?:\/[\w.-]+)+/g, className: 'path', priority: 2 },
      { regex: /--[\w-]+|-\w\b/g, className: 'flag', priority: 1 },
    ];

    const ranges: Array<{ start: number; end: number; className: string; priority: number }> = [];
    patterns.forEach((pattern) => {
      for (const match of value.matchAll(pattern.regex)) {
        if (match.index === undefined) continue;
        const start = match.index;
        const end = start + match[0].length;
        ranges.push({ start, end, className: pattern.className, priority: pattern.priority });
      }
    });

    ranges.sort((a, b) => (a.start - b.start) || (b.priority - a.priority) || ((b.end - b.start) - (a.end - a.start)));
    const selected: typeof ranges = [];
    let cursor = 0;
    for (const range of ranges) {
      if (range.start < cursor) continue;
      selected.push(range);
      cursor = range.end;
    }

    let output = '';
    let index = 0;
    for (const range of selected) {
      output += escapeHtml(value.slice(index, range.start));
      output += `<span class="input-token input-token--${range.className}">${escapeHtml(value.slice(range.start, range.end))}</span>`;
      index = range.end;
    }
    output += escapeHtml(value.slice(index));
    return output || '&nbsp;';
  }, [value]);

  const handleScrollSync = () => {
    const textarea = resolvedRef.current;
    const highlighter = highlightRef.current;
    if (!textarea || !highlighter) return;
    highlighter.scrollTop = textarea.scrollTop;
    highlighter.scrollLeft = textarea.scrollLeft;
  };

  return (
    <div className="terminal-input">
      <div 
        className="terminal-input__surface flex items-start gap-3 transition-colors"
        style={{ 
          minHeight: '100px',
          padding: '24px',
        }}
      >
        {/* Mode indicator */}
        <span 
          className={`terminal-prompt ${promptClass} ${promptPulse ? 'terminal-prompt--pulse' : ''}`}
        >
          {promptText}
          <span className="terminal-cursor" aria-hidden="true" />
        </span>
        
        {/* Input field */}
        <div className="terminal-input__editor">
          <pre
            ref={highlightRef}
            className="terminal-input__highlighter"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
          <textarea
            ref={resolvedRef}
            rows={1}
            className="terminal-input__field terminal-input__textarea flex-1 bg-transparent text-[var(--text-primary)] outline-none resize-none"
            style={{
              fontSize: 'var(--terminal-font-size)',
              lineHeight: 'var(--terminal-line-height)',
              caretColor: 'var(--accent-sky)',
              maxHeight: `${inputMaxHeight}px`,
              overflowY: 'auto',
            }}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={handleScrollSync}
            placeholder={placeholder || defaultPlaceholder}
            disabled={disabled}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>

        {/* Mode toggle hint */}
        <div className="terminal-input__hint flex items-center gap-1.5 text-[var(--text-tertiary)]" style={{ fontSize: '11px' }}>
          <kbd className="px-1.5 py-0.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded font-mono" style={{ fontSize: '10px' }}>
            ⌘⇧A
          </kbd>
          <span className="hidden sm:inline">→ {mode === 'shell' ? 'Agent' : 'Shell'}</span>
          {disabled && <span className="terminal-input__typing">···</span>}
        </div>
      </div>
      {showTokenCounter && (
        <div className="terminal-input__counter">
          <span className="terminal-input__counter-label">Tokens</span>
          <span className="terminal-input__counter-value">
            ~{approxTokens}/{tokenLimit}
          </span>
          <span className="terminal-input__counter-chars">{value.length} chars</span>
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="terminal-autocomplete">
          {suggestions.map((item) => (
            <button
              key={item}
              type="button"
              className="terminal-autocomplete__item"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setValue(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}
      {isHistorySearch && (
        <div className="terminal-history-search">
          <span className="terminal-history-search__label">reverse-i-search:</span>
          <span className="terminal-history-search__query">{searchQuery || '—'}</span>
          {searchPreview ? (
            <span className="terminal-history-search__preview">{searchPreview}</span>
          ) : (
            <span className="terminal-history-search__empty">
              {history.length === 0 ? 'no history' : 'no match'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
