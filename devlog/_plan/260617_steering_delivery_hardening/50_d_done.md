# 50 D done — steering delivery hardening

## Delivered

1. Closed `20.003` memory/skills as reference-only absorbed by `99.01`.
2. Implemented `20.005` steering delivery hardening:
   - yield-boundary steering re-poll in `packages/agent/src/agent-loop.ts`;
   - normal-settle stranded followUp drain in `packages/coding-agent/src/session/agent-session.ts`;
   - no drain in `#resetInFlight()` abort/reset path.
3. Added focused regressions in `packages/coding-agent/test/agent-session-queued-prompts.test.ts`.
4. Updated chase/devlog evidence for `20.005`.
5. Committed pre-existing dirty work as separate logical commits:
   - jaw-interview strict summary handoff/fresh-fork evaluator;
   - goal guard receipt diagnosis docs;
   - tracked `.jwc/goal` workflow-state update.

## Verification

- `bun test packages/coding-agent/test/agent-session-queued-prompts.test.ts` — PASS, 4 tests.
- Affected jaw-interview tests — PASS, 123 tests.
- `bun scripts/verify-g002-gates.ts` — PASS.
- `bun run check:ts` — PASS.
- Backend B verifier — DONE.
- `git status --short --branch` before D doc — clean, `dev...origin/dev [ahead 15]`.

## Commits

- `64cd241f` — `docs(chase): close memory skills reference card`
- `b21f2315` — `fix(session): drain queued steering at turn boundary`
- `693aa006` — `feat(interview): enforce strict summary handoff`
- `ede23230` — `docs(goal): record receipt guard diagnosis`
- `7e44b9fd` — `chore(goal): update receipt guard state`

## WONDER

- Interruptible tool polling from OMP v15.13.3 was compared at the chase-card level but not adopted in this patch. JWC's async job/background model may still need a separate job-polling card.
- The followUp stranded-drain regression uses an extension `agent_end` hook to hit the race boundary. It proves the current race, but a future ACP/RPC integration test could cover a real client.
- The normal-settle drain schedules a continue before flushing the deferred wire-level `agent_end`; this is intentional so the final external idle signal can represent the last turn, but client-specific behavior should be watched.

## REFLECT

- The acceptance criteria were strong for steering/followUp queue delivery but should have explicitly excluded `#resetInFlight()` from the beginning.
- Future chase cards should separate "implement now" from "compare only" rows, because interruptible tool polling belongs to a different runtime owner.
- The ontology is clearer as two queues and two boundaries:
  - agent-loop yield boundary for late steering;
  - session normal-settle boundary for stranded followUp.

## Verdict

Done. D phase completed and orchestration returned to IDLE.
