# P1.5.5 critic synthesis — round 1

> Plan reviewed: `24_p1_5_5_profiling_infra_execution_plan.md`
> Critic artifact: `.jwc/plans/planphase/2026-06-14-1443-a05a/stage-01-critic.md`
> Verdict: ITERATE

## Findings and decisions

### C1 — Session-memory acceptance was not bound to a hard check

- Critic claim: the plan said the session-memory bench must remove temp dirs and emit finite RSS growth, but section 4 only smoke-ran the bench.
- Decision: accept.
- Plan change: `24_p1_5_5_profiling_infra_execution_plan.md` now requires `measureSessionMemory(entryCount, chars, { rootParent })`, and `packages/coding-agent/test/perf-corpus.test.ts` must include a small fixture asserting warm entry count, finite RSS growth, and cleanup of `jwc-session-memory-*` under a test-owned temp parent.

### C2 — Verification matrix / latency-gate wording could confuse this P1.5.5 slice

- Critic claim: P1.5.5 ships corpus infra, not additional latency-gate files; C-stage needs an explicit contract.
- Decision: accept.
- Plan change: section 4 now has a C-stage contract stating that corpus tests are the hard gate, the two bench commands are JSON-emitting smoke gates, and separate TUI latency gates belong to P1.5.1, not this slice.

### C3 — SessionManager API pointer would reduce executor search

- Critic claim: optional pointer to `SessionManager.create(root, path.join(root, "sessions"))`, `appendMessage`, and `getEntries()` would reduce ambiguity.
- Decision: accept.
- Plan change: session-memory file outline now names those APIs and the deterministic user-message shape.

## Result

The plan was patched for all critic findings. Re-run Critic against the changed plan and this synthesis; no waiver is used.
