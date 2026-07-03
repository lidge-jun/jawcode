# 260703 chase hardening + goal slash state replacement — MOC

Status: active loop
Owner: Boss
Created: 2026-07-03
Work class: C3 hardening plan

## Objective

Plan the seven chase items that can be closed as hardening without product-direction decisions, plus one user-requested JWC patch: `/goalplan` or `/goal <user input>` must force entry into a new goal state regardless of the current goal state, instead of being swallowed, menu-routed, or blocked by existing goal-mode state.

Phase 80 has been implemented and verified; remaining chase hardening phases are pending PABCD cycles.

## Evidence read

- `struct_har/chase/10.071_gjc_chase_search_utils_edit_safety.md` — generic search/utils/edit safety.
- `struct_har/chase/10.073_gjc_chase_rpc_session_notifications_lifecycle.md` — session close, notifications, Python RPC protocol sync.
- `struct_har/chase/20.037_omp_chase_session_async_plan_integrity.md` — session async/data integrity.
- `struct_har/chase/20.038_omp_chase_hashline_tool_plugin_task_safety.md` — edit/tool/plugin/task safety.
- `struct_har/chase/20.039_omp_chase_tui_terminal_render_resilience.md` — TUI perf/repaint/render resilience.
- `struct_har/chase/10.072_gjc_chase_model_selector_tmux_cmux_ux.md` — tmux/cmux + model selector UX; hardening subset only.
- `struct_har/chase/20.040_omp_chase_robomp_iso_sandbox_release.md` — sandbox/process/release references; hardening subset only.
- `packages/coding-agent/src/slash-commands/builtin-registry.ts:491-531` — text-mode `/goal` and `/goalplan` start helpers currently create/replace goal state and return a prompt.
- `packages/coding-agent/src/slash-commands/builtin-registry.ts:662-685` — `/goal` TUI command delegates to `runtime.ctx.handleGoalModeCommand()`.
- `packages/coding-agent/src/slash-commands/builtin-registry.ts:770-784` — `/goalplan` TUI command converts to `plan ...` and also delegates to `handleGoalModeCommand()`.
- `packages/coding-agent/src/modes/interactive-mode.ts:1759-1800` — TUI goal handler blocks in plan mode, dispatches subcommands, replaces active goals, warns on paused goals, or opens menus depending on current goal state.
- `packages/coding-agent/src/modes/interactive-mode.ts:1805-1824` — `plan` subcommand dispatches into goal planning rather than pass-through.

## Non-goals

- Do not implement the new chase cards in this plan pass.
- Do not change public workflow count.
- Do not simplify curated TUI visuals, welcome banner, viewport fill, or tool folding while doing TUI hardening.
- Do not change provider/model catalog policy from hardening-only work.
- Do not alter `.jwc/goal` ledger semantics except for the explicit slash input state-replacement patch.

## Phase map
## Loop status

| Phase | Description | Status | Cycle ref |
|---|---|---|---|
| 80 | `/goal` and `/goalplan` force new goal state | done | `80_plan.md`, `80.6_c_check.md`, commits `238e04e`, `1fbb4c7` |
| 10 | `10.071` search/utils/edit safety | done | `10_plan.md`, `10.6_b_verifier.md`, `10.7_c_check.md`, commits `67129ab`, `3d98fd2` |
| 20 | `20.038` hashline/tool/plugin/task safety | done | `20_plan.md`, `20.6_b_verifier.md`, `20.7_c_check.md`, commit `5894e86` |
| 30 | `20.037` session async/plan integrity | active | `30_plan.md`, `30.4_b_verifier.md` |
| 40 | `10.073` RPC/session/notifications lifecycle | pending | — |
| 50 | `20.039` TUI terminal/render resilience | pending | — |
| 60 | `10.072` tmux/cmux hardening subset | pending | — |
| 70 | `20.040` sandbox/process hardening subset | pending | — |

### Phase 10 — `10.071` search/utils/edit safety

Card: `struct_har/chase/10.071_gjc_chase_search_utils_edit_safety.md`

Scope:

- Web search timeout/hedging/prewarm/fail-through improvements where JWC lacks them.
- `packages/utils/src/glob.ts` exclude precompile equivalent.
- `packages/utils/src/format.ts` compact-unit rounding boundary equivalent.
- `packages/coding-agent/src/edit/read-file.ts` UTF-8 BOM preservation in replace mode.

Decision: import/adapt. No product direction required.

Acceptance:

- Focused tests cover every imported/adapted behavior.
- `bun run check:tools` passes.

### Phase 20 — `20.038` hashline/tool/plugin/task safety

Card: `struct_har/chase/20.038_omp_chase_hashline_tool_plugin_task_safety.md`

Scope split:

1. hashline/edit provenance and seen-line/recovery safety;
2. tool argument/path coercion safety;
3. custom-tool/plugin loader exit guards and cache ordering;
4. task/worktree isolation and extension-agent discovery safety;
5. subprocess/SSH/DAP lifecycle leak hardening.

Decision: split/adapt. No product direction required if each slice preserves current public behavior.

Acceptance:

- Each adopted slice has a regression test.
- No broad lint-only closure.

### Phase 30 — `20.037` session async/plan integrity

Card: `struct_har/chase/20.037_omp_chase_session_async_plan_integrity.md`

Scope:

- Pending async background jobs survive or delay session termination safely.
- Atomic session rewrite/fence behavior preserves newer data.
- Plan-mode convergence cannot bypass ask/resolve or JWC approval gates.
- Goal recovery model switching does not weaken `.jwc` goal/orchestrate semantics.

Decision: adapt. No user/product decision required unless behavior changes visible goal/plan semantics.

Acceptance:

- Focused `agent-session-*`, `session-*`, and goal/plan convergence tests.
- Explicit classification of any OMP behavior rejected because it conflicts with JWC gates.

### Phase 40 — `10.073` RPC/session/notifications lifecycle

Card: `struct_har/chase/10.073_gjc_chase_rpc_session_notifications_lifecycle.md`

Scope:

- Session close/postmortem notification equivalent.
- Telegram recent formatting equivalent if JWC surface exists.
- Python RPC protocol/client sync through JWC naming (`python/jwc-rpc`, `jwc_rpc`).
- Resume hint formatting as `jwc`.

Decision: adapt. No product direction required if fail-closed routing is preserved.

Acceptance:

- Focused notification/session tests.
- Python RPC tests under the JWC package path.
- Docs updated only if public RPC/notification behavior changes.

### Phase 50 — `20.039` TUI terminal/render resilience

Card: `struct_har/chase/20.039_omp_chase_tui_terminal_render_resilience.md`

Scope:

- TUI CPU overhead reductions that preserve visual behavior.
- SSH/topology repaint fixes.
- Live tool spinner/frozen preview safety.
- Move overlay/autocomplete performance guards.

Decision: adapt with TUI-protection gate.

Hard boundary:

- Read `structure/31_scroll.md` before touching `packages/tui/src/tui.ts` scroll/fill/gap logic.
- Do not simplify or remove curated welcome/banner/viewport/tool-folding behavior.

Acceptance:

- Focused TUI/component tests or reproducible terminal artifact.
- Existing curated TUI contracts remain intact.

### Phase 60 — `10.072` tmux/cmux hardening subset

Card: `struct_har/chase/10.072_gjc_chase_model_selector_tmux_cmux_ux.md`

Hardening-only scope:

- managed `--tmux` window sizing on attach;
- tmux status-line sizing;
- preserve tmux session after PTY close;
- coordinator multiline prompt delivery;
- coordinator MCP Enter submission;
- cmux workspace rename guard.

Explicitly out of hardening-only scope:

- beginner command palette UX direction;
- broad visual/model selector redesign.

Decision: adapt hardening subset only.

Acceptance:

- Focused launch-tmux/cmux/coordinator tests.
- No curated TUI visual simplification.

### Phase 70 — `20.040` sandbox/process hardening subset

Card: `struct_har/chase/20.040_omp_chase_robomp_iso_sandbox_release.md`

Hardening-only scope:

- sandbox cleanup/worktree failure handling if equivalent JWC Python surface exists;
- stderr draining / process timeout hardening;
- update/usage CLI reporting fixes only if behavior is already in JWC scope.

Pre-read requirement:

- Before touching `python/robojwc/`, read `python/robojwc/AGENTS.md`.
- Before release/update policy changes, read `structure/60_release_publishing.md`.

Explicitly out of hardening-only scope:

- release policy changes;
- Docker/package strategy changes;
- new product surface.

Acceptance:

- Python tests for sandbox/worktree behavior where applicable.
- CLI tests for update/usage behavior where applicable.

### Phase 80 — User patch: `/goal` and `/goalplan` force new goal state

User request, corrected:

> `/goalplan` or `/goal` user input should enter a **new goal state** regardless of the current goal state.

Current behavior summary:

- Text-mode `/goal <objective>` uses `startTextGoal()` and already creates/replaces goal state, then returns `{ prompt: trimmedObjective }`.
- Text-mode `/goalplan [hint]` uses `startTextGoalPlan()` and already creates/replaces goal-planning state, then returns a generated planning prompt.
- TUI `/goal` delegates to `handleGoalModeCommand(command.args)`.
- TUI `/goalplan` converts args to `plan <hint>` and also delegates to `handleGoalModeCommand()`.
- `InteractiveMode.handleGoalModeCommand()` branches on current plan/goal/paused state, and can warn, replace active goals, open menus, or dispatch plan subcommands. The paused-goal path currently blocks setting a new objective.

Patch intent:

When the user enters either of these forms with non-empty user input:

- `/goal <new objective>`
- `/goalplan <planning hint>`
- `/goal plan <planning hint>` if used as the `/goal` subcommand form

then JWC must create/replace into the corresponding **new goal state** regardless of the existing goal state:

- active goal → replace with the new goal/new goal-planning brief;
- paused goal → replace/drop the paused in-session state as needed and enter the new active goal/new goal-planning state;
- no goal → enter the new goal/new goal-planning state as today.

The input should not be swallowed by menus or blocked by paused/current goal diagnostics. The point is not raw chat pass-through; the point is state transition into a fresh goal context.

Recommended implementation shape:

1. In `builtin-registry.ts`, keep text/ACP behavior aligned with the corrected contract:
   - `/goal <objective>` → create/replace goal plan and in-session goal state;
   - `/goalplan <hint>` → create/replace AI-driven goal-planning state.
2. In TUI `/goal` `handleTui`, for non-empty objective payloads, bypass the paused-goal warning path and force the same replacement semantics as text mode.
3. In TUI `/goalplan` `handleTui`, do not route `plan <hint>` through the generic `handleGoalModeCommand()` branch that can be blocked by current state; force the same replacement semantics as `startTextGoalPlan()`.
4. Preserve administrative commands:
   - no-arg `/goal` still opens/shows current goal UI/status;
   - `/goal show|status|pause|resume|drop` still operate the current goal;
   - `/goal set <objective>` remains explicit state mutation and should also be allowed to replace paused/active goal state.
5. Ensure replacement does not leave stale goal tool state, stale continuation flags, or paused goal UI status behind.

Candidate files:

- `packages/coding-agent/src/slash-commands/builtin-registry.ts`
- `packages/coding-agent/src/modes/interactive-mode.ts`
- `packages/coding-agent/test/slash-command-builtin-registry.test.ts`
- relevant TUI command-controller / interactive-mode tests covering `handleTui` state replacement.

Acceptance:

- Text-mode `/goal ship X` creates/replaces goal state even if an active or paused goal exists.
- Text-mode `/goalplan investigate X` creates/replaces goal-planning state even if an active or paused goal exists.
- TUI `/goal ship X` enters a new active goal state and does not open the old goal menu or warn about paused goal.
- TUI `/goalplan investigate X` enters new AI-driven goal-planning state and does not get blocked by old active/paused goal state.
- No-arg `/goal` still shows current goal status/menu.
- `/goal show|status|pause|resume|drop` still work.
- `/goal set <objective>` remains explicit state mutation and is allowed to replace active/paused state.

## Suggested execution order

1. Phase 80 first, because it fixes the operator control-path annoyance currently visible in this session.
2. Phase 10, 20, 30, 40 as high-confidence hardening.
3. Phase 60 and 50 after TUI/tmux tests are selected.
4. Phase 70 only after reading `python/robojwc/AGENTS.md` and confirming which JWC Python surface exists.

## Verification bundle for full plan closure

- Focused tests per phase.
- `git diff --check`.
- `bun run check:tools`.
- `bun run check:ts` only when touched files/types warrant it.
- For TUI phase, include a targeted terminal/TUI or component-render proof rather than broad lint-only confidence.
