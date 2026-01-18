# Glass Slate Terminal Implementation Plan

**Goal:** Transform the current terminal interface into a "Glass Slate" aesthetic: sharp borders, surgical glass backdrop (backdrop-filter), and premium monospaced typography, replacing the current implementation.

**Architecture:** We will refactor the `ShadowTerminal` and `MissionControl` components to use refined Tailwind CSS v4 classes and CSS variables for the glass effect. We will introduce a new font (Geist Mono or JetBrains Mono) via Next.js `next/font`.

**Tech Stack:** Next.js 16, Tailwind CSS v4, Lucide React (Icons).

---

### Task 1: Typography Upgrade (Geist Mono)

**Files:**
- Modify: `src/app/layout.tsx` (Add font)
- Modify: `tailwind.config.js` (or CSS var usage) to map `font-mono` to Geist.

**Step 1: Verify current font**
Check `src/app/layout.tsx` to see current font implementation.

**Step 2: Add Geist Mono**
Import `Geist_Mono` from `next/font/google` and apply it to the body or a CSS variable.

**Step 3: Verify Render**
Check the dev server to ensure monospaced text is using the new font.

**Step 4: Commit**
`git commit -m "feat: upgrade to Geist Mono typography"`

---

### Task 2: "Glass Slate" CSS Utilities

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Define .glass-slate utility**
Create a new utility class `.glass-slate` that implements:
- `backdrop-filter: blur(12px)` (or higher)
- `background: rgba(255, 255, 255, 0.03)` (very subtle fill)
- `border: 1px solid rgba(255, 255, 255, 0.1)` (crisp border)
- `box-shadow`: subtle inner glow or drop shadow to separate from background.

**Step 2: Create a test page (optional) or verify in existing UI**
Apply `.glass-slate` to a dummy div to verify the look.

**Step 3: Commit**
`git commit -m "feat: add glass-slate css utility"`

---

### Task 3: Refactor ShadowTerminal Container

**Files:**
- Modify: `src/components/ShadowTerminal.tsx`

**Step 1: Remove old styles**
Strip existing background colors (e.g., `bg-black/90`).

**Step 2: Apply Glass Slate**
Apply the new `.glass-slate` class to the main terminal container.
Ensure the border is distinct.

**Step 3: Verify Visibility**
Ensure text contrast is high enough against the glass background.

**Step 4: Commit**
`git commit -m "refactor: apply glass slate to ShadowTerminal"`

---

### Task 4: Refactor MissionControl Layout

**Files:**
- Modify: `src/components/MissionControl.tsx`

**Step 1: Adjust spacing**
The "Slate" look requires breathing room. Increase padding/margins around the terminal area.

**Step 2: Apply Glass Slate to other panels (optional)**
If consistency is desired, apply `.glass-slate` to the side panels (Plan/Review/Deploy cards) but maybe with different opacity.

**Step 3: Commit**
`git commit -m "refactor: update MissionControl layout for glass slate"`
