# P1.5.3 critic synthesis — round 1

> Plan: `devlog/_plan/260614_performance/41_p1_5_3_pruning_digest_plan.md`
> Critic artifact: `.jwc/plans/planphase/2026-06-14-1443-a05a/stage-01-critic.md`
> Verdict: ITERATE

## Findings and resolutions

### C1 — Verification did not include all staleness test files

Decision: accept.

Resolution: focused gates now run `pruning-redteam.test.ts`, `pruning-staleness.test.ts`, and `pruning-staleness-redteam.test.ts`; biome check includes all three test files.

### C2 — `tokensSaved` must account for actual digest notice length

Decision: accept.

Resolution: the redteam test plan now requires a digest-capable `tokensSaved` assertion and updating any helper that assumed generic-only notice length.

### C3 — Encoding preservation needed explicit coverage or evidence

Decision: accept with bounded fallback.

Resolution: the plan now asks for one focused encoding regression fixture when an existing test Encoding utility is available. If not, B summary must document native-counting preservation via unchanged function signature and package typecheck.

### C4 — Staleness parity sourcing/placement was ambiguous

Decision: accept.

Resolution: the plan now names upstream `pruning.ts` as source for Add File, Move to, failed per-file grouping, and digest helpers. It also assigns existing selector/Move to/failed/search-default coverage to `pruning-staleness.test.ts` and Add File coverage beside existing Update/Delete envelope tests.

### C5 — Missing compaction-estimate-cache test file not explained

Decision: accept.

Resolution: the plan now explicitly states `packages/agent/test/compaction-estimate-cache.test.ts` is parent-listed but absent locally and out of scope until it exists.
