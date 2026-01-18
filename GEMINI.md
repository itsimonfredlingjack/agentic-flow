# GEMINI.md - AgencyOS Glass Pipeline Context

## Project Identity
**AgencyOS: Project Glass Pipeline** is a futuristic AI Agent Workspace designed as a hybrid Terminal/Desktop interface. It re-imagines the developer experience for the Agentic Era using an **Orchestrator-Worker** pattern where AI agents (PLAN, BUILD, REVIEW, DEPLOY) collaborate with the user.

## Quick Start & Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server on 0.0.0.0:3000
npm run build        # Production build
npm run serve        # Serve production build on 0.0.0.0:3001
npm run lint         # Run ESLint
```

**Requirements:**
- Node.js 20+
- Ollama running on `localhost:11434` (Model: `qwen2.5-coder:3b` recommended)

## Architecture Overview

**Stack:** Next.js 16 (App Router), TypeScript, XState, Tailwind CSS v4, Better SQLite3.

The application uses a **Host-Client** architecture over SSE (Server-Sent Events):

1.  **User/Agent Intent:** `AgentWorkspace` sends `AgentIntent` to `/api/command`.
2.  **Host Runtime:** `HostRuntime` (Singleton) receives intent, dispatches to `TerminalService` or `OllamaClient`.
3.  **Event Stream:** Runtime emits `RuntimeEvent`s (stdout, status changes) via RxJS.
4.  **Client Update:** `AgencyClient` subscribes to `/api/stream` and updates the React UI.

### State Machine Phases (Orchestrator)

The `MissionControl` component is driven by `missionControlMachine.ts` with four distinct phases/auras:
*   **PLAN (Sapphire):** Architecture, blueprinting, and reasoning.
*   **BUILD (Emerald):** Coding, terminal execution, and active construction.
*   **REVIEW (Amber):** Security gates, code review, and artifact verification.
*   **DEPLOY (Amethyst):** Release management and deployment.

## Key Files & Directories

| Path | Purpose |
|------|---------|
| `src/app/api/` | Backend API routes (`command`, `stream`, `events`, `run`). |
| `src/components/MissionControl.tsx` | Main orchestrator component & XState machine host. |
| `src/machines/missionControlMachine.ts` | The brain of the application (Statechart). |
| `src/lib/runtime.ts` | `HostRuntime` singleton - manages the event loop. |
| `src/lib/ledger.ts` | `TaskLedger` - SQLite persistence for events and snapshots. |
| `src/lib/safeCommand.ts` | Security policy for executing shell commands. |
| `src/lib/client.ts` | Frontend `AgencyClient` for SSE subscriptions. |
| `src/types.ts` | Shared types: `AgentIntent`, `RuntimeEvent`, `Phases`. |

## Security & Safety

**Command Execution (`src/lib/safeCommand.ts`):**
*   **Allowed:** `npm`, `git`, `ls`, `cat`, `echo`, `rg`, `pwd`.
*   **Prompt Required:** `node`, `python`, `sh`, `bash`, `ssh`.
*   **Blocked:** `rm`, `sudo`, `shutdown`, and shell metacharacters.

## Development Guidelines

1.  **Glassmorphism:** Use `.glass-panel` and `.glass-card` classes from `globals.css`.
2.  **State First:** Logic belongs in XState machines (`src/machines/`), not `useEffect`.
3.  **Type Safety:** Strictly adhere to `AgentIntent` and `RuntimeEvent` unions in `src/types.ts`.
4.  **Persistence:** All critical state must be snapshotted to `TaskLedger` (SQLite).

## Roadmap / Todo
*   [ ] **Visual Quality:** Improve glassmorphism effects and transitions.
*   [ ] **Function:** Solidify "Time Travel" (ledger replay).
*   [ ] **Agent Roles:** Specialize generic LLM calls into specific Persona prompts.
