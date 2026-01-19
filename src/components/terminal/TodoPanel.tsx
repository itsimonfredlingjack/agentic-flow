"use client";

import React, { useMemo } from 'react';
import { TodoItem as TodoItemComponent } from './TodoItem';
import { PhaseDivider } from './PhaseDivider';
import type { TodoItem, TodoPhase } from '@/types';

interface TodoPanelProps {
  todos: TodoItem[];
  currentPhase: TodoPhase;
  newTodoIds?: Set<string>;
}

export function TodoPanel({ todos, currentPhase, newTodoIds = new Set() }: TodoPanelProps) {
  // Group todos by phase
  const todosByPhase = useMemo(() => {
    const groups: Partial<Record<TodoPhase, TodoItem[]>> = {};

    for (const todo of todos) {
      if (!groups[todo.phase]) {
        groups[todo.phase] = [];
      }
      groups[todo.phase]!.push(todo);
    }

    return groups;
  }, [todos]);

  // Phase order for display
  const phases: TodoPhase[] = ['PLAN', 'BUILD', 'REVIEW', 'DEPLOY'];
  const activePhases = phases.filter(p => todosByPhase[p]?.length);

  // Count completed vs total
  const completedCount = todos.filter(t => t.status === 'complete').length;

  if (todos.length === 0) {
    return (
      <div className="todo-panel">
        <div className="todo-panel__header">
          <span className="todo-panel__title">Tasks</span>
        </div>
        <div className="todo-panel__empty">No tasks yet</div>
      </div>
    );
  }

  return (
    <div className="todo-panel">
      <div className="todo-panel__header">
        <span className="todo-panel__title">Tasks</span>
        <span className="todo-panel__count">{completedCount}/{todos.length}</span>
      </div>

      {activePhases.map((phase, idx) => (
        <React.Fragment key={phase}>
          {idx > 0 && <PhaseDivider phase={phase} />}

          {todosByPhase[phase]?.map(todo => (
            <TodoItemComponent
              key={todo.id}
              text={todo.text}
              status={todo.status}
              isNew={newTodoIds.has(todo.id)}
            />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}
