# Semantic Stream UI Implementation Plan

**Goal:** Transform the current raw text stream into a "Premium Agentic Workbench" by implementing rich, semantic UI blocks for every event type (Phase changes, Agent messages, Commands, Errors).

**Architecture:** We will break the `StreamPane` into a set of specialized React components (`PhaseCard`, `AgentMessageCard`, `CommandBlock`, `ErrorCard`). We will update the `ActionCardProps` type to support these rich payloads and refactor the `streamReducer` to produce them.

**Tech Stack:** Next.js 16, Tailwind CSS v4 (Glass Slate utilities), Lucide React.

---

### Task 1: Component Library - Phase & Agent Cards

**Files:**
- Create: `src/components/stream-cards/PhaseCard.tsx`
- Create: `src/components/stream-cards/AgentMessageCard.tsx`
- Modify: `src/components/ShadowTerminal.tsx` (to import and use them)

**Step 1: Create PhaseCard Component**
Implement a full-width divider component that visualizes phase transitions.
- Props: `phase: string`, `previousPhase?: string`.
- Visual: Centered, uppercase, wide letter-spacing, color-coded border/glow based on phase (Sapphire/Emerald/Amber/Amethyst).

**Step 2: Create AgentMessageCard Component**
Implement a rich message container.
- Props: `agentId: string`, `content: string`, `isTyping?: boolean`.
- Visual:
    - distinct avatar/icon area on left.
    - name header.
    - content body with prose styling (not raw text).
    - glass-slate background but lighter/distinct from container.

**Step 3: Update ShadowTerminal to render these**
Modify `itemContent` in `ShadowTerminal.tsx` to switch on `action.type` and render these new components instead of the generic span.

**Step 4: Commit**
`git commit -m "feat: add PhaseCard and AgentMessageCard components"`

---

### Task 2: Component Library - Command & Error Blocks

**Files:**
- Create: `src/components/stream-cards/CommandBlock.tsx`
- Create: `src/components/stream-cards/ErrorCard.tsx`

**Step 1: Create CommandBlock Component**
Visual wrapper for shell execution.
- Visual:
    - Header: `$ npm run dev` (monospaced, emerald accent).
    - Body: Collapsible output area (default collapsed if successful).
    - Status: Spinner (running) -> Check (done).

**Step 2: Create ErrorCard Component**
High-visibility error alert.
- Visual: Red border/glow, warning icon, pre-wrapped stack trace area.

**Step 3: Integrate into ShadowTerminal**
Wire these up in the `itemContent` switch.

**Step 4: Commit**
`git commit -m "feat: add CommandBlock and ErrorCard components"`

---

### Task 3: Refactor Reducer for Semantic Events

**Files:**
- Modify: `src/components/AgentWorkspace.tsx`

**Step 1: Stop flattening events**
Ensure `streamReducer` preserves the structure needed for the new cards.
- Phase changes should be explicit `type: 'phase_transition'` items.
- Command outputs should be grouped into `type: 'command_block'` items (if possible, or just rendered better).

**Step 2: Commit**
`git commit -m "refactor: optimize stream reducer for semantic cards"`
