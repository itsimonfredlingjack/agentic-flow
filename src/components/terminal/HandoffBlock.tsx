"use client";

import React from 'react';
import { Check, ArrowRight, Compass, Wrench, Eye, Rocket } from 'lucide-react';
import type { RoleId } from './RoleSelector';

interface HandoffBlockProps {
  completedPhase: string;
  completedRole: RoleId;
  nextRole: RoleId;
  message?: string;
  onSwitch: () => void;
}

const ROLE_CONFIG: Record<RoleId, {
  label: string;
  icon: React.ElementType;
  color: string;
  cssClass: string;
}> = {
  PLAN: { label: 'Architect', icon: Compass, color: 'var(--agent-architect)', cssClass: 'architect' },
  BUILD: { label: 'Engineer', icon: Wrench, color: 'var(--agent-engineer)', cssClass: 'engineer' },
  REVIEW: { label: 'Critic', icon: Eye, color: 'var(--agent-critic)', cssClass: 'critic' },
  DEPLOY: { label: 'Deployer', icon: Rocket, color: 'var(--agent-deployer)', cssClass: 'deployer' },
};

export function HandoffBlock({
  completedPhase,
  completedRole,
  nextRole,
  message,
  onSwitch,
}: HandoffBlockProps) {
  const nextConfig = ROLE_CONFIG[nextRole];
  const NextIcon = nextConfig.icon;

  return (
    <div className={`handoff-block handoff-block--${nextConfig.cssClass}`}>
      {/* Header with checkmark */}
      <div className="handoff-block__header">
        <span className="handoff-block__check">
          <Check className="w-3 h-3" />
        </span>
        <span className="handoff-block__title">{completedPhase}</span>
      </div>

      {/* Message */}
      <p className="handoff-block__message">
        {message || `Ready for ${nextConfig.label.toLowerCase()} phase.`}
      </p>

      {/* TAB hint */}
      <div className="handoff-block__hint">
        Press <kbd>TAB</kbd> to switch to {nextConfig.label}
        <ArrowRight className="w-3 h-3" />
      </div>

      {/* Switch button */}
      <button
        onClick={onSwitch}
        className="handoff-block__button"
        style={{
          backgroundColor: nextConfig.color,
        }}
      >
        <NextIcon className="w-4 h-4" />
        Switch to {nextConfig.label}
      </button>
    </div>
  );
}
