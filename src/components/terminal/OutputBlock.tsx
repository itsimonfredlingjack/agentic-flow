"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, AlertTriangle, Loader2, Copy, Play } from 'lucide-react';
import { MarkdownMessage } from '@/components/MarkdownMessage';
import { FileTreeBlock, isFileTreeContent } from './FileTreeBlock';

export type BlockType = 'shell' | 'agent';
export type BlockStatus = 'running' | 'success' | 'error' | 'idle';

interface OutputBlockProps {
  id: string;
  type: BlockType;
  command: string;
  content: string;
  status?: BlockStatus;
  duration?: number;
  timestamp?: string;
  defaultCollapsed?: boolean;
  actions?: React.ReactNode;
  onApply?: () => void;
  onCopy?: () => void;
}

export function OutputBlock({
  id,
  type,
  command,
  content,
  status = 'idle',
  duration,
  timestamp,
  defaultCollapsed = false,
  actions,
  onApply,
  onCopy,
}: OutputBlockProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [justAppeared, setJustAppeared] = useState(true);
  const [copied, setCopied] = useState(false);
  const [blockFlash, setBlockFlash] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setJustAppeared(false), 300);
    return () => clearTimeout(timer);
  }, []);

  // Auto-scroll to bottom when content updates
  useEffect(() => {
    if (!collapsed && contentRef.current && status === 'running') {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, collapsed, status]);

  const statusIcon = {
    running: <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-sky)]" />,
    success: <Check className="w-3.5 h-3.5 text-[var(--accent-emerald)]" />,
    error: <AlertTriangle className="w-3.5 h-3.5 text-[var(--accent-rose)]" />,
    idle: null,
  }[status];

  const blockClasses = [
    'output-block',
    justAppeared && 'block-enter',
    status === 'running' && 'output-block--running',
    status === 'error' && 'output-block--error',
    blockFlash && 'output-block--copied',
  ].filter(Boolean).join(' ');

  const promptClass = type === 'shell'
    ? 'text-[var(--accent-emerald)]'
    : 'text-[var(--accent-violet)]';

  const chevronClass = collapsed
    ? 'transform -rotate-90'
    : '';

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setBlockFlash(true);
      onCopy?.();

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
      // Reset flash after animation
      setTimeout(() => setBlockFlash(false), 300);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setBlockFlash(true);
        setTimeout(() => setCopied(false), 2000);
        setTimeout(() => setBlockFlash(false), 300);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
    }
  };

  const handleApply = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onApply?.();
  };

  // Content type detection
  const hasMarkdown = content && (
    content.includes('```') ||
    content.includes('**') ||
    content.includes('###') ||
    content.includes('- ') ||
    content.includes('1. ')
  );

  const isFileTree = content && isFileTreeContent(content);

  // Render content based on type
  const renderContent = () => {
    // Show loading spinner for running state with no content
    if (!content && status === 'running') {
      return (
        <div className="flex items-center gap-2 text-[var(--text-tertiary)] text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Running...</span>
        </div>
      );
    }

    // For idle/pending states with no content, just show nothing (user just sent it)
    if (!content && (status === 'idle' || status === 'success')) {
      return null;
    }

    // For error with no content, show generic error
    if (!content && status === 'error') {
      return <span className="text-[var(--accent-rose)] text-sm">Command failed with no output</span>;
    }

    // File tree takes priority for shell commands like tree, ls -la, etc.
    if (type === 'shell' && isFileTree) {
      return <FileTreeBlock content={content} />;
    }

    // Agent responses with markdown
    if (type === 'agent' && hasMarkdown) {
      return <MarkdownMessage content={content} className="text-sm" />;
    }

    // Default: monospace pre
    return (
      <pre className="font-mono text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words leading-relaxed">
        {content}
      </pre>
    );
  };

  // Don't render content section if there's nothing to show
  const contentElement = renderContent();
  const hasContent = contentElement !== null;

  return (
    <div className={blockClasses} data-block-id={id}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] cursor-pointer select-none hover:bg-[var(--bg-elevated)]/80 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setCollapsed(!collapsed)}
      >
        <span className={`font-mono text-sm font-medium ${promptClass}`}>
          {type === 'shell' ? '>' : '@'}
        </span>

        <span className="flex-1 font-mono text-sm text-[var(--text-primary)] truncate">{command}</span>

        <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
          {duration !== undefined && (
            <span className="text-xs">{(duration / 1000).toFixed(1)}s</span>
          )}
          {statusIcon}
          {hasContent && (
            <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${chevronClass}`} />
          )}
        </div>
      </div>

      {/* Content */}
      {!collapsed && hasContent && (
        <>
          <div
            ref={contentRef}
            className="p-3 overflow-x-auto"
          >
            {contentElement}
          </div>

          {/* Actions bar - always visible when there's content */}
          {content && (
            <div className="flex gap-2 px-3 py-2 border-t border-[var(--border-subtle)]">
              {/* Copy button */}
              <button
                type="button"
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-all duration-200
                  ${copied
                    ? 'text-[var(--accent-emerald)] bg-[var(--accent-emerald)]/15 border border-[var(--accent-emerald)]/40'
                    : 'text-[var(--text-secondary)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)] hover:border-[var(--border-focus)]'
                  }
                `}
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>

              {/* Apply button (for agent responses) */}
              {onApply && (
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--bg-base)] bg-[var(--accent-sky)] rounded hover:opacity-90 transition-opacity"
                  onClick={handleApply}
                >
                  <Play className="w-3.5 h-3.5" />
                  Apply
                </button>
              )}

              {/* Custom actions */}
              {actions}
            </div>
          )}
        </>
      )}

      {/* CSS for flash animation */}
      <style jsx>{`
        .output-block--copied {
          animation: copy-flash 300ms ease-out;
        }
        @keyframes copy-flash {
          0% { border-color: var(--accent-emerald); box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2); }
          100% { border-color: var(--border-subtle); box-shadow: none; }
        }
      `}</style>
    </div>
  );
}
