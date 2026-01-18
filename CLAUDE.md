# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Dev server on localhost:3000 (binds 0.0.0.0)
npm run build        # Production build
npm run serve        # Production on 0.0.0.0:3001
npm run lint         # ESLint (flat config in eslint.config.mjs)
npm run lint -- src/lib/runtime.ts   # Lint single file
npx tsc -p tsconfig.json --noEmit    # Typecheck (strict mode)
```

**No test runner configured** - if adding tests, wire up `npm test`.

Requires Ollama on localhost:11434 for LLM chat features.

## Environment Variables

```
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=qwen2.5-coder:3b
OLLAMA_TIMEOUT_MS=60000
```

## Architecture Overview

**Glass Pipeline** - Next.js 16 (App Router) + React 19 AI agent workspace with glassmorphism UI. Uses XState for state management and SSE for real-time streaming.

**Path Alias**: `@/*` → `./src/*`

### Core Pattern: Intent → Event Flow

```
User Input → AgentWorkspace.handleSend()
           → POST /api/command (AgentIntent)
           → HostRuntime.dispatch()
           → Terminal/Ollama execution
           → RuntimeEvent via RxJS Subject
           → SSE /api/stream → AgencyClient
           → UI update
```

### Key Directories

- `/src/app/api/` - Backend routes (command, stream, events, run, ollama, apply)
- `/src/components/` - React components (MissionControl is main orchestrator)
- `/src/lib/` - Core services (runtime, ledger, terminal, ollama, safeCommand)
- `/src/machines/` - XState machines (missionControlMachine, agentMachine)

### State Machine Phases

Defined in `missionControlMachine.ts`:
- **plan** (Sapphire/blue) - Architecture and planning
- **build** (Emerald/green) - Code execution via terminal
- **review** (Amber/orange) - Security gates and approval
- **deploy** (Amethyst/purple) - Release management

### Critical Files

| File | Purpose |
|------|---------|
| `src/components/MissionControl.tsx` | Main orchestrator, XState machine, snapshot persistence |
| `src/components/AgentWorkspace.tsx` | Workspace UI, event subscription, chat handling |
| `src/machines/missionControlMachine.ts` | Primary XState orchestration machine |
| `src/lib/runtime.ts` | HostRuntime - central event dispatcher |
| `src/lib/ledger.ts` | SQLite persistence (events, snapshots, runs) |
| `src/lib/terminal.ts` | TerminalService - subprocess execution |
| `src/lib/safeCommand.ts` | Command allowlist/denylist enforcement |
| `src/lib/client.ts` | AgencyClient - browser-side SSE subscription |
| `src/types.ts` | UI↔host contract types (AgentIntent, RuntimeEvent) |
| `src/lib/types.ts` | Internal runtime/library types |

### Type System

Two type hubs - don't create a third:
- **`src/types.ts`** - UI↔host contract (AgentIntent, RuntimeEvent, MessageHeader). Use for anything crossing network/process boundary.
- **`src/lib/types.ts`** - Internal runtime types.

Key discriminated unions in `src/types.ts`:
- **AgentIntent** - Commands from UI (INTENT_EXEC_CMD, INTENT_OLLAMA_CHAT, etc.)
- **RuntimeEvent** - Events to UI (PROCESS_STARTED, STDOUT_CHUNK, etc.)

### Command Safety System

`lib/safeCommand.ts` enforces security policy:

| Category | Examples | Behavior |
|----------|----------|----------|
| **Allow** | npm run/ci/install, npx tsc/eslint, git (read-only), ls, cat, rg | Execute |
| **Require Permission** | sh, bash, node, python, curl, wget, ssh | Prompt user |
| **Deny** | rm, sudo, chmod, chown, shutdown, dd, mkfs | Block |

Blocks shell metacharacters (`; & | < >`), command substitution, path traversal.

### API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/command` | POST | Dispatch AgentIntent to HostRuntime |
| `/api/stream` | GET | SSE stream of RuntimeEvents |
| `/api/events` | GET | Query event history |
| `/api/run` | GET/POST | Session management (load/save snapshots) |
| `/api/ollama` | POST | Direct Ollama API proxy |
| `/api/apply` | POST | Apply code changes |

### Input Mode Detection

User input prefixes in AgentWorkspace:
- `/llm <prompt>` or `/chat <prompt>` → INTENT_OLLAMA_CHAT
- `/exec <cmd>` or `/cmd <cmd>` → INTENT_EXEC_CMD
- Bare text → Auto-routed based on current phase

### Persistence

- Sessions: `runId` format `RUN-xxx`
- XState snapshots: `/api/run` with 1s debounce
- Event log: SQLite `event_log` table
- Auto-resume: loads latest run if no runId in query params

## Code Style

- **Imports**: Node built-ins → third-party → `@/...` → relative. Use `import type` for type-only.
- **Types**: `type` for unions/functions, `interface` for extendable shapes. Avoid `any`.
- **Naming**: Components `PascalCase`, hooks `useXxx`, functions/vars `camelCase`
- **Errors**: Validate at API boundaries, return structured `{ error }` responses, don't leak internals.

## PR Checklist

- `npm run lint` passes
- `npx tsc -p tsconfig.json --noEmit` passes
- API routes validate inputs
- Shared types updated in `src/types.ts` when needed
