"use client";

import React from 'react';
import type { TodoPhase } from '@/types';

interface PhaseDividerProps {
  phase: TodoPhase;
}

const PHASE_LABELS: Record<TodoPhase, string> = {
  PLAN: 'Plan',
  BUILD: 'Build',
  REVIEW: 'Review',
  DEPLOY: 'Deploy',
};

export function PhaseDivider({ phase }: PhaseDividerProps) {
  return (
    <div className={`phase-divider phase-divider--${phase}`}>
      <div className="phase-divider__line" />
      <span className="phase-divider__label">{PHASE_LABELS[phase]}</span>
      <div className="phase-divider__line" />
    </div>
  );
}
