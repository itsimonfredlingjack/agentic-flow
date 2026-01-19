"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';

export type InputMode = 'shell' | 'agent';

interface CommandInputProps {
  mode: InputMode;
  onModeToggle: () => void;
  onSubmit: (value: string, mode: InputMode) => void;
  onFocusCycle?: (direction: 'next' | 'prev') => void;
  disabled?: boolean;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export function CommandInput({
  mode,
  onModeToggle,
  onSubmit,
  onFocusCycle,
  disabled = false,
  placeholder,
  inputRef,
}: CommandInputProps) {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const localRef = useRef<HTMLTextAreaElement>(null);
  const resolvedRef = inputRef ?? localRef;

  const defaultPlaceholder = mode === 'shell' 
    ? 'Enter command...' 
    : 'Ask the agent...';

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    onSubmit(trimmed, mode);
    setHistory(prev => [trimmed, ...prev].slice(0, 50));
    setValue('');
    setHistoryIndex(-1);
  }, [value, mode, disabled, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      onFocusCycle?.(e.shiftKey ? 'prev' : 'next');
      return;
    }

    if (e.key === 'ArrowUp') {
      const caretAtStart = e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0;
      if (!caretAtStart) return;
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setValue(history[newIndex]);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      const caretAtEnd = e.currentTarget.selectionStart === value.length && e.currentTarget.selectionEnd === value.length;
      if (!caretAtEnd) return;
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
  }, [handleSubmit, history, historyIndex, onFocusCycle, value.length]);

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
    const nextHeight = Math.min(element.scrollHeight, 160);
    element.style.height = `${Math.max(nextHeight, 48)}px`;
  }, [value, resolvedRef]);

  const promptClass = mode === 'shell' 
    ? 'text-[var(--accent-emerald)]' 
    : 'text-[var(--accent-violet)]';

  return (
    <div className="terminal-input">
      <div 
        className="flex items-start gap-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg focus-within:border-[var(--accent-sky)] transition-colors"
        style={{ 
          minHeight: '52px',
          padding: '10px 16px',
        }}
      >
        {/* Mode indicator */}
        <span 
          className={`font-mono font-bold ${promptClass}`}
          style={{ fontSize: '16px' }}
        >
          {mode === 'shell' ? '>' : '@'}
        </span>
        
        {/* Input field */}
        <textarea
          ref={resolvedRef}
          rows={1}
          className="flex-1 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none"
          style={{
            fontSize: '14px',
            lineHeight: '1.5',
            caretColor: 'var(--accent-sky)',
            maxHeight: '160px',
            overflowY: 'auto',
          }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || defaultPlaceholder}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />

        {/* Mode toggle hint */}
        <div className="flex items-center gap-1.5 text-[var(--text-tertiary)]" style={{ fontSize: '11px' }}>
          <kbd className="px-1.5 py-0.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded font-mono" style={{ fontSize: '10px' }}>
            ⌘⇧A
          </kbd>
          <span className="hidden sm:inline">→ {mode === 'shell' ? 'Agent' : 'Shell'}</span>
        </div>
      </div>
    </div>
  );
}
