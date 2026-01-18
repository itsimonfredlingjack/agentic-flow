"use client";

import React, { useState, useEffect, useRef } from 'react';

export type AgentStatus = 'ready' | 'thinking' | 'running' | 'error';

interface StatusPillProps {
  status: AgentStatus;
  agentName?: string;
  modelName?: string;
  sessionId?: string;
  onClick?: () => void;
}

const STATUS_CONFIG = {
  ready: { label: 'Ready', dotClass: 'status-pill__dot--ready' },
  thinking: { label: 'Thinking', dotClass: 'status-pill__dot--thinking' },
  running: { label: 'Running', dotClass: 'status-pill__dot--running' },
  error: { label: 'Error', dotClass: 'status-pill__dot--error' },
} as const;

export function StatusPill({
  status,
  agentName,
  modelName,
  sessionId,
  onClick,
}: StatusPillProps) {
  const [expanded, setExpanded] = useState(false);
  const [shouldPulse, setShouldPulse] = useState(false);
  const prevStatusRef = useRef(status);
  const pillRef = useRef<HTMLDivElement>(null);

  // Pulse animation on status change
  useEffect(() => {
    if (prevStatusRef.current !== status) {
      setShouldPulse(true);
      const timer = setTimeout(() => setShouldPulse(false), 150);
      prevStatusRef.current = status;
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Close expanded view when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pillRef.current && !pillRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    if (expanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [expanded]);

  const config = STATUS_CONFIG[status];
  const pillClass = shouldPulse ? 'status-pill status-pill--pulse' : 'status-pill';

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setExpanded(!expanded);
    }
  };

  return (
    <div className="relative" ref={pillRef}>
      <div
        className={pillClass}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      >
        <span className={`status-pill__dot ${config.dotClass}`} />
        <span>{config.label}</span>
      </div>

      {expanded && (agentName || modelName || sessionId) && (
        <div 
          className="absolute right-0 top-full mt-2 p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-lg z-50 min-w-[180px]"
          style={{ animation: 'slide-up 150ms var(--ease-out)' }}
        >
          {agentName && (
            <div className="flex justify-between items-center mb-2">
              <span className="text-[var(--text-tertiary)] text-xs">Agent</span>
              <span className="text-[var(--text-primary)] text-sm font-medium">{agentName}</span>
            </div>
          )}
          {modelName && (
            <div className="flex justify-between items-center mb-2">
              <span className="text-[var(--text-tertiary)] text-xs">Model</span>
              <span className="text-[var(--text-secondary)] text-xs font-mono">{modelName}</span>
            </div>
          )}
          {sessionId && (
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-tertiary)] text-xs">Session</span>
              <span className="text-[var(--text-secondary)] text-xs font-mono">{sessionId}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
