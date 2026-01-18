# Timeline Workbench Implementation Plan

**Goal:** Replace the flat "chat stream" with a structured "Run-Based Timeline" workbench. Each user input starts a `RunContainer` that aggregates subsequent semantic events into a dense, visual stack of blocks.

**Architecture:**
1.  **Data Layer:** `RunAggregator` (utility) transforms flat `StreamItem[]` -> `RunGroup[]`.
2.  **Visual Layer:** `TimelineWorkbench` (component) renders the list of `RunGroup`s with a left spine and sticky toolbar.
3.  **Component Layer:** Specialized blocks (`CommandBlock`, `AgentBlock`, `FileDiffBlock`) rendered inside the run.

**Tech Stack:** Next.js 16, Tailwind CSS v4, Lucide React.

---

### Task 1: Run Aggregator Logic

**Files:**
- Create: `src/lib/aggregators/runAggregator.ts`
- Test: `src/lib/aggregators/runAggregator.test.ts` (if we had a test runner set up, but we'll manually verify)

**Step 1: Define Types**
Define `RunGroup` interface:
```typescript
export interface RunGroup {
  id: string;
  userPrompt: string;
  status: 'running' | 'done' | 'failed' | 'cancelled';
  startTime: number;
  items: StreamItem[]; // The semantic blocks inside
}
```

**Step 2: Implement Aggregation Logic**
Create `aggregateRuns(items: StreamItem[]): RunGroup[]`.
- Iterate through items.
- If `item.isUser` (or `type === 'user_prompt'`), start a new `RunGroup`.
- Else, append item to the *current* `RunGroup`'s `items`.
- If no current run exists, create a "System/Init" run group.
- Derive `status` based on the last item's type/severity.

**Step 3: Commit**
`git commit -m "feat: implement RunAggregator logic"`

---

### Task 2: Timeline Components (Container & Spine)

**Files:**
- Create: `src/components/workbench/RunContainer.tsx`
- Create: `src/components/workbench/TimelineSpine.tsx`
- Modify: `src/components/ShadowTerminal.tsx` (to use the new layout)

**Step 1: Create TimelineSpine**
A simple vertical line component with a "Node" dot.
- Props: `status: RunGroup['status']`, `isLast: boolean`.
- Visual: 1px gray border, 8px dot (green=running, gray=done, red=failed).

**Step 2: Create RunContainer**
The wrapper for a single run.
- Props: `run: RunGroup`.
- Visual:
    - **Header:** Sticky-ish header with `User Prompt` and Status Icon.
    - **Body:** The stack of `items`, indented to right of spine.
    - **Spacing:** Tight vertical rhythm.

**Step 3: Update ShadowTerminal**
Replace the flat `Virtuoso` list with a `Virtuoso` list of `RunContainer`s.
- *Note:* We will map `RunGroup`s as the data source for Virtuoso now.

**Step 4: Commit**
`git commit -m "feat: add RunContainer and TimelineSpine components"`

---

### Task 3: Workbench Chrome (Toolbar)

**Files:**
- Create: `src/components/workbench/WorkbenchToolbar.tsx`
- Modify: `src/components/ShadowTerminal.tsx`

**Step 1: Create Toolbar**
Sticky top bar inside the terminal.
- Left: Filter Toggles (All, Errors, Commands).
- Right: Density Toggle (Compact/Comfortable), Auto-Scroll Lock.

**Step 2: Integrate**
Place `WorkbenchToolbar` at the top of `ShadowTerminal`.

**Step 3: Commit**
`git commit -m "feat: add WorkbenchToolbar"`

---

### Task 4: Refine Semantic Blocks

**Files:**
- Modify: `src/components/stream-cards/CommandBlock.tsx` (Update styling for density)
- Modify: `src/components/stream-cards/AgentMessageCard.tsx` (Remove "chat bubble" bg, make it a text block)

**Step 1: Dense CommandBlock**
Remove unnecessary padding. Make the header shorter. Ensure it fits the "DevTools row" aesthetic.

**Step 2: Text-Only AgentMessage**
Remove the massive `bg-[#1A1A1A]` card container. It should just be text content indented under the run. The "Card" is now the *Run itself*.

**Step 3: Commit**
`git commit -m "refactor: update semantic blocks for timeline density"`
