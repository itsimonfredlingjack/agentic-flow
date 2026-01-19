# Living Todo Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a real-time todo panel to the left sidebar that displays agent-generated todos with live state transitions.

**Architecture:** React components receive todos via the existing SSE stream. A todo parser extracts structured items from agent responses using pattern matching. State is session-scoped (no persistence beyond page lifecycle).

**Tech Stack:** React 19, TypeScript, CSS animations, Vitest for testing

---

## Overview

The Living Todo Panel shows agent-generated task lists that update in real-time:
- **Plan agent** creates initial todos when planning
- **Build agent** marks todos as active/complete as it works
- Four visual states: `[ ]` pending, `[>]` active, `[x]` complete, `[~]` struck

## File Structure

```
src/
├── lib/
│   └── todoParser.ts           # Parse todos from agent text
├── components/
│   └── terminal/
│       ├── TodoPanel.tsx       # Main panel component
│       ├── TodoItem.tsx        # Individual todo item
│       └── PhaseDivider.tsx    # Phase separator
├── types.ts                    # Add TodoItem types
└── app/
    └── v2/page.tsx             # Integrate panel

tests/
└── lib/
    └── todoParser.test.ts      # Parser unit tests

src/app/globals.css             # Add todo panel styles
```

---

## Task 1: Set Up Test Infrastructure

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Modify: `package.json`

**Step 1: Install Vitest**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Step 2: Create Vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Step 3: Create test setup file**

Create `tests/setup.ts`:
```typescript
import '@testing-library/jest-dom';
```

**Step 4: Add test script to package.json**

In `package.json`, add to "scripts":
```json
"test": "vitest",
"test:run": "vitest run"
```

**Step 5: Verify setup**

```bash
npm run test:run
```

Expected: No tests found (0 passed)

**Step 6: Commit**

```bash
git add vitest.config.ts tests/setup.ts package.json package-lock.json
git commit -m "chore: add vitest test infrastructure"
```

---

## Task 2: Add Todo Types

**Files:**
- Modify: `src/types.ts`

**Step 1: Add todo types to src/types.ts**

Add at end of file (after `ActionCardProps`):
```typescript
// --- Todo Panel Types ---
export type TodoStatus = 'pending' | 'active' | 'complete' | 'struck';

export type TodoPhase = 'PLAN' | 'BUILD' | 'REVIEW' | 'DEPLOY';

export interface TodoItem {
  id: string;
  text: string;
  status: TodoStatus;
  phase: TodoPhase;
  createdAt: number;
  updatedAt: number;
}

export interface TodoParseResult {
  todos: TodoItem[];
  phaseComplete: boolean;
  handoffMessage?: string;
}
```

**Step 2: Verify types compile**

```bash
npx tsc -p tsconfig.json --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add TodoItem types for living todo panel"
```

---

## Task 3: Create Todo Parser (TDD)

**Files:**
- Create: `src/lib/todoParser.ts`
- Create: `tests/lib/todoParser.test.ts`

### Step 1: Write failing tests

Create `tests/lib/todoParser.test.ts`:
```typescript
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
    const match = matchTodoUpdate('Create the component structure', existingTodos);

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
```

**Step 2: Run tests to verify they fail**

```bash
npm run test:run -- tests/lib/todoParser.test.ts
```

Expected: FAIL - module not found

### Step 3: Implement todoParser.ts

Create `src/lib/todoParser.ts`:
```typescript
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
```

### Step 4: Run tests to verify they pass

```bash
npm run test:run -- tests/lib/todoParser.test.ts
```

Expected: All tests PASS

### Step 5: Verify lint

```bash
npm run lint -- src/lib/todoParser.ts
```

### Step 6: Commit

```bash
git add src/lib/todoParser.ts tests/lib/todoParser.test.ts
git commit -m "feat: add todo parser with fuzzy matching"
```

---

## Task 4: Add Todo Panel CSS

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Add todo panel styles**

Add at end of `src/app/globals.css`:
```css
/* ========================================
   TODO PANEL
   ======================================== */

.todo-panel {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.todo-panel__title {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  margin-bottom: 6px;
}

.todo-panel__empty {
  color: var(--text-tertiary);
  font-style: italic;
  font-size: 11px;
}

/* Individual Todo Item */
.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 4px;
  transition: all var(--duration-normal) var(--ease-out);
  line-height: 1.4;
}

.todo-item--pending {
  color: var(--text-secondary);
}

.todo-item--active {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.todo-item--complete {
  color: var(--text-tertiary);
}

.todo-item--struck {
  color: var(--text-tertiary);
  text-decoration: line-through;
  opacity: 0.6;
}

/* Todo checkbox/marker */
.todo-item__marker {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
}

.todo-item__marker--pending {
  color: var(--text-tertiary);
}

.todo-item__marker--active {
  color: var(--agent-engineer);
}

.todo-item__marker--complete {
  color: var(--accent-emerald);
}

.todo-item__marker--struck {
  color: var(--text-tertiary);
}

.todo-item__text {
  flex: 1;
  word-break: break-word;
}

/* Phase divider */
.phase-divider {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0 4px;
  margin-top: 4px;
}

.phase-divider__line {
  flex: 1;
  height: 1px;
  background: var(--border-subtle);
}

.phase-divider__label {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
}

/* Animations */
@keyframes todo-slide-in {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes todo-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

@keyframes todo-check {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.3);
  }
  100% {
    transform: scale(1);
  }
}

.todo-item--entering {
  animation: todo-slide-in var(--duration-slow) var(--ease-out);
}

.todo-item--active .todo-item__marker {
  animation: todo-pulse 1.5s ease-in-out infinite;
}

.todo-item--completing .todo-item__marker {
  animation: todo-check var(--duration-slow) var(--ease-bounce);
}
```

**Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: add todo panel CSS with animations"
```

---

## Task 5: Create TodoItem Component

**Files:**
- Create: `src/components/terminal/TodoItem.tsx`

**Step 1: Create TodoItem component**

This component uses LED status indicators (glowing dots) and bracket markers for a mission control aesthetic.

Create `src/components/terminal/TodoItem.tsx`:
```typescript
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
```

**Step 2: Verify typecheck**

```bash
npx tsc -p tsconfig.json --noEmit
```

**Step 3: Commit**

```bash
git add src/components/terminal/TodoItem.tsx
git commit -m "feat: add TodoItem component"
```

---

## Task 6: Create PhaseDivider Component

**Files:**
- Create: `src/components/terminal/PhaseDivider.tsx`

**Step 1: Create PhaseDivider component**

This component creates terminal-style section headers with phase-specific colors.

Create `src/components/terminal/PhaseDivider.tsx`:
```typescript
"use client";

import React from 'react';
import type { TodoPhase } from '@/types';

interface PhaseDividerProps {
  phase: TodoPhase;
}

const PHASE_LABELS: Record<TodoPhase, string> = {
  PLAN: 'Plan',
  BUILD: 'Build',
  REVIEW: 'Review',
  DEPLOY: 'Deploy',
};

export function PhaseDivider({ phase }: PhaseDividerProps) {
  return (
    <div className={`phase-divider phase-divider--${phase}`}>
      <div className="phase-divider__line" />
      <span className="phase-divider__label">{PHASE_LABELS[phase]}</span>
      <div className="phase-divider__line" />
    </div>
  );
}
```

**Step 2: Verify typecheck**

```bash
npx tsc -p tsconfig.json --noEmit
```

**Step 3: Commit**

```bash
git add src/components/terminal/PhaseDivider.tsx
git commit -m "feat: add PhaseDivider component"
```

---

## Task 7: Create TodoPanel Component

**Files:**
- Create: `src/components/terminal/TodoPanel.tsx`
- Modify: `src/components/terminal/index.ts`

**Step 1: Create TodoPanel component**

Create `src/components/terminal/TodoPanel.tsx`:
```typescript
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
```

**Step 2: Export from index**

Add to end of `src/components/terminal/index.ts`:
```typescript
export { TodoPanel } from './TodoPanel';
export { TodoItem } from './TodoItem';
export { PhaseDivider } from './PhaseDivider';
```

**Step 3: Verify typecheck**

```bash
npx tsc -p tsconfig.json --noEmit
```

**Step 4: Commit**

```bash
git add src/components/terminal/TodoPanel.tsx src/components/terminal/TodoItem.tsx src/components/terminal/PhaseDivider.tsx src/components/terminal/index.ts
git commit -m "feat: add TodoPanel component with phase grouping"
```

---

## Task 8: Integrate TodoPanel into TerminalLayout

**Files:**
- Modify: `src/components/terminal/TerminalLayout.tsx`

**Step 1: Read current file and add imports**

At top of file, add import:
```typescript
import { TodoPanel } from './TodoPanel';
import type { TodoItem } from '@/types';
```

**Step 2: Add to TerminalLayoutProps interface**

Find the `TerminalLayoutProps` interface and add these properties:
```typescript
interface TerminalLayoutProps {
  // ... existing props ...
  todos?: TodoItem[];
  newTodoIds?: Set<string>;
}
```

**Step 3: Add to function parameters**

Update the function signature to include the new props with defaults:
```typescript
export function TerminalLayout({
  // ... existing params ...
  todos = [],
  newTodoIds = new Set(),
}: TerminalLayoutProps) {
```

**Step 4: Add TodoPanel to sidebar**

Find the sidebar `<aside>` element (inside `{timelineVisible && (`). After the `<SessionTimeline ... />` component, add:
```typescript
{/* Todo Panel */}
<div className="border-t border-[var(--border-subtle)] pt-3 mt-auto flex-1 overflow-y-auto">
  <TodoPanel
    todos={todos}
    currentPhase={currentRole as 'PLAN' | 'BUILD' | 'REVIEW' | 'DEPLOY'}
    newTodoIds={newTodoIds}
  />
</div>
```

The sidebar structure should look like:
```typescript
{timelineVisible && (
  <aside className="w-48 border-r border-[var(--border-subtle)] p-3 flex flex-col gap-3">
    <SessionTimeline
      currentRole={currentRole}
      roleStates={effectiveRoleStates}
      onSelectRole={onRoleChange}
    />

    {/* Todo Panel */}
    <div className="border-t border-[var(--border-subtle)] pt-3 mt-auto flex-1 overflow-y-auto">
      <TodoPanel
        todos={todos}
        currentPhase={currentRole as 'PLAN' | 'BUILD' | 'REVIEW' | 'DEPLOY'}
        newTodoIds={newTodoIds}
      />
    </div>
  </aside>
)}
```

**Step 5: Verify typecheck and lint**

```bash
npx tsc -p tsconfig.json --noEmit && npm run lint
```

**Step 6: Commit**

```bash
git add src/components/terminal/TerminalLayout.tsx
git commit -m "feat: integrate TodoPanel into TerminalLayout sidebar"
```

---

## Task 9: Wire TodoPanel to Agent Responses in v2/page.tsx

**Files:**
- Modify: `src/app/v2/page.tsx`

**Step 1: Add imports**

At top of file, add:
```typescript
import type { TodoItem } from '@/types';
import { parseTodos, matchTodoUpdate } from '@/lib/todoParser';
```

**Step 2: Add state declarations**

After existing state declarations (around line 55), add:
```typescript
const [todos, setTodos] = useState<TodoItem[]>([]);
const [newTodoIds, setNewTodoIds] = useState<Set<string>>(new Set());
```

**Step 3: Add todo parsing in OLLAMA_CHAT_COMPLETED case**

In the `useEffect` that processes events, find the `case 'OLLAMA_CHAT_COMPLETED':` block. After the existing `setOutputs(...)` call, add:

```typescript
// Parse todos from agent response
if (lastEvent.response?.message?.content) {
  const responseContent = lastEvent.response.message.content;
  const parseResult = parseTodos(responseContent, currentRoleRef.current);

  if (parseResult.todos.length > 0) {
    setTodos(prev => {
      const newTodos = [...prev];
      const addedIds = new Set<string>();

      for (const parsedTodo of parseResult.todos) {
        // Check if this updates an existing todo
        const existingMatch = matchTodoUpdate(parsedTodo.text, newTodos);

        if (existingMatch) {
          // Update existing todo status
          const idx = newTodos.findIndex(t => t.id === existingMatch.todo.id);
          if (idx !== -1) {
            newTodos[idx] = {
              ...newTodos[idx],
              status: parsedTodo.status,
              updatedAt: Date.now(),
            };
          }
        } else {
          // Add new todo
          newTodos.push(parsedTodo);
          addedIds.add(parsedTodo.id);
        }
      }

      // Track new todos for animation
      if (addedIds.size > 0) {
        setNewTodoIds(addedIds);
        // Clear animation flags after delay
        setTimeout(() => setNewTodoIds(new Set()), 500);
      }

      return newTodos;
    });
  }
}
```

**Step 4: Clear todos on new session**

In the `handleNewSession` callback (around line 293), add:
```typescript
setTodos([]);
setNewTodoIds(new Set());
```

**Step 5: Pass todos to TerminalLayout**

In the return statement, update the `<TerminalLayout>` component to include:
```typescript
<TerminalLayout
  // ... existing props ...
  todos={todos}
  newTodoIds={newTodoIds}
/>
```

**Step 6: Verify typecheck and lint**

```bash
npx tsc -p tsconfig.json --noEmit && npm run lint
```

**Step 7: Commit**

```bash
git add src/app/v2/page.tsx
git commit -m "feat: wire TodoPanel to agent responses with live updates"
```

---

## Task 10: Visual Testing with Development Server

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Test in browser**

Navigate to `http://localhost:3000/v2`

Verify:
1. Todo panel appears in left sidebar (below Session Flow timeline)
2. Shows "No tasks yet" initially
3. Sidebar scrolls independently if todos overflow

**Step 3: Test with sample prompt**

Send prompt to Plan agent:
```
Create a plan with these tasks:
- [ ] Set up project structure
- [ ] Create database schema
- [ ] Implement API endpoints
```

Verify:
- Todos appear in panel with slide-in animation
- Items show circle icon (pending status)
- Panel updates without page refresh

**Step 4: Test status changes**

Switch to Build agent and send:
```
Working on the tasks:
- [>] Set up project structure (in progress)
- [x] Create database schema (done)
- [ ] Implement API endpoints
```

Verify:
- First todo shows chevron icon with pulse animation (active)
- Second todo shows checkmark (complete)
- Third remains pending

---

## Task 11: Final Build and Lint Check

**Step 1: Run full build**

```bash
npm run build
```

Expected: Build succeeds

**Step 2: Run all tests**

```bash
npm run test:run
```

Expected: All tests pass

**Step 3: Run lint**

```bash
npm run lint
```

Expected: No errors

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete living todo panel implementation"
```

---

## Summary

**Files created:**
- `vitest.config.ts` - Test configuration
- `tests/setup.ts` - Test setup
- `tests/lib/todoParser.test.ts` - Parser tests
- `src/lib/todoParser.ts` - Todo parser with fuzzy matching
- `src/components/terminal/TodoItem.tsx` - Individual todo component
- `src/components/terminal/PhaseDivider.tsx` - Phase separator
- `src/components/terminal/TodoPanel.tsx` - Main panel component

**Files modified:**
- `package.json` - Added test scripts and vitest
- `src/types.ts` - Added TodoItem types
- `src/app/globals.css` - Added todo panel styles
- `src/components/terminal/index.ts` - Added exports
- `src/components/terminal/TerminalLayout.tsx` - Integrated TodoPanel
- `src/app/v2/page.tsx` - Wired todo state and parsing
