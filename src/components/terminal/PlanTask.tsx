"use client";

import React from 'react';
import type { TaskStatus } from '@/types';

interface PlanTaskProps {
  text: string;
  status: TaskStatus;
  isChild?: boolean;
  isLastChild?: boolean;
  isNew?: boolean;
}

// Status config: LED class, icon, color classes
const STATUS_CONFIG: Record<TaskStatus, {
  ledClass: string;
  icon: string;
  textClass: string;
}> = {
  pending: {
    ledClass: 'plan-task__led--pending',
    icon: '○',
    textClass: 'plan-task--pending',
  },
  active: {
    ledClass: 'plan-task__led--active',
    icon: '▶',
    textClass: 'plan-task--active',
  },
  complete: {
    ledClass: 'plan-task__led--complete',
    icon: '✓',
    textClass: 'plan-task--complete',
  },
  failed: {
    ledClass: 'plan-task__led--failed',
    icon: '✗',
    textClass: 'plan-task--failed',
  },
  skipped: {
    ledClass: 'plan-task__led--skipped',
    icon: '~',
    textClass: 'plan-task--skipped',
  },
};

export function PlanTask({ 
  text, 
  status, 
  isChild = false, 
  isLastChild = false,
  isNew = false 
}: PlanTaskProps) {
  const config = STATUS_CONFIG[status];
  const connector = isChild ? (isLastChild ? '└─' : '├─') : '';

  return (
    <div className={`plan-task py-1 text-sm ${config.textClass} ${isNew ? 'plan-task--entering' : ''}`}>
      {isChild && (
        <span className="plan-task__connector">{connector}</span>
      )}
      <span className={`plan-task__led ${config.ledClass}`} />
      <span className="plan-task__icon">{config.icon}</span>
      <span className="plan-task__text">{text}</span>
    </div>
  );
}
