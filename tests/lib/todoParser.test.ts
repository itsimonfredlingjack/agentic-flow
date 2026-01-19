import { describe, it, expect } from 'vitest';
import { parseTodos, matchTodoUpdate, type TodoMatch } from '@/lib/todoParser';
import type { TodoItem, TodoStatus, TodoPhase } from '@/types';

describe('parseTodos', () => {
  it('parses markdown checkbox items', () => {
    const text = `
## Implementation Plan
- [ ] Create component structure
- [ ] Add state management
- [ ] Write tests
`;
    const result = parseTodos(text, 'PLAN');

    expect(result.todos).toHaveLength(3);
    expect(result.todos[0]).toMatchObject({
      text: 'Create component structure',
      status: 'pending',
      phase: 'PLAN',
    });
  });

  it('parses different status markers', () => {
    const text = `
- [ ] Pending task
- [>] Active task
- [x] Complete task
- [~] Struck task
`;
    const result = parseTodos(text, 'BUILD');

    expect(result.todos[0].status).toBe('pending');
    expect(result.todos[1].status).toBe('active');
    expect(result.todos[2].status).toBe('complete');
    expect(result.todos[3].status).toBe('struck');
  });

  it('detects phase completion handoff', () => {
    const text = `
All planning tasks complete. Handing off to Engineer.
- [x] Design architecture
- [x] Define interfaces
`;
    const result = parseTodos(text, 'PLAN');

    expect(result.phaseComplete).toBe(true);
    expect(result.handoffMessage).toContain('Engineer');
  });

  it('handles numbered lists', () => {
    const text = `
1. [ ] First item
2. [ ] Second item
`;
    const result = parseTodos(text, 'PLAN');

    expect(result.todos).toHaveLength(2);
    expect(result.todos[0].text).toBe('First item');
  });
});

describe('matchTodoUpdate', () => {
  const existingTodos: TodoItem[] = [
    { id: '1', text: 'Create component structure', status: 'pending', phase: 'PLAN', createdAt: 0, updatedAt: 0 },
    { id: '2', text: 'Add state management', status: 'pending', phase: 'PLAN', createdAt: 0, updatedAt: 0 },
  ];

  it('matches exact text', () => {
    const match = matchTodoUpdate('Create component structure', existingTodos);

    expect(match).not.toBeNull();
    expect(match?.todo.id).toBe('1');
    expect(match?.confidence).toBe(1.0);
  });

  it('matches fuzzy text above 95% threshold', () => {
    // "Create component structur" is 1 char off from "Create component structure" = ~96% similar
    const match = matchTodoUpdate('Create component structur', existingTodos);

    expect(match).not.toBeNull();
    expect(match?.todo.id).toBe('1');
    expect(match?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('returns null for low confidence matches', () => {
    const match = matchTodoUpdate('Completely different text', existingTodos);

    expect(match).toBeNull();
  });

  it('handles case insensitivity', () => {
    const match = matchTodoUpdate('CREATE COMPONENT STRUCTURE', existingTodos);

    expect(match).not.toBeNull();
    expect(match?.todo.id).toBe('1');
  });
});
