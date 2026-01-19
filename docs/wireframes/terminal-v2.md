# Terminal V2 Wireframes (Text Spec)

Design intent: output and code are two separate truths that live side by side.
RUN OUTPUT is an artifact container, not a message stream.

## Layouts

Focus Mode (default)
```
+----------------------------------------------------------------------------------+
| LLM Creative • Session RUN-123   [Focus*] [Inspect] [Batch]   CMD+K  TAB   Status |
|----------------------------------------------------------------------------------|
| RUN OUTPUT (artifact container)                                                  |
|  [Block] role badge | command | status | actions                                 |
|  [Block] role badge | command | status | actions                                 |
|  [Block] role badge | command | status | actions                                 |
|  Output stream (latest 2-6 blocks stacked)                                       |
|                                                                                  |
|  > Input / Command Prompt (SHIFT+ENTER multiline, ENTER run)                     |
+----------------------------------------------------------------------------------+
```

Inspect Mode (Source Inspector)
```
+----------------------------------------------------------------------------------+
| LLM Creative • Session RUN-123   [Focus] [Inspect*] [Batch]  CMD+K  TAB  Status   |
|----------------------------------------------------------------------------------|
| RUN OUTPUT (artifact container)           | SOURCE INSPECTOR / CODE CANVAS        |
|  [Block] role badge | command | status   |  Sources list                          |
|  [Block] role badge | command | status   |  [selected] patch/snippet              |
|  [Block] role badge | command | status   |  Syntax-highlighted diff               |
|  Output stream                            |  Open Diff (button)                   |
|  > Input / Command Prompt                 |  Metadata                             |
+----------------------------------------------------------------------------------+
```

Batch Mode
```
+----------------------------------------------------------------------------------+
| LLM Creative • Session RUN-123   [Focus] [Inspect] [Batch*]  CMD+K  TAB  Status   |
|----------------------------------------------------------------------------------|
| RUN OUTPUT (artifact container)           | QUEUE / RESULTS                        |
|  [Block] role badge | command | status   |  Now / Next / Later (execution)         |
|  [Block] role badge | command | status   |  Results list + export                  |
|  Output stream                            |  Status chips                          |
|  > Input / Command Prompt                 |                                       |
+----------------------------------------------------------------------------------+
```

## Command Palette (CMD+K / CTRL+K)
```
+--------------------------------------------------------------+
| Command Palette                                              |
| > switch role: Engineer               CMD+2                  |
|   run: next phase (Critic)                                   |
|   open: Source Inspector                                     |
|   toggle: Focus / Inspect Mode       ALT+I                   |
|   show: Execution Plan                                       |
|   export: Run Summary (markdown)                             |
+--------------------------------------------------------------+
```

## Keyboard Map (locked shortcuts)
- CMD+1..CMD+4: switch role (Architect/Engineer/Critic/Deployer)
- CMD+K / CTRL+K: command palette
- ALT+I: toggle inspector (Focus <-> Inspect)
- TAB: focus loop (output -> input -> plan)
- SHIFT+ENTER: multiline prompt
- ENTER: run

## Component Inventory
- TerminalLayout: tri-pane shell + mode toggle + keyboard-first focus loop.
- OutputBlock: role badge, command, status, actions. Stacked feed (2-6 latest).
- ExecutionPlan: Now/Next/Later grouping, click -> focus related output/run.
- Source Inspector: sources list, syntax-highlighted diff/snippet, Open Diff, metadata.
- CommandPalette: keyboard-first command router (6 primary commands).
- Phase Gate Modal: checkpoint UI before role handoff.

## States & Transitions
- Role accents: one subtle accent per role (badge + border glow).
- State accents: running/success/error shown as icon + minimal label.
- Focus Mode: hides right panel and left rail.
- Inspect Mode: shows right panel (inspector/canvas).
- Batch Mode: shows right panel (queue/results).
- Phase Gate: modal checkpoint before role transition.

## Inspector Metadata (artifact truth)
- Type: patch/snippet
- File: file path when available (diff-derived)
- Role: Architect/Engineer/Critic/Deployer
- Status: running/success/error/idle
- Source: agent/shell
- Time: timestamp

## Phase Gate (checkpoint premium)
- Header: "Ready to {Role}?"
- Transfer Package: list of artifacts with ready status
- Keys: Enter approve, Esc review

## Copy Rules (labels)
- RUN OUTPUT (artifact container)
- SOURCE INSPECTOR
- QUEUE / RESULTS
- Now / Next / Later
- Open Diff
