"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';

export type InputMode = 'shell' | 'agent';

interface CommandInputProps {
  mode: InputMode;
  onModeToggle: () => void;
  onSubmit: (value: string, mode: InputMode) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function CommandInput({
  mode,
  onModeToggle,
  onSubmit,
  disabled = false,
  placeholder,
}: CommandInputProps) {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setValue(history[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setValue(history[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setValue('');
      }
    } else if (e.key === 'Escape') {
      setValue('');
      setHistoryIndex(-1);
    }
  }, [handleSubmit, history, historyIndex]);

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
    inputRef.current?.focus();
  }, []);

  const promptClass = mode === 'shell' 
    ? 'text-[var(--accent-emerald)]' 
    : 'text-[var(--accent-violet)]';

  return (
    <div className="px-4 pb-4">
      <div 
        className="flex items-center gap-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg focus-within:border-[var(--accent-sky)] transition-colors"
        style={{ 
          height: '48px',
          padding: '0 16px',
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
        <input
          ref={inputRef}
          type="text"
          className="flex-1 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
          style={{ 
            fontSize: '14px',
            lineHeight: '1.5',
            caretColor: 'var(--accent-sky)',
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
