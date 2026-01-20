"use client";

import React, { useMemo, useState } from 'react';
import { Zap } from 'lucide-react';

interface TokenCounterProps {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  maxTokens?: number;
  warnAt?: number;
}

export function TokenCounter({
  inputTokens = 0,
  outputTokens = 0,
  totalTokens,
  maxTokens,
  warnAt = 0.8,
}: TokenCounterProps) {
  const [isHovered, setIsHovered] = useState(false);
  const total = totalTokens ?? (inputTokens + outputTokens);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const { percent, isWarning, isCritical } = useMemo(() => {
    if (!maxTokens || maxTokens <= 0) {
      return { ratio: 0, percent: 0, isWarning: false, isCritical: false };
    }
    const rawRatio = total / maxTokens;
    const clampedRatio = Math.min(rawRatio, 1);
    return {
      ratio: clampedRatio,
      percent: clampedRatio * 100,
      isWarning: rawRatio >= warnAt,
      isCritical: rawRatio >= 1,
    };
  }, [maxTokens, total, warnAt]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main badge - matches ModelSelector style exactly */}
      <div className="token-counter">
        <div className="token-counter__label">
          <Zap className="w-3.5 h-3.5 text-[var(--accent-amber)]" />
          <span className="text-xs font-medium text-[var(--text-primary)]">
            {formatNumber(total)}
          </span>
          <span className="text-xs text-[var(--text-tertiary)]">tokens</span>
        </div>
        {maxTokens ? (
          <div className="token-counter__bar">
            <div
              className={`token-counter__bar-fill${isCritical ? ' token-counter__bar-fill--critical' : isWarning ? ' token-counter__bar-fill--warning' : ''}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        ) : null}
      </div>

      {/* Hover dropdown - same style as ModelSelector dropdown */}
      {isHovered && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-xl overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
            <div className="text-xs font-medium text-[var(--text-tertiary)]">Token Usage</div>
          </div>
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">Input</span>
              <span className="text-xs font-medium text-[var(--accent-sky)]">{formatNumber(inputTokens)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">Output</span>
              <span className="text-xs font-medium text-[var(--accent-emerald)]">{formatNumber(outputTokens)}</span>
            </div>
            <div className="h-px bg-[var(--border-subtle)]" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">Total</span>
              <span className="text-xs font-medium text-[var(--text-primary)]">{formatNumber(total)}</span>
            </div>
            {maxTokens ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-secondary)]">Limit</span>
                  <span className="text-xs font-medium text-[var(--text-primary)]">{formatNumber(maxTokens)}</span>
                </div>
                <div className={`text-[10px] ${isCritical ? 'text-[var(--accent-rose)]' : isWarning ? 'text-[var(--accent-amber)]' : 'text-[var(--text-tertiary)]'}`}>
                  {isCritical ? 'Token limit exceeded' : isWarning ? 'Approaching token limit' : 'Within budget'}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
