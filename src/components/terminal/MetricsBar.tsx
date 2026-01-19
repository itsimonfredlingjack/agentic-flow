"use client";

import React, { useMemo } from 'react';
import type { SessionMetrics, PhaseMetrics } from '@/types';
import { Zap, Clock, CheckCircle, XCircle, ChevronUp, ChevronDown } from 'lucide-react';

interface MetricsBarProps {
  metrics: SessionMetrics;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Format token count with K suffix
function formatTokens(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

// Format milliseconds to human readable
function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  return `${minutes}m ${remainingSecs}s`;
}

// Phase display config
const PHASE_CONFIG: Record<string, { label: string; color: string }> = {
  PLAN: { label: 'PLAN', color: 'var(--agent-architect)' },
  BUILD: { label: 'BUILD', color: 'var(--agent-engineer)' },
  REVIEW: { label: 'REVIEW', color: 'var(--agent-critic)' },
  DEPLOY: { label: 'DEPLOY', color: 'var(--agent-deployer)' },
};

export function MetricsBar({ metrics, isCollapsed = false, onToggleCollapse }: MetricsBarProps) {
  // Calculate overall success rate
  const { successRate, totalRequests } = useMemo(() => {
    let successes = 0;
    let total = 0;
    
    Object.values(metrics.phases).forEach((phase: PhaseMetrics) => {
      successes += phase.successes;
      total += phase.requests;
    });
    
    const rate = total > 0 ? Math.round((successes / total) * 100) : 0;
    return { successRate: rate, totalRequests: total };
  }, [metrics.phases]);

  // Get active phases with time
  const phaseTimings = useMemo(() => {
    return Object.entries(metrics.phases)
      .filter(([_, phase]) => phase.elapsedMs > 0 || phase.startTime !== null)
      .map(([key, phase]) => ({
        key,
        ...PHASE_CONFIG[key],
        time: phase.elapsedMs,
        isActive: phase.startTime !== null && phase.endTime === null,
      }));
  }, [metrics.phases]);

  if (isCollapsed) {
    return (
      <div className="metrics-bar metrics-bar--collapsed" onClick={onToggleCollapse}>
        <div className="metrics-bar__collapsed-content">
          <span className="metrics-bar__collapsed-item">
            <Zap className="metrics-bar__icon" />
            {formatTokens(metrics.totalTokens)}
          </span>
          <span className="metrics-bar__collapsed-item">
            <CheckCircle className="metrics-bar__icon metrics-bar__icon--success" />
            {successRate}%
          </span>
          <ChevronDown className="metrics-bar__toggle-icon" />
        </div>
      </div>
    );
  }

  return (
    <div className="metrics-bar">
      {/* Tokens */}
      <div className="metrics-bar__section">
        <Zap className="metrics-bar__icon metrics-bar__icon--tokens" />
        <span className="metrics-bar__value">{formatTokens(metrics.totalTokens)}</span>
        <span className="metrics-bar__label">tokens</span>
      </div>

      {/* Divider */}
      <div className="metrics-bar__divider" />

      {/* Phase Timings */}
      <div className="metrics-bar__section metrics-bar__section--phases">
        <Clock className="metrics-bar__icon" />
        <div className="metrics-bar__phases">
          {phaseTimings.length === 0 ? (
            <span className="metrics-bar__label">No activity</span>
          ) : (
            phaseTimings.map(({ key, label, color, time, isActive }) => (
              <span 
                key={key} 
                className={`metrics-bar__phase ${isActive ? 'metrics-bar__phase--active' : ''}`}
                style={{ '--phase-color': color } as React.CSSProperties}
              >
                <span className="metrics-bar__phase-label">{label}</span>
                <span className="metrics-bar__phase-time">
                  {isActive ? (
                    <span className="metrics-bar__phase-live">●</span>
                  ) : null}
                  {formatTime(time)}
                </span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="metrics-bar__divider" />

      {/* Success Rate */}
      <div className="metrics-bar__section">
        {successRate >= 70 ? (
          <CheckCircle className="metrics-bar__icon metrics-bar__icon--success" />
        ) : (
          <XCircle className="metrics-bar__icon metrics-bar__icon--error" />
        )}
        <span className={`metrics-bar__value ${successRate >= 70 ? 'metrics-bar__value--success' : 'metrics-bar__value--error'}`}>
          {successRate}%
        </span>
        <span className="metrics-bar__label">success</span>
        {totalRequests > 0 && (
          <span className="metrics-bar__subtext">({totalRequests} req)</span>
        )}
      </div>

      {/* Collapse Toggle */}
      {onToggleCollapse && (
        <button className="metrics-bar__toggle" onClick={onToggleCollapse} title="Collapse metrics">
          <ChevronUp className="metrics-bar__toggle-icon" />
        </button>
      )}
    </div>
  );
}
