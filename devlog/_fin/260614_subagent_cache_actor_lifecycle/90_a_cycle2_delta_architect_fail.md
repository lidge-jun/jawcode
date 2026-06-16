FAIL

[HIGH] §6.1 / packages/coding-agent/src/task/index.ts:1368-1487 — Pre-resume actor maintenance is specified but not present between compatible actor resolution and dispatch — Add `maintainWorkflowActorBeforeResume(actor, sessionFile)` before `runMode: "message"`, actor-scoped session open, compaction/prewarm, metadata update.
[HIGH] §6.1 / §8.2 / §12.2 / packages/coding-agent/test — Required black-box/self-fork tests are absent — Add the files or map acceptance to existing tests plus new cases.
[HIGH] §3.5 / §3.6 / §6.1 acceptance / packages/coding-agent/src/task/index.ts — Persisted actor metadata can still select idle actors without context-unavailable guard — Add current-process openability/resume guard and test.
[MEDIUM] §4.4 / §6.1 / §12.1 / packages/coding-agent/src/task — Cache-affinity metadata is planned but unwired — Extend result/receipt details and assert self-fork/executor_ext/fallback/prewarm failure state.
[MEDIUM] §6.1 / orchestrate-b.md, orchestrate-c.md — B/C prompt semantics still stale — Update prompts and add assertion.
[MEDIUM] §3.1 vs §6.1 vs §8.2 — Superseded retirement test filename remains inconsistent — Canonicalize to `orchestrate-actor-lifecycle.test.ts`.
[MEDIUM] §5.4 / §6.1 / plan-writer.ts — Planphase metadata authority remains ambiguous in docs/skill guidance — Align plan-skill/operator guidance with actor-registry authority.
[LOW] §6.1 / agent-session.ts — Actor-scoped session opening is unnamed — Document the concrete entry and parent-scope prohibition.
[LOW] §11 vs §12 — Scaffold-vs-open status can be misread — Add open/closed checklist.

Single point most likely to break first: Implementing cycle-2 §6.1 without an actor-scoped session open + pre-resume hook will either skip compaction/prewarm entirely or run it on the parent session, so PABCD `runMode: "message"` resume will not match the plan’s actor-local cache/maintenance contract.
