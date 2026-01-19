import { describe, it, expect } from 'vitest';
import { parsePlanTasks, updateTaskStatus, calculateProgress, generateTaskId } from '@/lib/planParser';
import type { PlanTask, TaskStatus } from '@/types';

describe('parsePlanTasks', () => {
  it('parses single task', () => {
    const text = '- [ ] Create component';
    const result = parsePlanTasks(text);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      text: 'Create component',
      status: 'pending',
    });
    expect(result[0].id).toBeDefined();
  });

  it('parses all status markers', () => {
    const text = `- [ ] Pending task
- [>] Active task
- [x] Complete task
- [!] Failed task
- [~] Skipped task`;
    const result = parsePlanTasks(text);

    expect(result[0].status).toBe('pending');
    expect(result[1].status).toBe('active');
    expect(result[2].status).toBe('complete');
    expect(result[3].status).toBe('failed');
    expect(result[4].status).toBe('skipped');
  });

  it('parses nested tasks (two levels)', () => {
    const text = `- [ ] Parent task
  - [ ] Child task 1
  - [x] Child task 2
- [ ] Another parent`;
    const result = parsePlanTasks(text);

    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Parent task');
    expect(result[0].children).toHaveLength(2);
    expect(result[0].children![0].text).toBe('Child task 1');
    expect(result[0].children![1].status).toBe('complete');
    expect(result[1].text).toBe('Another parent');
    expect(result[1].children).toBeUndefined();
  });

  it('handles mixed indentation styles', () => {
    const text = `- [ ] Task with spaces
\t- [ ] Task with tab
    - [ ] Task with 4 spaces`;
    const result = parsePlanTasks(text);

    // All should parse, first is parent, others are children
    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(2);
  });

  it('ignores non-task lines', () => {
    const text = `## Implementation Plan
Some description text.

- [ ] Actual task
- Just a dash without checkbox
* [ ] Also valid with asterisk`;
    const result = parsePlanTasks(text);

    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Actual task');
    expect(result[1].text).toBe('Also valid with asterisk');
  });

  it('handles empty input', () => {
    const result = parsePlanTasks('');
    expect(result).toHaveLength(0);
  });

  it('handles malformed markers gracefully', () => {
    const text = `- [] Missing space
- [?] Unknown marker
- [ ] Valid task`;
    const result = parsePlanTasks(text);

    // Only valid task should parse
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Valid task');
  });
});

describe('updateTaskStatus', () => {
  it('updates status of a top-level task', () => {
    const tasks: PlanTask[] = [
      { id: 'task-1', text: 'Task 1', status: 'pending' },
      { id: 'task-2', text: 'Task 2', status: 'pending' },
    ];

    const updated = updateTaskStatus(tasks, 'task-1', 'complete');
    
    expect(updated[0].status).toBe('complete');
    expect(updated[1].status).toBe('pending');
  });

  it('updates status of a nested task', () => {
    const tasks: PlanTask[] = [
      {
        id: 'parent',
        text: 'Parent',
        status: 'active',
        children: [
          { id: 'child-1', text: 'Child 1', status: 'pending' },
          { id: 'child-2', text: 'Child 2', status: 'pending' },
        ],
      },
    ];

    const updated = updateTaskStatus(tasks, 'child-1', 'complete');
    
    expect(updated[0].children![0].status).toBe('complete');
    expect(updated[0].children![1].status).toBe('pending');
  });

  it('returns original array if task not found', () => {
    const tasks: PlanTask[] = [
      { id: 'task-1', text: 'Task 1', status: 'pending' },
    ];

    const updated = updateTaskStatus(tasks, 'nonexistent', 'complete');
    
    expect(updated).toEqual(tasks);
  });
});

describe('calculateProgress', () => {
  it('calculates progress for flat tasks', () => {
    const tasks: PlanTask[] = [
      { id: '1', text: 'T1', status: 'complete' },
      { id: '2', text: 'T2', status: 'complete' },
      { id: '3', text: 'T3', status: 'pending' },
      { id: '4', text: 'T4', status: 'active' },
    ];

    const { completed, total } = calculateProgress(tasks);
    
    expect(completed).toBe(2);
    expect(total).toBe(4);
  });

  it('calculates progress including nested tasks', () => {
    const tasks: PlanTask[] = [
      {
        id: '1',
        text: 'Parent',
        status: 'active',
        children: [
          { id: '1-1', text: 'Child 1', status: 'complete' },
          { id: '1-2', text: 'Child 2', status: 'complete' },
        ],
      },
      { id: '2', text: 'T2', status: 'pending' },
    ];

    const { completed, total } = calculateProgress(tasks);
    
    // 2 children complete, parent and T2 not complete
    expect(completed).toBe(2);
    expect(total).toBe(4); // parent + 2 children + T2
  });

  it('handles empty array', () => {
    const { completed, total } = calculateProgress([]);
    
    expect(completed).toBe(0);
    expect(total).toBe(0);
  });

  it('counts skipped as completed', () => {
    const tasks: PlanTask[] = [
      { id: '1', text: 'T1', status: 'complete' },
      { id: '2', text: 'T2', status: 'skipped' },
      { id: '3', text: 'T3', status: 'failed' },
    ];

    const { completed, total } = calculateProgress(tasks);
    
    // Complete and skipped count as done
    expect(completed).toBe(2);
    expect(total).toBe(3);
  });
});

describe('generateTaskId', () => {
  it('generates stable ID for same text', () => {
    const id1 = generateTaskId('Create component');
    const id2 = generateTaskId('Create component');
    
    expect(id1).toBe(id2);
  });

  it('generates different IDs for different text', () => {
    const id1 = generateTaskId('Task A');
    const id2 = generateTaskId('Task B');
    
    expect(id1).not.toBe(id2);
  });

  it('normalizes text for ID generation', () => {
    const id1 = generateTaskId('Create Component');
    const id2 = generateTaskId('create component');
    
    expect(id1).toBe(id2);
  });
});
