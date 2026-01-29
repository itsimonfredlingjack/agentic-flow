import type { ExecutionTask } from '@/components/terminal/ExecutionPlan';
import type { PlanTask } from '@/types';

export function planTasksToExecutionTasks(tasks: PlanTask[]): ExecutionTask[] {
  return tasks.map((task) => {
    const status = task.status === 'active'
      ? 'in-progress'
      : task.status === 'complete' || task.status === 'skipped'
        ? 'completed'
        : 'pending';

    const text = task.status === 'failed'
      ? `FAILED: ${task.text}`
      : task.text;

    return {
      id: task.id,
      text,
      status,
    };
  });
}
