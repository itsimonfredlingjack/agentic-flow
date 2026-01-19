"use client";

import React, { useMemo } from 'react';
import { PlanTask } from './PlanTask';
import { PlanProgress } from './PlanProgress';
import { calculateProgress } from '@/lib/planParser';
import type { PlanTask as PlanTaskType } from '@/types';

interface ExecutionPlanProps {
  tasks: PlanTaskType[];
  newTaskIds?: Set<string>;
}

export function ExecutionPlan({ tasks, newTaskIds = new Set() }: ExecutionPlanProps) {
  // Calculate progress
  const { completed, total } = useMemo(() => calculateProgress(tasks), [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="execution-plan">
        <PlanProgress completed={0} total={0} />
        <div className="execution-plan__empty">
          <span className="execution-plan__empty-icon">◎</span>
          <span>Awaiting plan...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="execution-plan">
      <PlanProgress completed={completed} total={total} />
      
      <div className="execution-plan__tasks">
        {tasks.map((task) => (
          <div key={task.id} className="execution-plan__task-group">
            <PlanTask
              text={task.text}
              status={task.status}
              isNew={newTaskIds.has(task.id)}
            />
            
            {task.children && task.children.map((child, idx) => (
              <PlanTask
                key={child.id}
                text={child.text}
                status={child.status}
                isChild={true}
                isLastChild={idx === task.children!.length - 1}
                isNew={newTaskIds.has(child.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
