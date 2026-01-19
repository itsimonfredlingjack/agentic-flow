"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, type Transition } from 'framer-motion';
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

// Snappy spring animation
const snapSpring: Transition = { type: 'spring', stiffness: 500, damping: 30 };
const gentleSpring: Transition = { type: 'spring', stiffness: 400, damping: 25 };

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
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

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

  const borderColor = {
    running: 'var(--accent-sky)',
    success: 'var(--accent-emerald)',
    error: 'var(--accent-rose)',
    idle: 'var(--border-subtle)',
  }[status];

  const promptClass = type === 'shell'
    ? 'text-[var(--accent-emerald)]'
    : 'text-[var(--accent-violet)]';

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
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
        setTimeout(() => setCopied(false), 2000);
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
    if (!content && status === 'running') {
      return (
        <div className="flex items-center gap-2 text-[var(--text-tertiary)] text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Running...</span>
        </div>
      );
    }

    if (!content && (status === 'idle' || status === 'success')) {
      return null;
    }

    if (!content && status === 'error') {
      return <span className="text-[var(--accent-rose)] text-sm">Command failed with no output</span>;
    }

    if (type === 'shell' && isFileTree) {
      return <FileTreeBlock content={content} />;
    }

    if (type === 'agent' && hasMarkdown) {
      return <MarkdownMessage content={content} className="text-sm" />;
    }

    return (
      <pre className="font-mono text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words leading-relaxed">
        {content}
      </pre>
    );
  };

  const contentElement = renderContent();
  const hasContent = contentElement !== null;

  return (
    <motion.div
      className="output-block"
      data-block-id={id}
      style={{
        borderColor: borderColor,
        boxShadow: status === 'running'
          ? `0 0 12px 0 ${borderColor}40`
          : status === 'success'
          ? `0 0 8px 0 ${borderColor}30`
          : status === 'error'
          ? `0 0 8px 0 ${borderColor}30`
          : 'none'
      }}
      // Only animate border/shadow changes, not entry
      animate={{
        borderColor: borderColor,
      }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <motion.div
        className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] cursor-pointer select-none hover:bg-[var(--bg-elevated)]/80 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setCollapsed(!collapsed)}
        whileTap={{ scale: 0.995 }}
      >
        <span className={`font-mono text-sm font-medium ${promptClass}`}>
          {type === 'shell' ? '>' : '@'}
        </span>

        <span className="flex-1 font-mono text-sm text-[var(--text-primary)] truncate">{command}</span>

        <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
          {duration !== undefined && (
            <span className="text-xs">{(duration / 1000).toFixed(1)}s</span>
          )}
          
          {/* Animated status icon */}
          <AnimatePresence mode="wait">
            {statusIcon && (
              <motion.span
                key={status}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={snapSpring}
              >
                {statusIcon}
              </motion.span>
            )}
          </AnimatePresence>

          {hasContent && (
            <motion.div
              animate={{ rotate: collapsed ? -90 : 0 }}
              transition={{ duration: 0.15 }}
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Content */}
      {!collapsed && hasContent && (
        <>
          <div
            ref={contentRef}
            className="p-3 overflow-x-auto"
          >
            {contentElement}
          </div>

          {/* Actions bar */}
          {content && (
            <div className="flex gap-2 px-3 py-2 border-t border-[var(--border-subtle)]">
                {/* Copy button */}
                <motion.button
                  type="button"
                  className={`
                    flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-all duration-200
                    ${copied
                      ? 'text-[var(--accent-emerald)] bg-[var(--accent-emerald)]/15 border border-[var(--accent-emerald)]/40'
                      : 'text-[var(--text-secondary)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)] hover:border-[var(--border-focus)]'
                    }
                  `}
                  onClick={handleCopy}
                  whileTap={{ scale: 0.95 }}
                >
                  <AnimatePresence mode="wait">
                    {copied ? (
                      <motion.span
                        key="copied"
                        className="flex items-center gap-1.5"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                      >
                        <Check className="w-3.5 h-3.5" />
                        Copied!
                      </motion.span>
                    ) : (
                      <motion.span
                        key="copy"
                        className="flex items-center gap-1.5"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>

                {/* Apply button */}
                {onApply && (
                  <motion.button
                    type="button"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--bg-base)] bg-[var(--accent-sky)] rounded hover:opacity-90 transition-opacity"
                    onClick={handleApply}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Play className="w-3.5 h-3.5" />
                    Apply
                  </motion.button>
                )}

                {/* Custom actions */}
                {actions}
              </div>
            )}
          </>
        )}
    </motion.div>
  );
}
