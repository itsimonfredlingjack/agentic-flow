"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, type Transition } from 'framer-motion';
import { ChevronDown, Check, AlertTriangle, Loader2, Copy, Play } from 'lucide-react';
import { MarkdownMessage } from '@/components/MarkdownMessage';
import { FileTreeBlock, isFileTreeContent } from './FileTreeBlock';
import type { RoleId } from './RoleSelector';

export type BlockType = 'shell' | 'agent';
export type BlockStatus = 'running' | 'success' | 'error' | 'idle';

// Animation configs
const snapSpring: Transition = { type: 'spring', stiffness: 500, damping: 30 };
const gentleSpring: Transition = { type: 'spring', stiffness: 400, damping: 25 };

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
  agentRole?: RoleId;
  agentLabel?: string;
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
  agentRole,
  agentLabel,
  onApply,
  onCopy,
}: OutputBlockProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [copied, setCopied] = useState(false);
  const [prevStatus, setPrevStatus] = useState(status);
  const [animateStatus, setAnimateStatus] = useState<'success' | 'error' | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const displayedRef = useRef(content);
  const [displayedContent, setDisplayedContent] = useState(content);
  const [isTyping, setIsTyping] = useState(false);
  const formattedTimestamp = timestamp && /^\d{2}:\d{2}$/.test(timestamp)
    ? `${timestamp}:00`
    : timestamp;
  const roleHandle: Record<RoleId, string> = {
    PLAN: 'architect',
    BUILD: 'engineer',
    REVIEW: 'critic',
    DEPLOY: 'deployer',
  };

  // Track status changes for animations
  useEffect(() => {
    if (status !== prevStatus) {
      if (status === 'success' && prevStatus === 'running') {
        setAnimateStatus('success');
        setTimeout(() => setAnimateStatus(null), 300);
      } else if (status === 'error') {
        setAnimateStatus('error');
        setTimeout(() => setAnimateStatus(null), 300);
      }
      setPrevStatus(status);
    }
  }, [status, prevStatus]);

  // Auto-scroll to bottom when content updates
  useEffect(() => {
    if (!collapsed && contentRef.current && status === 'running') {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, collapsed, status]);

  const updateDisplayed = (value: string) => {
    displayedRef.current = value;
    setDisplayedContent(value);
  };

  const statusIcon = {
    running: <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-sky)]" />,
    success: (
      <motion.div
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={snapSpring}
      >
        <Check className="w-3.5 h-3.5 text-[var(--accent-emerald)]" />
      </motion.div>
    ),
    error: (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
        transition={{ duration: 0.3 }}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-[var(--accent-rose)]" />
      </motion.div>
    ),
    idle: null,
  }[status];

  const blockClasses = [
    'output-block',
    status === 'running' && 'output-block--running',
    status === 'error' && 'output-block--error',
    copied && 'output-block--copied',
  ].filter(Boolean).join(' ');

  const promptClass = 'text-[var(--terminal-green)]';

  const roleClass = agentRole ? `output-block__role output-block__role--${agentRole.toLowerCase()}` : '';
  const statusLabel = status === 'idle' ? 'idle' : status;

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

  useEffect(() => {
    if (!content) {
      updateDisplayed(content);
      setIsTyping(false);
      return;
    }

    if (type !== 'agent' || status === 'running' || isFileTree) {
      updateDisplayed(content);
      setIsTyping(false);
      return;
    }

    const total = content.length;
    const current = displayedRef.current;
    let index = current && content.startsWith(current) ? current.length : 0;

    if (index >= total) {
      updateDisplayed(content);
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
    const stepSize = total > 2200 ? 4 : total > 1200 ? 2 : 1;
    const delay = 30;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      index = Math.min(index + stepSize, total);
      updateDisplayed(content.slice(0, index));
      if (index < total) {
        timer = setTimeout(tick, delay);
      } else {
        setIsTyping(false);
      }
    };

    timer = setTimeout(tick, delay);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [content, status, type, isFileTree]);

  // Render content based on type
  const commandHandle = agentRole ? roleHandle[agentRole] : 'terminal';
  const commandLine = `${commandHandle}@llm-creative:~$ ${command}`;
  const statusBadge = status !== 'idle' ? statusLabel.toUpperCase() : '';

  const renderCommandLine = () => (
    <div className="terminal-line terminal-line--command">
      {formattedTimestamp && (
        <span className="terminal-line__ts">[{formattedTimestamp}]</span>
      )}
      {agentLabel && (
        <span className="terminal-line__role">{agentLabel.toUpperCase()}</span>
      )}
      <span className="terminal-line__cmd">{commandLine}</span>
      {statusBadge && (
        <span className={`terminal-line__status terminal-line__status--${status}`}>{statusBadge}</span>
      )}
    </div>
  );

  const renderContent = () => {
    if (!content && status === 'running') {
      return (
        <div className="terminal-output">
          {renderCommandLine()}
          <div className="terminal-line">
            {formattedTimestamp && (
              <span className="terminal-line__ts">[{formattedTimestamp}]</span>
            )}
            <span className="terminal-line__text terminal-line__text--running">
              Running...
            </span>
          </div>
        </div>
      );
    }

    if (!content && (status === 'idle' || status === 'success')) {
      return null;
    }

    if (!content && status === 'error') {
      return (
        <div className="terminal-output">
          {renderCommandLine()}
          <div className="terminal-line">
            {formattedTimestamp && (
              <span className="terminal-line__ts">[{formattedTimestamp}]</span>
            )}
            <span className="terminal-line__text terminal-line__text--error">
              bash: {command}: command not found
            </span>
          </div>
        </div>
      );
    }

    if (type === 'shell' && isFileTree) {
      return (
        <div className="terminal-output">
          {renderCommandLine()}
          <div className="terminal-output__body">
            <FileTreeBlock content={content} />
          </div>
        </div>
      );
    }

    if (type === 'agent' && hasMarkdown) {
      return (
        <div className="terminal-output terminal-output--markdown">
          {renderCommandLine()}
          <div className="terminal-output__body">
            <MarkdownMessage
              content={displayedContent}
              className="text-sm"
              timestampLabel={formattedTimestamp}
              showTimestamps
            />
          </div>
        </div>
      );
    }

    const lines = (displayedContent || '').split('\n');

    return (
      <div className="terminal-output">
        {renderCommandLine()}
        {lines.map((line, index) => {
          const lower = line.toLowerCase();
          const inferredTone = lower.includes('error') || lower.includes('failed')
            ? 'error'
            : lower.includes('warn')
              ? 'warning'
              : lower.includes('success') || lower.includes('complete')
                ? 'success'
                : status;

          return (
          <div key={`${id}-line-${index}`} className="terminal-line">
            {formattedTimestamp && (
              <span className="terminal-line__ts">[{formattedTimestamp}]</span>
            )}
            <span className={`terminal-line__text terminal-line__text--${inferredTone}`}>
              {line.length > 0 ? line : '\u00A0'}
            </span>
          </div>
          );
        })}
        {isTyping && <span className="terminal-line__typing">█</span>}
      </div>
    );
  };

  const contentElement = renderContent();
  const hasContent = contentElement !== null;

  // Get animate props based on status
  const getAnimateProps = () => {
    const base = { opacity: 1, y: 0, scale: 1 };
    if (animateStatus === 'success') {
      return { ...base, scale: [1, 1.02, 1] };
    }
    if (animateStatus === 'error') {
      return { ...base, x: [0, -4, 4, -4, 4, 0] };
    }
    return base;
  };

  return (
    <motion.div
      className={blockClasses}
      data-block-id={id}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={getAnimateProps()}
      transition={snapSpring}
      layout
    >
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

        {agentLabel && (
          <span className={roleClass}>
            {agentLabel}
          </span>
        )}

        <span className="flex-1 font-mono text-sm text-[var(--text-primary)] truncate">{command}</span>

        <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
          <span className={`output-block__status output-block__status--${status}`}>{statusLabel}</span>
          {duration !== undefined && (
            <span className="text-xs">{(duration / 1000).toFixed(1)}s</span>
          )}
          {statusIcon}
          {hasContent && (
            <motion.div
              animate={{ rotate: collapsed ? -90 : 0 }}
              transition={snapSpring}
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          )}
        </div>
      </div>

      {/* Content */}
      {!collapsed && hasContent && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={gentleSpring}
        >
          <div ref={contentRef} className="p-3 overflow-x-auto">
            {contentElement}
          </div>

          {/* Actions bar */}
          {content && (
            <div className="flex gap-2 px-3 py-2 border-t border-[var(--border-subtle)]">
              <motion.button
                type="button"
                className={`terminal-action ${copied ? 'terminal-action--active' : ''}`}
                onClick={handleCopy}
                whileTap={{ scale: 0.95 }}
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
              </motion.button>

              {onApply && (
                <motion.button
                  type="button"
                  className="terminal-action terminal-action--primary"
                  onClick={handleApply}
                  whileTap={{ scale: 0.95 }}
                >
                  <Play className="w-3.5 h-3.5" />
                  Apply
                </motion.button>
              )}

              {actions}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
