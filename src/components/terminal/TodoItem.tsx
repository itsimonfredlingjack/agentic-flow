"use client";

import React from 'react';
import type { TodoStatus } from '@/types';

interface TodoItemProps {
  text: string;
  status: TodoStatus;
  isNew?: boolean;
}

// Status config: LED class, bracket marker, item class
const STATUS_CONFIG: Record<TodoStatus, {
  ledClass: string;
  marker: string;
  itemClass: string;
}> = {
  pending: {
    ledClass: 'todo-item__led--pending',
    marker: '[ ]',
    itemClass: 'todo-item--pending',
  },
  active: {
    ledClass: 'todo-item__led--active',
    marker: '[>]',
    itemClass: 'todo-item--active',
  },
  complete: {
    ledClass: 'todo-item__led--complete',
    marker: '[x]',
    itemClass: 'todo-item--complete',
  },
  struck: {
    ledClass: 'todo-item__led--struck',
    marker: '[~]',
    itemClass: 'todo-item--struck',
  },
};

export function TodoItem({ text, status, isNew = false }: TodoItemProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className={`todo-item ${config.itemClass} ${isNew ? 'todo-item--entering' : ''}`}>
      <span className={`todo-item__led ${config.ledClass}`} />
      <span className="todo-item__marker">{config.marker}</span>
      <span className="todo-item__text">{text}</span>
    </div>
  );
}
