# Autonomous Memory

When enabled, the agent automatically extracts durable knowledge from past sessions and injects a compact summary into each new session. Over time it builds a project-scoped memory store — technical decisions, recurring workflows, pitfalls — that carries forward without manual effort.

Disabled by default. Enable via `/settings` or `config.yml`:

```yaml
memory:
  backend: local
# legacy equivalent:
# memories:
#   enabled: true
```

## Usage

### What gets injected

At session start, if a memory summary exists for the current project, it is injected into the system prompt as a **Memory Guidance** block. The agent is instructed to:

- Treat memory as heuristic context — useful for process and prior decisions, not authoritative on current repo state.
- Pair memory-influenced decisions with current-repo evidence before acting.
- Prefer repo state and user instruction when they conflict with memory; treat conflicting memory as stale.

### Memory artifacts

Generated local-memory artifacts are private runtime state, not a public tool or URI surface. They may be summarized into the system prompt when local memory is enabled, but users and model-facing tool docs should not rely on direct `memory://` reads. The legacy internal `memory://` resolver remains only for compatibility with existing persisted guidance and is not part of the public coding harness contract; remove it after legacy local-memory prompts no longer reference it.
### `jwc memory` and `jwc chat` (Jaw brand)

On the **jwc** CLI brand (`JWC_BRAND_NAME=jwc`), the native commands below mirror the cli-jaw memory workflow. They route through `packages/coding-agent/src/jwc-runtime/memory-runtime.ts` into the same engines as the interactive agent:

| Backend | Setting | Role |
| ------- | ------- | ---- |
| `local` | `memory.backend: local` (or legacy `memories.enabled: true`) | SQLite pipeline under `<agentDir>/memories/state`, per-project artifacts |
| `hindsight` | `memory.backend: hindsight` | Vectorize Hindsight remote bank (`hindsight.*` settings) |
| `off` | default | Commands print a configuration hint and exit non-zero |

**Local `jwc memory` verbs:** `search`, `read`, `save`, `context`, `browse`, `list`, `status`, `reindex`. Ref vocabulary for read/context: `summary`, `memory`, `raw`, `stage1:<thread_id>`, `rollout:<slug>` (plus artifact basename aliases). Manual save uses `thread_id = manual:<file>` and enqueues phase2 consolidation.

**`jwc chat search`** greps rollout session JSONL under the current project cwd (`--days`, `--recent`, `--context`).

**Task Snapshot (local):** Each turn, `localBackend.beforeAgentStartPrompt` may append a `<memories>` block with up to four diversified search hits for the current user prompt, in parallel with the `memory_summary.md` guidance injection.

Standalone `jwc memory save` cannot refresh another process’s live TUI session; in-session saves call `refreshBaseSystemPrompt()` when the runtime passes an `AgentSession`. Otherwise visibility follows the watermark queue and the next rebuild.

### `/memory` slash command

| Subcommand            | Effect                                         |
| --------------------- | ---------------------------------------------- |
| `view`                | Show the current memory injection payload      |
| `clear` / `reset`     | Delete all memory data and generated artifacts |
| `enqueue` / `rebuild` | Force consolidation to run at next startup     |

## How it works

Memories are built by a background pipeline that runs at startup or when manually triggered via slash command.

**Phase 1 — per-session extraction:** For each past session that has changed since it was last processed, a model reads the session history and extracts durable signal: technical decisions, constraints, resolved failures, recurring workflows. Sessions that are too recent, too old, or currently active are skipped. Each extraction produces a raw memory block and a short synopsis for that session.

**Phase 2 — consolidation:** After extraction, a second model pass reads all per-session extractions and produces three outputs written to disk:

- `MEMORY.md` — a curated long-term memory document
- `memory_summary.md` — the compact text injected at session start
- `skills/` — reusable procedural playbooks, each in its own subdirectory

Phase 2 uses a lease to prevent double-running when multiple processes start simultaneously. Stale skill directories from prior runs are pruned automatically.

All output is scanned for secrets before being written to disk.

### Extraction behavior

Memory extraction and consolidation behavior is driven by static prompt files in `packages/coding-agent/src/prompts/memories/`.

| File                  | Purpose                                     | Variables                                   |
| --------------------- | ------------------------------------------- | ------------------------------------------- |
| `stage_one_system.md` | System prompt for per-session extraction    | —                                           |
| `stage_one_input.md`  | User-turn template wrapping session content | `{{thread_id}}`, `{{response_items_json}}`  |
| `consolidation.md`    | Prompt for cross-session consolidation      | `{{raw_memories}}`, `{{rollout_summaries}}` |
| `read_path.md`        | Memory guidance injected into live sessions | `{{memory_summary}}`                        |

### Model selection

Memory piggybacks on the model role system.

| Phase                   | Role                                                                | Purpose                          |
| ----------------------- | ------------------------------------------------------------------- | -------------------------------- |
| Phase 1 (extraction)    | `default`                                                           | Per-session knowledge extraction |
| Phase 2 (consolidation) | `smol` (falls back to `default`, then current/first registry model) | Cross-session synthesis          |

If the requested memory role is not configured, memory model resolution falls back to the `default` role, then the active session model, then the first model in the registry.

## Configuration

| Setting                               | Default | Description                                               |
| ------------------------------------- | ------- | --------------------------------------------------------- |
| `memories.enabled`                    | `false` | Master switch                                             |
| `memory.backend`                      | `off`   | `off`, `local`, or `hindsight` — prefer over legacy `memories.enabled` |
| `memories.maxRolloutAgeDays`          | `30`    | Sessions older than this are not processed                |
| `memories.minRolloutIdleHours`        | `12`    | Sessions active more recently than this are skipped       |
| `memories.maxRolloutsPerStartup`      | `64`    | Cap on sessions processed in a single startup             |
| `memories.summaryInjectionTokenLimit` | `5000`  | Max tokens of the summary injected into the system prompt |

Additional tuning knobs (concurrency, lease durations, token budgets) are available in config for advanced use.

## Key files

- `packages/coding-agent/src/memories/index.ts` — pipeline orchestration, injection, slash command handling
- `packages/coding-agent/src/memories/storage.ts` — SQLite-backed job queue and thread registry
- `packages/coding-agent/src/prompts/memories/` — memory prompt templates
- `packages/coding-agent/src/internal-urls/memory-protocol.ts` — legacy non-public `memory://` compatibility handler
