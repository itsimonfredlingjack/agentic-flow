import type { PlanTask, TaskStatus } from '@/types';

// Status markers in plan output
const STATUS_MARKERS: Record<string, TaskStatus> = {
  '[ ]': 'pending',
  '[>]': 'active',
  '[x]': 'complete',
  '[X]': 'complete',
  '[!]': 'failed',
  '[~]': 'skipped',
};

// Task line patterns - supports - and * list markers
const TASK_LINE_REGEX = /^(\s*)[-*]\s*\[([ >xX!~])\]\s*(.+)$/;

/**
 * Generate stable ID from task text
 */
export function generateTaskId(text: string): string {
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `plan-${Math.abs(hash).toString(36)}`;
}

/**
 * Parse plan tasks from markdown text with [ ] markers
 * Supports two-level nesting based on indentation
 */
export function parsePlanTasks(text: string): PlanTask[] {
  const lines = text.split('\n');
  const tasks: PlanTask[] = [];
  let currentParent: PlanTask | null = null;

  for (const line of lines) {
    const match = line.match(TASK_LINE_REGEX);
    if (!match) continue;

    const [, indent, marker, taskText] = match;
    const markerKey = `[${marker}]`;
    const status = STATUS_MARKERS[markerKey];
    
    if (!status) continue; // Unknown marker

    const task: PlanTask = {
      id: generateTaskId(taskText),
      text: taskText.trim(),
      status,
    };

    // Determine nesting: any indentation makes it a child
    const isNested = indent.length > 0;

    if (isNested && currentParent) {
      // Add as child of current parent
      if (!currentParent.children) {
        currentParent.children = [];
      }
      currentParent.children.push(task);
    } else {
      // Top-level task
      tasks.push(task);
      currentParent = task;
    }
  }

  return tasks;
}

/**
 * Update status of a task by ID (searches nested tasks too)
 */
export function updateTaskStatus(
  tasks: PlanTask[],
  taskId: string,
  newStatus: TaskStatus
): PlanTask[] {
  return tasks.map(task => {
    if (task.id === taskId) {
      return { ...task, status: newStatus };
    }
    
    if (task.children) {
      const updatedChildren = task.children.map(child =>
        child.id === taskId ? { ...child, status: newStatus } : child
      );
      
      // Check if any child was updated
      const childUpdated = updatedChildren.some((c, i) => c !== task.children![i]);
      if (childUpdated) {
        return { ...task, children: updatedChildren };
      }
    }
    
    return task;
  });
}

/**
 * Calculate progress: count completed + skipped vs total
 */
export function calculateProgress(tasks: PlanTask[]): { completed: number; total: number } {
  let completed = 0;
  let total = 0;

  function countTask(task: PlanTask) {
    total++;
    if (task.status === 'complete' || task.status === 'skipped') {
      completed++;
    }
    if (task.children) {
      task.children.forEach(countTask);
    }
  }

  tasks.forEach(countTask);
  return { completed, total };
}

/**
 * Find a task by text (fuzzy match for status updates)
 */
export function findTaskByText(tasks: PlanTask[], searchText: string): PlanTask | null {
  const normalizedSearch = searchText.toLowerCase().trim();

  function search(taskList: PlanTask[]): PlanTask | null {
    for (const task of taskList) {
      if (task.text.toLowerCase().trim() === normalizedSearch) {
        return task;
      }
      if (task.children) {
        const found = search(task.children);
        if (found) return found;
      }
    }
    return null;
  }

  return search(tasks);
}
