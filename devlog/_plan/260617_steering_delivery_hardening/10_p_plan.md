# 10 P plan — steering delivery hardening

## Decision

Proceed with `20.005` as a JWC-native race fix, not a wholesale OMP import.

Current evidence shows:

- JWC already has idle-path followUp auto-continue in `AgentSession`.
- JWC does not re-poll steering at the agent-loop yield boundary.
- JWC does not run a settle-time stranded followUp drain when `#promptInFlightCount` reaches zero.
- `20.003` is already absorbed by `99.01` and should be archived before the new active card starts.

## Planned Edits

### 1. Close 20.003

Status after P/A checkpoint: complete in commit `64cd241f`.

Moved:

- from `struct_har/chase/20.003_omp_chase_memory_skills.md`
- to `struct_har/chase/_fin/20/20.003_omp_chase_memory_skills.md`

Update indexes:

- `struct_har/chase/20_omp_chase_MOC.md`
- `struct_har/chase/007_follow_index.md`
- `struct_har/chase/002_gap_inventory.md`
- `struct_har/chase/_fin/20/README.md`
- `struct_har/chase/_fin/INDEX.md`

Closeout basis:

- `structure/50_status.md` marks `99.01` as complete for `jwc memory *` + `jwc chat search`.
- `struct_har/chase/006_jwc_own_backlog.md` marks `jwc memory CLI` as complete.

### 2. Build 20.005 race hardening

Modify:

- `packages/agent/src/agent-loop.ts`
  - After `onBeforeYield`, re-poll `getSteeringMessages()` before followUp drain.
  - If late steering exists, process it as pending user messages before the agent ends.

- `packages/coding-agent/src/session/agent-session.ts`
  - Add settle-time stranded followUp drain only in the normal `#endInFlight()` path after `#promptInFlightCount` reaches zero.
  - Do not trigger this drain from `#resetInFlight()`; reset/abort recovery has separate steering-specific behavior and must not spawn followUp continues during abort cleanup.
  - Reuse `#canAutoContinueForFollowUp()` and `agent.hasQueuedMessages()` as the single gate to avoid double continue.

- `packages/coding-agent/test/agent-session-queued-prompts.test.ts`
  - Add regression tests for:
    - steering queued inside `onBeforeYield` is delivered before session end;
    - followUp queued while `#promptInFlightCount` is still active is drained after settle.

### 3. Documentation

Update:

- `struct_har/chase/20.005_omp_chase_steering_delivery.md`
- `struct_har/chase/20_omp_chase_MOC.md`
- `struct_har/chase/007_follow_index.md`
- `struct_har/chase/002_gap_inventory.md`
- this devlog folder with A/B/C/D evidence.

### 4. Dirty Work Commit

Existing dirty jaw-interview changes predate this goal and are not part of the steering fix. They will be inspected, tested with the affected tests/gates, and committed as a separate logical commit before pushing.

Tracked runtime goal files under `.jwc/goal/` will be inspected before staging; they will not be mixed into feature commits unless they are part of a deliberate workflow-state commit.

## Verification Plan

Run focused tests first:

```bash
bun test packages/coding-agent/test/agent-session-queued-prompts.test.ts
```

Then affected gates for dirty jaw-interview work:

```bash
bun test packages/coding-agent/test/jwc-runtime/jaw-interview-runtime.test.ts \
  packages/coding-agent/test/jwc-runtime/orchestrate-state.test.ts \
  packages/coding-agent/test/jwc-runtime/skill-command-ref.test.ts \
  packages/coding-agent/test/jaw-interview-skill-policy.test.ts \
  packages/coding-agent/test/default-jwc-definitions.test.ts \
  packages/coding-agent/test/interactive-mode-status.test.ts \
  packages/coding-agent/test/status-line-pabcd-segment.test.ts
bun scripts/verify-g002-gates.ts
```

Final repository verification:

```bash
bun run check:ts
git status --short --branch
git push origin dev
```

Push note: this goal's user hint explicitly requested committing dirty work and pushing `dev` in this same `/goal plan` turn, so `git push origin dev` is authorized for the final step after local verification and commits.
