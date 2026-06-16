---
name: team
description: IPABCD B-stage coordinated execution — multi-worker jwc tmux team orchestration

source: "forked from upstream team skill and rebranded for jwc"
---

# Team Skill

`$team` is the tmux-based multi-worker execution mode for jwc. It starts real jwc worker CLI sessions by splitting the current tmux leader window and coordinates them through `.jwc/state/team/...` files plus CLI team interop (`jwc team api ...`) and state files.

This skill is operationally sensitive. Treat it as an operator workflow, not a generic prompt pattern. In jwc App or plain outside-tmux sessions, do not present `$team` / `jwc team` as directly available; launch jwc CLI from shell first, or stay on the nearest app-safe surface until the user explicitly wants the tmux runtime.

## Team vs Native Subagents

- Use **jwc native subagents** for bounded, in-session parallelism where one leader thread can fan out a few independent subtasks and wait for them directly.
- Use **`jwc team`** when you need durable visible tmux workers, shared task state, worker mailbox files, worktrees, explicit lifecycle control, or long-running execution that must survive beyond one local reasoning burst.
- Native subagents can complement team execution, but they do **not** replace the tmux team runtime's stateful coordination contract.

## What This Skill Must Do

## GPT-5.5 Guidance Alignment

Use the shared workflow guidance pattern: outcome-first framing, concise visible updates for multi-step work, local overrides for the active workflow branch, validation proportional to risk, explicit stop rules, and automatic continuation for safe reversible steps. Ask only for material, destructive, credentialed, external-production, or preference-dependent branches.

When user triggers `$team`, the agent must:

1. Invoke jwc runtime directly with `jwc team ...`
2. Avoid replacing the flow with in-process `spawn_agent` fanout
3. Verify startup and surface concrete state/pane evidence
4. If active team mode state is missing, initialize/sync it from canonical team runtime state before proceeding
5. Keep team state alive until the worker is terminal (unless explicit abort)
6. Handle cleanup and stale-pane recovery when needed

If `jwc team` is unavailable, stop with a hard error.

## Invocation Contract

```bash
jwc team [N:agent-type] "<task description>"
```

Examples:

```bash
jwc team 3:executor "analyze feature X and report flaws"
jwc team "debug flaky integration tests"
jwc team "ship end-to-end fix with verification"
```

### Team-first launch contract

`jwc team ...` is now the canonical launch path for coordinated execution.
Team mode should carry visible worker delivery/verification lanes without
requiring a separate linked execution loop up front. jwc team supports current-window multi-worker mode; explicit `N:agent-type` values select worker count and shared role.

- **Canonical launch:** use plain `jwc team ...` / `$team ...` for the coordinated worker.
- **Verification ownership:** keep one lane focused on tests, regression coverage, and evidence before shutdown.
- **Typed lanes:** model delivery, verification, architecture, or specialist work as task `lane` metadata plus `required_role` / `allowed_roles`; claiming enforces owner, role, dependency, and lease order.
- **Escalation:** use a new explicit follow-up task only when later manual work still needs a persistent single-owner fix/verification loop.
- **Deprecation:** nested team execution commands have been removed. Use plain `jwc team ...` for coordinated execution.

### Team + Goal bridge

Use `$goal` for durable leader-owned goal/ledger tracking and `$team` for parallel visible tmux execution lanes. When Team is launched with an active `.jwc/goal/goals.json`, worker task/status context may include leader-owned Goal context: `.jwc/goal/goals.json`, `.jwc/goal/ledger.jsonl`, the active goal id, jwc goal mode, and the `fresh_leader_goal_get_required` checkpoint policy.

Workers provide task status and verification evidence only. They do not own Goal goal state, create worker ledgers, mutate `.jwc/goal`, auto-launch Team from Goal, or perform hidden jwc goal mutation. Workers must not run `jwc goal checkpoint`; checkpoint authority stays with the leader after worker tasks are terminal. Goal does not auto-launch Team and performs no hidden goal mutation. The leader uses terminal Team evidence plus a fresh `goal({"op":"get"})` snapshot and strict quality gate to run `jwc goal checkpoint --goal-id <id> --status complete --evidence "<team evidence mentioning .jwc/goal and <id>>" --gjc-goal-json <fresh-goal-get-json-or-path> --quality-gate-json <quality-gate-json-or-path>`.

### Worker command override

Important: `N:agent-type` (for example `3:executor`) selects the worker count and role prompt. Plain `jwc team "task"` defaults to 3 executor workers; `jwc team 1:executor "task"` is the explicit single-worker form.

To launch the worker with a specific jwc-compatible command, use `GJC_TEAM_WORKER_COMMAND`:

```bash
GJC_TEAM_WORKER_COMMAND="bun packages/coding-agent/src/cli.ts" jwc team executor "update docs and report"
```

## Preconditions

Before running `$team`, confirm:

1. `tmux` installed (`tmux -V`)
2. Current leader session is inside tmux (`$TMUX` is set)
3. `jwc` command resolves to the intended install/build
4. If running repo-local `node bin/gjc.js ...`, run `npm run build` after `src` changes
5. Check HUD pane count in the leader window and avoid duplicate `hud --watch` panes before split

Suggested preflight:

```bash
tmux list-panes -F '#{pane_id}\t#{pane_start_command}' | rg 'hud --watch' || true
```

If duplicates exist, remove extras before `jwc team` to prevent HUD ending up in worker stack.

## Pre-context Intake Gate

Before launching `jwc team`, require a grounded context snapshot:

1. Derive a task slug from the request.
2. Reuse the latest relevant snapshot in `.jwc/context/{slug}-*.md` when available.
3. If none exists, create `.jwc/context/{slug}-{timestamp}.md` (UTC `YYYYMMDDTHHMMSSZ`) with:
   - task statement
   - desired outcome
   - known facts/evidence
   - constraints
   - unknowns/open questions
   - likely codebase touchpoints
4. If ambiguity remains high, run `explore` first for brownfield facts, then run `$jaw-interview --quick <task>` before team launch.
5. If current correctness depends on official docs, version-aware framework guidance, best practices, or external dependency behavior, auto-delegate `researcher` as an evidence lane before or alongside worker launch instead of relying on repo-local recall alone.

Do not start the worker pane until this gate is satisfied; if forced to proceed quickly, state explicit scope/risk limitations in the launch report.

For simple read-only brownfield lookups during intake, follow active session guidance: when `USE_GJC_EXPLORE_CMD` is enabled, prefer `jwc explore` with narrow, concrete prompts; otherwise use the richer normal explore path and fall back normally if `jwc explore` is unavailable.

## Follow-up Staffing Contract

When `$team` is used as a follow-up mode from the planning stage, carry forward the approved plan's explicit **available-agent-types roster** and convert it into concrete staffing guidance before launch:

- keep worker-role choices inside the known roster
- state that jwc team launches the requested worker count and role allocation
- state the suggested reasoning level for each lane when available
- explain why each lane exists (delivery, verification, specialist support)
- include an explicit launch hint (`jwc team "<task>"` / `$team "<task>"`) for the coordinated worker run; mention `$goal` as the default durable follow-up/ledger path; mention a later separate Single-owner execution follow-up only when explicitly requested or genuinely needed as a fallback
- if the ideal role is unavailable, choose the closest role from the roster and say so
- For multi-worker follow-up execution, do not pass an inline "Split lanes: A..., B..." sentence as the whole team task. `jwc team` rejects ambiguous inline lane splits because they previously caused every worker to receive the same broad task. Use explicit markdown lane sections instead:
  ```md
  ### Lane A — Delivery
  Implement delivery-only changes and evidence.

  ### Lane B — Verification
  Add focused tests and smoke evidence.
  ```
  Explicit `### Lane <id> — <title>` sections are converted into distinct worker-owned initial tasks.

## Current Runtime Behavior (As Implemented)

`jwc team` currently performs:

1. Parse args (`N`, `agent-type`, task), default to 3 workers, and cap workers at 20.
2. Non-dry-run: detect the current tmux leader context with `display-message -p "#S:#I #{pane_id}"` before creating state or worktrees.
3. Initialize team state:
   - `.jwc/state/team/<team>/config.json`
   - `.jwc/state/team/<team>/manifest.v2.json`
   - `.jwc/state/team/<team>/tasks/task-*.json` (one per explicit lane section, otherwise one worker-owned compatibility task per worker)
   - `.jwc/state/team/<team>/mailbox/worker-1.json`
   - `.jwc/state/team/<team>/workers/<worker>/status.json`
   - `.jwc/state/team/<team>/workers/<worker>/lifecycle.json`
   - `.jwc/state/team/<team>/workers/<worker>/heartbeat.json`
4. Resolve the worker command from `GJC_TEAM_WORKER_COMMAND` or the active `jwc` entrypoint.
5. Split the current tmux window like jwc team: worker 1 is split horizontally to the right of the leader, workers 2..N are vertically stacked in the right column, then `select-layout main-vertical` and `main-pane-width` keep leader-left/worker-right at roughly 50/50.
6. Launch the worker with:
   - `GJC_TEAM_NAME=<team>`
   - `GJC_TEAM_WORKER_ID=worker-1`
   - `GJC_TEAM_STATE_ROOT=<leader-cwd>/.jwc/state/team`
   - optional `GJC_TEAM_WORKTREE_PATH=<path>` when worktree mode is active
7. Automatically integrate worker worktree commits during leader monitoring:
   - dirty worker worktrees are auto-checkpointed before integration
   - clean-ahead worker history is merged into the leader with a runtime merge commit
   - diverged worker history is cherry-picked into the leader
   - idle/done/failed worker worktrees are cross-rebased onto the updated leader after integration; working workers are skipped
   - conflicts are aborted, recorded, and reported to the leader mailbox without falsely advancing `last_integrated_head`
8. Store pane/target/integration/lifecycle evidence in config/manifest/snapshot: `tmux_session`, `tmux_session_name`, `tmux_target`, leader pane id, worker pane ids, `worker_lifecycle_by_id`, and `integration_by_worker`.
9. Return control to the leader; follow-up uses `status`, `resume`, `shutdown`, and `jwc team api`.

Important:

- Leader remains in the existing left pane.
- Worker panes are independent full jwc worker CLI sessions on the right side of a leader-left/worker-right split.
- Worker CLI selection is teammate-only: `GJC_TEAM_WORKER_CLI` and `GJC_TEAM_WORKER_CLI_MAP` accept only `auto` or `jwc`; legacy/provider values such as `codex`, `claude`, or `gemini` are rejected before launch.
- The worker may run in a dedicated git worktree (`jwc team --worktree[=<name>]`) while sharing the team state root.
- `shutdown` kills only the recorded worker pane after confirming it still belongs to the stored tmux target and is not the leader pane. It never kills the tmux session.

## Required Lifecycle (Operator Contract)

Follow this exact lifecycle when running `$team`:

1. Start team and verify startup evidence (team line, tmux target, worker pane id, state dir, `worker_lifecycle_by_id.<worker>.lifecycle_state=ready` after startup ACK).
2. Monitor task progress with runtime/state tools first (`jwc team status <team>`, `jwc team resume <team>`, task files).
3. Wait for terminal task state and integration settlement before shutdown:
   - `pending=0`
   - `in_progress=0`
   - `failed=0` (or explicitly acknowledged failure path)
   - no pending integration request/conflict (`status` / `resume` must not report `phase=awaiting_integration`)
4. Only then run `jwc team shutdown <team>`.
5. Verify shutdown evidence and preserved state (`phase=complete`, worker runtime status `stopped`, lifecycle `stopped` with a matching graceful shutdown request id). If shutdown is forced before evidence-backed task completion, expect `phase=cancelled` or `phase=failed`; if tasks are complete but integration is still pending or conflicted, expect `phase=awaiting_integration`, not `complete`.

Do not run `shutdown` while the worker is actively writing updates unless user explicitly requested abort/cancel. Do not treat ad-hoc pane typing as primary control flow when runtime/state evidence is available.

### Active leader monitoring rule

While a team is running, keep checking live team state until terminal completion.

Minimum acceptable loop:

```bash
sleep 30 && jwc team monitor <team-name>
```
The mutating monitor path also performs bounded liveness recovery: expired task claims, stale heartbeat claims, and missing recorded worker panes are requeued instead of leaving work permanently `in_progress`.

## Operational Commands

```bash
jwc team status <team-name>
jwc team monitor <team-name>
jwc team resume <team-name>
jwc team shutdown <team-name>
```

Semantics:

- `status`: read-only snapshot path; it does not recover claims, replay notifications, integrate worker commits, or sync HUD state.
- `monitor`: mutating monitor path; reads team snapshot, recovers expired/stale worker claims, applies pending worker worktree integration, replays notifications, syncs HUD state, and returns task counts, worker state, tmux target/pane evidence, `worker_lifecycle_by_id`, and `integration_by_worker`.
- `resume`: mutating monitor path; performs the same liveness-recovery and integration-aware live snapshot for reconnect/inspection flows.
- `list`: pure read path; lists known teams without integrating worker commits.
- API/read-only snapshot operations are pure unless explicitly documented as a monitor path.
- `claim-task`: mutating task path; before granting a new claim, it recovers expired claims and rejects claims from workers already classified as not live.
- `shutdown`: writes per-worker graceful `shutdown-request.json`, moves lifecycle through `draining` to `stopped`, kills the recorded worker pane when it still belongs to the stored tmux target, removes clean created worktrees, marks worker runtime status stopped, and sets phase from task, lifecycle, and integration state: `complete` only when all tasks have verified `completion_evidence`, every worker has matching graceful shutdown lifecycle evidence, and no integration request/conflict is pending; `awaiting_integration` when tasks and lifecycle are complete but leader integration still requires action; `failed` when tasks failed/blocked or completed tasks lack valid evidence; and `cancelled` when work remains pending or in progress. It preserves `.jwc/state/team/<team>` as evidence.

## Data Plane and Control Plane

### Control Plane

- Current tmux leader window and one or more worker panes.
- `jwc team` lifecycle commands.
- `jwc team api claim-task` and `jwc team api transition-task-status`.

### Data Plane

- `.jwc/state/team/<team>/config.json`
- `.jwc/state/team/<team>/manifest.v2.json`
- `.jwc/state/team/<team>/phase.json`
- `.jwc/state/team/<team>/events.jsonl`
- `.jwc/state/team/<team>/trace.jsonl`
- `.jwc/state/team/<team>/trace-errors.jsonl`
- `.jwc/state/team/<team>/telemetry.jsonl`
- `.jwc/state/team/<team>/monitor-snapshot.json`
- `.jwc/state/team/<team>/integration-report.md`
- `.jwc/state/team/<team>/tasks/task-1.json` (includes structured `completion_evidence` after completed transitions)
- `.jwc/state/team/<team>/mailbox/worker-1/<message-id>.json`
- `.jwc/state/team/<team>/mailbox/worker-1.json` (legacy compatibility view)
- `.jwc/state/team/<team>/notifications/<notification-id>.json`
- `.jwc/state/team/<team>/workers/<worker>/startup-ack.json`
- `.jwc/state/team/<team>/workers/<worker>/status.json`
- `.jwc/state/team/<team>/workers/<worker>/lifecycle.json`
- `.jwc/state/team/<team>/workers/<worker>/heartbeat.json`
- `.jwc/state/team/<team>/workers/<worker>/shutdown-request.json`
- `.jwc/state/team/<team>/workers/<worker>/nudges/<fingerprint>.json`
- `.jwc/reports/team-commit-hygiene/<team>.ledger.json`

## Team Mutation Interop (CLI-first)

Use `jwc team api` for machine-readable task lifecycle operations.

```bash
jwc team api worker-startup-ack --input '{"team_name":"my-team","worker_id":"worker-1","protocol_version":"1"}' --json
jwc team api claim-task --input '{"team_name":"my-team","worker_id":"worker-1"}' --json
jwc team api transition-task-status --input '{"team_name":"my-team","task_id":"task-1","to":"completed","worker_id":"worker-1","claim_token":"<claim-token>","completion_evidence":{"summary":"Completed requested work and verified it locally.","items":[{"kind":"command","status":"passed","summary":"Focused test passed","command":"bun test packages/coding-agent/test/jwc-runtime/team-runtime.test.ts"}],"files":["packages/coding-agent/test/jwc-runtime/team-runtime.test.ts"],"notes":"Include at least one passed command or verified inspection/artifact item."}}' --json
jwc team api update-worker-status --input '{"team_name":"my-team","worker_id":"worker-1","status":"working","current_task_id":"task-1"}' --json
jwc team api recover-stale-claims --input '{"team_name":"my-team"}' --json
jwc team api read-traces --input '{"team_name":"my-team"}' --json
jwc team api create-task --input '{"team_name":"my-team","subject":"Verify delivery","description":"Run verification","owner":"worker-1","lane":"verification","required_role":"executor","depends_on":["task-1"]}' --json
```

Canonical worker lifecycle operations:

- `worker-startup-ack` before task work; this records startup ACK and moves `workers/<worker>/lifecycle.json` to `ready`
- `claim-task`
- `update-worker-status` when the worker starts/stops a task-local activity; this updates worker-reported `status.json` without replacing the runtime lifecycle source of truth
- `recover-stale-claims` is leader/runtime-owned; it clears expired claim files, requeues in-progress tasks claimed by stale workers, and records `task_claim_recovered` events without modifying terminal task records or completion evidence
- `transition-task-status` with the claim token, worker id, and structured `completion_evidence` object
- `release-task-claim`
Claim eligibility is ordered and must not be bypassed: explicit task id selection, task status/terminal checks, owner/assignee checks, lane/role checks, dependency/blocked checks, then active lease creation. `lane` is descriptive metadata; `required_role` and `allowed_roles` are the enforced worker role gates.

Completion evidence is stored inline on the task record as `completion_evidence`. It must include a non-empty `summary`, an `items` array, and at least one item with `status: "passed"` or `status: "verified"`. Valid item kinds are `command`, `inspection`, and `artifact`; command items require `command`. The camel-case alias `completionEvidence` is accepted by the API input, but legacy string `evidence` and separate evidence files are not part of the public completion contract.

jwc-team interop operations are also available for mailbox, native notification, worker heartbeat/status, stale-claim recovery, startup ACK, events, monitor snapshots, approvals, and shutdown request/ack flows; run `jwc team api --help` for the full operation list.

Structured trace records in `trace.jsonl` are append-only schema version 1 entries. Each trace references the legacy `events.jsonl` source via `source_event_id`, keeps `event_type`, worker/task ids, and includes `evidence_refs` for completion evidence or claim recovery when available. Trace append failures are isolated in `trace-errors.jsonl` and do not break `events.jsonl` compatibility.

## jwc-native concept parity

jwc ports team-mode concepts from `../../oh-my-codex`, not code or OMX/Codex-specific assumptions:

| Concept | jwc-native equivalent |
|---------|-----------------------|
| Worker identity/inbox/mailbox paths | `.jwc/state/team/<team>/workers/<worker>/identity.json`, `inbox.md`, and per-message mailbox records under `.jwc/state/team/<team>/mailbox/<worker>/`. |
| Startup ACK | `jwc team api worker-startup-ack`, persisted as `workers/<worker>/startup-ack.json`. |
| Claim-safe lifecycle APIs | `claim-task`, `transition-task-status`, and `release-task-claim` with worker ownership and claim-token guards. |
| Delivery states and deferred pane attempts | Native notification records under `.jwc/state/team/<team>/notifications/` with `pending`, `sent`, `queued`, `deferred`, `failed`, `delivered`, and `acknowledged` states. |
| Non-destructive leader nudges | Lifecycle nudge records under `workers/<worker>/nudges/`; jwc suggests inspection/relaunch but never auto-kills or auto-relaunches workers. |

Forbidden assumptions: do not copy OMX paths, Codex notify payload formats, OMX process names, or source code directly. Keep tmux as the current runtime; native split-worker TUI remains roadmap-only.

Worker protocol:

- Send startup ACK with `worker-startup-ack` before task work.
- Report worker activity with `update-worker-status`; this is the worker-reported status plane, not the runtime lifecycle state.
- Claim pending work with `claim-task`.
- Transition the task to `completed`, `failed`, or `blocked` with `transition-task-status`, including claim token and evidence for completion.
- Commit or leave worktree changes in the worker worktree; the leader `monitor`/`resume` path will auto-checkpoint dirty worktrees and integrate committed history where possible.
- Record implementation/verification evidence in normal task output and state files; leader integration/conflict notifications are delivered through `.jwc/state/team/<team>/mailbox/leader-fixed.json`.

## Environment Knobs

Useful runtime env vars:

- `GJC_TEAM_TMUX_COMMAND`
  - tmux binary/command override (default `tmux`)
- `GJC_TEAM_WORKER_COMMAND`
  - worker command override (default resolves to active jwc entrypoint or `jwc`)
- `GJC_TEAM_STATE_ROOT`
  - team state root override (default `<cwd>/.jwc/state/team`)

## Failure Modes and Diagnosis

Operator note (important for jwc panes):
- Manual Enter injection (`tmux send-keys ... C-m`) can appear to "do nothing" when a worker is actively processing; Enter may be queued by the pane/task flow.
- This is not necessarily a runtime bug. Confirm worker/team state before diagnosing worker failure.
- Avoid repeated blind Enter spam; it can create noisy duplicate submits once the pane becomes idle.

### Common failures

- **Outside tmux:** non-dry-run launch fails before team state or worktrees are created. Start `jwc team` from an attached tmux leader pane.
- **Split failure:** startup records a failed phase if state was already initialized, rolls back created worktrees, and never kills the leader tmux session.
- **Worker API ENOENT:** team state is missing or `GJC_TEAM_STATE_ROOT` points somewhere else. Check `.jwc/state/team/<team>/` before assuming worker failure.
- **Stale pane on shutdown:** shutdown only kills a recorded worker pane when it still belongs to the stored `tmux_target` and is not the leader pane. Stale panes outside that target require manual inspection.
- **Integration conflict:** `jwc team monitor <team>` / `resume` aborts the failing merge, cherry-pick, or worker rebase; `jwc team status <team>` is read-only inspection. Inspect `.jwc/state/team/<team>/integration-report.md`, `.jwc/state/team/<team>/events.jsonl`, `.jwc/state/team/<team>/mailbox/leader-fixed.json`, and `.jwc/reports/team-commit-hygiene/<team>.ledger.json`.

### Safe Manual Intervention (last resort)

Use only after checking `jwc team status <team>` and state evidence:

1. Inspect team files:
   - `.jwc/state/team/<team>/config.json`
   - `.jwc/state/team/<team>/tasks/task-1.json`
   - `.jwc/state/team/<team>/mailbox/worker-1.json`
2. Capture pane tail to confirm current worker state:
   - `tmux capture-pane -t %<worker-pane> -p -S -120`
   - If a larger-tail read or bounded summary would help, prefer explicit opt-in inspection via `jwc sparkshell --tmux-pane %<worker-pane> --tail-lines 400` before improvising extra tmux commands.
3. If the pane is stuck in an interactive state, safely return to idle prompt first:
   - optional interrupt `C-c` or escape flow (CLI-specific) once, then re-check pane capture
4. Send one concise trigger only when runtime/state checks show manual prompt input is needed:
   - `tmux send-keys -t %<worker-pane> "continue current task; report status" C-m`
5. Re-check pane output, task state, worker mailbox, and `jwc team status <team>`.

### Shutdown reports success but stale worker panes remain

Cause:
- The stale pane was not the recorded worker pane, no longer belonged to the stored `tmux_target`, or came from a previous failed run.

Fix:
- Manually inspect panes before cleanup and kill only verified stale worker panes.

## Clean-Slate Recovery

Run from leader pane:

```bash
# 1) Inspect panes
tmux list-panes -F '#{pane_id}	#{pane_current_command}	#{pane_start_command}'

# 2) Kill verified stale worker panes only (examples)
tmux kill-pane -t %450
tmux kill-pane -t %451

# 3) Remove stale team state only after preserving needed evidence, using the state runtime
# cleanup verb documented by the current manifest

# 4) Retry
jwc team executor "fresh retry"
```

Guidelines:

- Do not kill the leader pane.
- Do not kill HUD panes unless intentionally restarting HUD.
- Prefer `jwc team shutdown <team>` for recorded active workers; use manual pane cleanup only for verified stale panes.

## Required Reporting During Execution

When operating this skill, provide concrete progress evidence:

1. Team started line (`Team started: <name>`)
2. tmux target and worker pane id
3. task state from read-only `jwc team status <team>`, mutating `jwc team monitor <team>`, or `.jwc/state/team/<team>/tasks/task-1.json`
4. shutdown outcome (`phase=complete`, worker status `stopped`) when the run is terminal; incomplete shutdowns must report `phase=cancelled`/`failed`, and integration-blocked shutdowns must report `phase=awaiting_integration`

Do not claim success without file/pane evidence.
Do not claim clean completion if shutdown occurred with `in_progress>0`.
Use `jwc sparkshell --tmux-pane ...` as an explicit opt-in operator aid for pane inspection and summaries; keep raw `tmux capture-pane` evidence available for manual intervention and proof.

## Programmatic Team Orchestration

Use the `jwc team ...` CLI as the supported team-launch surface. For automation, drive the same CLI flow from scripts or supervising agents rather than relying on a separate runtime integration runner.

### Supported current surfaces

- **`jwc team ...` CLI** — Primary method for interactive or automated team orchestration. Use this when you want direct tmux-pane visibility or a scriptable launch path.
- **Team state files** — Inspect `.jwc/state/team/<team>/` when you need status, task, or mailbox evidence after launch.

### Cleanup distinction

Two cleanup paths exist and must not be confused:

- `team_cleanup` (**state-server**): Deletes team state **files** on disk (`.jwc/state/team/<team>/`). Use after a team run is fully complete.
- tmux/session cleanup: Use the documented `jwc team` shutdown / cleanup flow when you need to stop the worker pane or clean up an interrupted run.

### Automation example

```
1. jwc team executor "fix bugs"
2. jwc team status <team-name>
3. jwc team shutdown <team-name>
4. Clean up the finished team state for <team-name>
```

## Limitations

- Worktree provisioning requires a git repository and can fail on branch/path collisions
- send-keys interactions can be timing-sensitive under load
- stale panes from prior runs can interfere until manually cleaned

## Scenario Examples

**Good:** The user says `continue` after the workflow already has a clear next step. Continue the current branch of work instead of restarting or re-asking the same question.

**Good:** The user changes only the output shape or downstream delivery step (for example `make a PR`). Preserve earlier non-conflicting workflow constraints and apply the update locally.

**Bad:** The user says `continue`, and the workflow restarts discovery or stops before the missing verification/evidence is gathered.

## Handoff back to planning or persistence

When the team task-set completes OR the user requests return to planning/persistence, mark team ready for handoff so the skill tool's chain guard permits the transition:

```
jwc state team write --input '{"current_phase":"handoff"}' --json
```

The skill tool then dispatches `/orchestrate p`, `/skill:jaw-interview`, or `/skill:goal` same-turn and runs `jwc state team handoff --to <plan|jaw-interview|goal> --json` in-process to atomically demote team, promote the callee, and sync both `skill-active-state.json` files. You do not need to run the handoff verb yourself.
