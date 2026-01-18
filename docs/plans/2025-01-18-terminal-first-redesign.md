# Terminal-First Redesign

**Date**: 2025-01-18  
**Status**: Approved  
**Author**: Simon + Claude

## Overview

Redesign Glass Pipeline from retro CRT aesthetic to a terminal-first, Linear-inspired interface. The current glassmorphism/scanlines approach feels dated. The new design prioritizes keyboard-driven workflows, clean surfaces, and saturated accent colors.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary interaction | Terminal-first | Professional tool feel, not chatbot |
| Visual aesthetic | Linear | Developer luxury, proven premium feel |
| Layout | Full-width, no sidebar | Maximum terminal real estate |
| Agent presence | Subtle status pill | No avatar/persona, agent is the terminal |
| Input mode | Toggle with ⌘⇧A | Shell (`>`) vs Agent (`@`), no hidden state confusion |
| Navigation | `⌘K` omnibar | Sessions, agents, settings all via command palette |

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ Glass Pipeline                        ⌘K Search   ◐ Thinking   ─ □ │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ > npm run build                                          ▾ 3s │ │
│  │ ✓ Compiled successfully                                       │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ @ fix the warnings                                            │ │
│  │                                                               │ │
│  │ Found 3 unused imports. Removing them now.                    │ │
│  │                                                               │ │
│  │ ┌─ src/lib/terminal.ts ─────────────────────────────────────┐ │ │
│  │ │ - import { spawn, exec } from 'child_process';            │ │ │
│  │ │ + import { spawn } from 'child_process';                  │ │ │
│  │ └───────────────────────────────────────────────────────────┘ │ │
│  │                                                     [Apply]   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ @ _                                                  ⌘⇧A → Shell  │
└─────────────────────────────────────────────────────────────────────┘
```

## Color System

### Base (unchanged feel, precise values)
```css
--bg-base: #0a0a0b;
--bg-surface: #141415;
--bg-elevated: #1c1c1e;
--border-subtle: #232326;
--border-focus: #3b3b40;
--text-primary: #ededef;
--text-secondary: #8b8b8d;
--text-tertiary: #5c5c5e;
```

### Accents (saturated, punchy)
```css
--accent-emerald: #10b981;   /* Shell prompt, success */
--accent-violet: #8b5cf6;    /* Agent prompt, AI context */
--accent-sky: #0ea5e9;       /* Primary, focus, brand */
--accent-cyan: #06b6d4;      /* Links, info */
--accent-amber: #f59e0b;     /* Warnings */
--accent-rose: #f43f5e;      /* Errors */
```

### Usage
- `>` shell prompt → `accent-emerald`
- `@` agent prompt → `accent-violet`
- Status pill, focus rings → `accent-sky`
- Success states → `accent-emerald`
- Warnings → `accent-amber`
- Errors → `accent-rose`
- Links → `accent-cyan`

## Typography

- **UI/Headers**: Geist Sans, -0.02em tracking, medium weight
- **Terminal/Code**: Geist Mono, 13px, 1.5 line-height
- **Timestamps/Meta**: 11px, `text-tertiary`

## Components

### CommandInput (bottom bar)
- Fixed at bottom, always visible
- Shows mode indicator: `>` (emerald) or `@` (violet)
- Right side shows toggle hint: `⌘⇧A → Shell` or `⌘⇧A → Agent`
- Focus state: `accent-sky` border

### OutputBlock
- Collapsible blocks for commands and responses
- Header: prompt + command/query + duration + status icon
- Body: output content, code diffs, action buttons
- States:
  - Running: left border pulses `accent-sky`
  - Success: brief `accent-emerald` border flash
  - Error: `accent-rose` left border (4px), persists
  - Collapsed: single line, chevron `▸`

### CommandPalette (⌘K)
- Omnibar: can execute (`> cmd`, `@ prompt`) or navigate
- 500px wide, centered, max 400px tall
- Sections: Recent, Navigation, Actions
- Sub-views: Sessions (with agent + status), Agents (with model)
- Fuzzy search, keyboard navigation

### StatusPill
- Top-right corner
- States: `● Ready` (sky), `◐ Thinking` (violet), `▶ Running` (emerald), `⚠ Error` (rose)
- Click to expand: shows agent, model, session ID
- State change: scale pulse 1.0 → 1.05 → 1.0

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `⌘K` | Command palette |
| `⌘⇧A` | Toggle shell/agent mode |
| `⌘↵` | Send command |
| `↑/↓` | History navigation |
| `⌘[` / `⌘]` | Collapse/expand block |
| `Esc` | Clear input / close palette |
| `⌘N` | New session |
| `⌘L` | Clear output |
| `⌘⇧S` | Sessions |
| `⌘⇧R` | Agents |

## Micro-interactions

| Interaction | Animation |
|-------------|-----------|
| Block appears | Fade in + slide up 8px, 200ms ease-out |
| Collapse/expand | Height animates, chevron rotates 90°, 150ms |
| Running block | Left border pulses opacity 0.5 → 1.0, 1s loop |
| Success | Border flashes emerald once, 300ms |
| Error | Shake 2px horizontal, 2 cycles, 200ms |
| Action buttons | Fade in on hover, 100ms |
| Mode toggle | Cross-fade with color shift, 150ms |

**Rule: No animations over 300ms. No bounces. No elastic easing.**

## Migration

### Delete
- Scanlines/CRT effect in `globals.css`
- Phase color tokens (sapphire, emerald, amber, amethyst)
- Glassmorphism classes
- Sidebar component
- Current chat-style input

### Keep
- XState machines (missionControlMachine, agentMachine)
- Backend services (runtime, ledger, terminal, ollama)
- API routes
- Type system (AgentIntent, RuntimeEvent)

### Build
| Priority | Component | Replaces |
|----------|-----------|----------|
| P0 | CommandInput | Chat input |
| P0 | OutputBlock | SemanticCards, stream-cards |
| P0 | CommandPalette | Sidebar navigation |
| P0 | StatusPill | Phase indicators |
| P1 | DiffBlock | CodeBlockCard |
| P1 | SessionList | Sidebar sessions |
| P2 | AgentSelector | Current selector |

## File Structure

```
src/components/terminal/
├── CommandInput.tsx      # Bottom input bar
├── OutputBlock.tsx       # Collapsible command/response block
├── DiffBlock.tsx         # Inline code diff display
├── StatusPill.tsx        # Top-right status indicator
├── CommandPalette/
│   ├── index.tsx         # Main palette component
│   ├── SearchInput.tsx   # Omnibar input
│   ├── ResultsList.tsx   # Filtered results
│   ├── SessionsView.tsx  # Sessions sub-view
│   └── AgentsView.tsx    # Agents sub-view
└── index.ts              # Barrel export
```
