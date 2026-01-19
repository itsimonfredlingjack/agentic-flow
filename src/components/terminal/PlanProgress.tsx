"use client";

import React from 'react';

interface PlanProgressProps {
  completed: number;
  total: number;
}

export function PlanProgress({ completed, total }: PlanProgressProps) {
  const percent = total > 0 ? (completed / total) * 100 : 0;
  const isComplete = completed === total && total > 0;

  return (
    <div className="plan-progress">
      <div className="plan-progress__header">
        <span className="plan-progress__title">EXECUTION PLAN</span>
        <span className={`plan-progress__count ${isComplete ? 'plan-progress__count--complete' : ''}`}>
          {completed}/{total}
        </span>
      </div>
      <div className="plan-progress__bar">
        <div 
          className={`plan-progress__fill ${isComplete ? 'plan-progress__fill--complete' : ''}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
