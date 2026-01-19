import type { TodoItem, TodoParseResult, TodoStatus, TodoPhase } from '@/types';

// Status markers in agent output
const STATUS_MARKERS: Record<string, TodoStatus> = {
  '[ ]': 'pending',
  '[>]': 'active',
  '[x]': 'complete',
  '[X]': 'complete',
  '[~]': 'struck',
};

// Handoff phrases that indicate phase completion
const HANDOFF_PATTERNS = [
  /handing off to (\w+)/i,
  /ready for (\w+)/i,
  /passing to (\w+)/i,
  /complete[d]?\. (\w+) (will|can|should)/i,
  /all (tasks|items|work) complete/i,
];

// Todo line patterns
const TODO_LINE_REGEX = /^[\s]*[-*]?\s*(\d+\.)?\s*\[([ >xX~])\]\s*(.+)$/;

export interface TodoMatch {
  todo: TodoItem;
  confidence: number;
}

/**
 * Parse todos from agent response text
 */
export function parseTodos(text: string, phase: TodoPhase): TodoParseResult {
  const lines = text.split('\n');
  const todos: TodoItem[] = [];
  let phaseComplete = false;
  let handoffMessage: string | undefined;

  // Check for handoff patterns
  for (const pattern of HANDOFF_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      phaseComplete = true;
      handoffMessage = match[0];
      break;
    }
  }

  // Parse todo lines
  for (const line of lines) {
    const match = line.match(TODO_LINE_REGEX);
    if (match) {
      const marker = `[${match[2]}]`;
      const status = STATUS_MARKERS[marker] || 'pending';
      const todoText = match[3].trim();

      todos.push({
        id: generateTodoId(todoText),
        text: todoText,
        status,
        phase,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  return { todos, phaseComplete, handoffMessage };
}

/**
 * Find matching todo with fuzzy matching (95% threshold)
 */
export function matchTodoUpdate(
  searchText: string,
  existingTodos: TodoItem[],
  threshold = 0.95
): TodoMatch | null {
  const normalizedSearch = normalize(searchText);
  let bestMatch: TodoMatch | null = null;

  for (const todo of existingTodos) {
    const normalizedTodo = normalize(todo.text);

    // Exact match
    if (normalizedSearch === normalizedTodo) {
      return { todo, confidence: 1.0 };
    }

    // Fuzzy match using Levenshtein similarity
    const similarity = calculateSimilarity(normalizedSearch, normalizedTodo);
    if (similarity >= threshold && (!bestMatch || similarity > bestMatch.confidence)) {
      bestMatch = { todo, confidence: similarity };
    }
  }

  return bestMatch;
}

/**
 * Normalize text for comparison
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate Levenshtein distance-based similarity (0-1)
 */
function calculateSimilarity(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;

  const maxLen = Math.max(a.length, b.length);
  const distance = levenshteinDistance(a, b);

  return 1 - distance / maxLen;
}

/**
 * Levenshtein distance algorithm
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Generate stable ID from todo text
 */
function generateTodoId(text: string): string {
  const normalized = normalize(text);
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `todo-${Math.abs(hash).toString(36)}`;
}
