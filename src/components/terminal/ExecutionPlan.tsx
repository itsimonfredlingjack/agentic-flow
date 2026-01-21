"use client";

import React from 'react';
import { Circle, CheckCircle2, Loader2 } from 'lucide-react';

export interface ExecutionTask {
  id: string;
  text: string;
  status: 'pending' | 'in-progress' | 'completed';
  eta?: string;
  progress?: number;
}

interface ExecutionPlanProps {
  tasks: ExecutionTask[];
  title?: string;
  onSelectTask?: (task: ExecutionTask) => void;
}

export function ExecutionPlan({ tasks, title = "EXECUTION PLAN", onSelectTask }: ExecutionPlanProps) {
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;
  const nowTasks = tasks.filter(t => t.status === 'in-progress');
  const nextTasks = tasks.filter(t => t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  const renderTasks = (groupTasks: ExecutionTask[]) => {
    if (groupTasks.length === 0) {
      return (
        <div className="plan-task plan-task--empty">
          <span className="plan-task__text text-[var(--text-tertiary)] italic">
            Empty
          </span>
        </div>
      );
    }

    return groupTasks.map((task) => {
      const normalizedProgress = typeof task.progress === 'number'
        ? Math.min(Math.max(task.progress, 0), 1)
        : task.status === 'completed'
          ? 1
          : task.status === 'in-progress'
            ? 0.25
            : 0;
      const width = 10;
      const filled = Math.round(normalizedProgress * width);
      const bar = `${'█'.repeat(filled)}${'░'.repeat(Math.max(width - filled, 0))}`;
      const percent = Math.round(normalizedProgress * 100);

      return (
      <div key={task.id} className="execution-plan__task-group">
        <button
          type="button"
          className={`plan-task plan-task--${task.status} ${onSelectTask ? 'plan-task--interactive' : ''}`}
          onClick={() => onSelectTask?.(task)}
        >
          <span className={`plan-task__led plan-task__led--${task.status}`} />
          <span className="plan-task__icon">
            {task.status === 'completed' ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : task.status === 'in-progress' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Circle className="w-3 h-3" />
            )}
          </span>
          <span className="plan-task__text">{task.text}</span>
          <span className="plan-task__bar">[{bar}]</span>
          <span className="plan-task__percent">{percent}%</span>
          {task.eta && <span className="plan-task__eta">{task.eta}</span>}
          {task.status === 'completed' && <span className="plan-task__done">✓ DONE</span>}
        </button>
      </div>
      );
    });
  };

  const asciiBar = () => {
    const width = 12;
    const filled = Math.round((progress / 100) * width);
    const bar = `${'█'.repeat(filled)}${'░'.repeat(Math.max(width - filled, 0))}`;
    return `[${bar}] ${Math.round(progress)}%`;
  };

  return (
    <div className="execution-plan">
      {/* Progress Header */}
      <div className="plan-progress">
        <div className="plan-progress__header">
          <span className="plan-progress__title">{title}</span>
          <span className="plan-progress__count">
            {completedCount}/{tasks.length}
          </span>
        </div>
        <div className="plan-progress__bar">
          <div
            className="plan-progress__fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="plan-progress__ascii">{asciiBar()}</div>
      </div>

      {/* Task List */}
      <div className="execution-plan__tasks">
        {tasks.length === 0 ? (
          <div className="plan-task plan-task--empty">
            <span className="plan-task__text text-[var(--text-tertiary)] italic">
              No tasks yet
            </span>
          </div>
        ) : (
          <>
            <div className="execution-plan__section">
              <div className="execution-plan__section-title">NOW</div>
              {renderTasks(nowTasks)}
            </div>
            <div className="execution-plan__section">
              <div className="execution-plan__section-title">NEXT</div>
              {renderTasks(nextTasks)}
            </div>
            <div className="execution-plan__section">
              <div className="execution-plan__section-title">COMPLETED</div>
              {renderTasks(completedTasks)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
