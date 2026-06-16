# 23_cycle3_detached_terminal — Later cycle outline

Parent roadmap: `20_p_plan_revised.md`

> Non-executable outline only. Do not implement from this file without a fresh I/P plan after cycle 1/2 settle and terminal/process semantics are re-interviewed.
Depends on: cycle 1 footer panel and, if desired, cycle 2 foreground backgrounding.

## Goal

Evaluate and implement Codex-like detached terminal/process semantics for Jawcode background commands.

## Candidate capabilities

- Stable process ids for background terminal jobs.
- stdin/write support for background processes.
- follow/detail view with retained output cursor.
- explicit stop/kill semantics.
- PTY support if needed for interactive commands.
- retention/eviction policy separate from chat transcript.

## Prior-art references already captured

- Codex-rs unified exec process manager and app-server item completion flow.
- Claude-style background agent roster/footer screenshots supplied by user.
- Jawcode current `AsyncJobManager` output retention and monitor/job overlay structure.

## Non-goals until this cycle starts

- Do not overload cycle 1 footer UI with PTY/process stdin complexity.
- Do not call current async bash a full detached terminal unless process lifetime, stdin, and timeout semantics are changed.

## Required before implementation

Run a fresh PABCD I/P loop after cycles 1/2 settle, because terminal semantics have larger API, lifecycle, and safety tradeoffs.
