import { describe, expect, it } from 'vitest';

import { planTasksToExecutionTasks } from '@/components/v2/planToExecutionTasks';
import type { PlanTask } from '@/types';

describe('planTasksToExecutionTasks', () => {
  it('maps plan task statuses to execution task statuses', () => {
    const tasks: PlanTask[] = [
      { id: '1', text: 'A', status: 'pending' },
      { id: '2', text: 'B', status: 'active' },
      { id: '3', text: 'C', status: 'complete' },
      { id: '4', text: 'D', status: 'skipped' },
      { id: '5', text: 'E', status: 'failed' },
    ];

    const execution = planTasksToExecutionTasks(tasks);

    expect(execution).toEqual([
      { id: '1', text: 'A', status: 'pending' },
      { id: '2', text: 'B', status: 'in-progress' },
      { id: '3', text: 'C', status: 'completed' },
      { id: '4', text: 'D', status: 'completed' },
      { id: '5', text: 'FAILED: E', status: 'pending' },
    ]);
  });

  it('ignores nesting (top-level only)', () => {
    const tasks: PlanTask[] = [
      { id: 'p', text: 'Parent', status: 'pending', children: [{ id: 'c', text: 'Child', status: 'complete' }] },
    ];

    const execution = planTasksToExecutionTasks(tasks);
    expect(execution).toHaveLength(1);
    expect(execution[0].id).toBe('p');
  });
});
