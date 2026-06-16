# P1.5 upstream Optimization Suite v3 goal completion audit

Objective: Continue the P1.5 upstream Optimization Suite v3 merge under PABCD/goal tracking: preserve completed P1.5.1 input render priority patch, implement remaining lanes in value order starting with P1.5.5 profiling infrastructure, and verify each implemented lane with focused gates before closing the goal.

## Deliverables and current evidence

| Lane | Deliverable | Current evidence |
|---|---|---|
| P1.5.1 input render priority | Preserve expedited input render patch and focused tests. | `bun test packages/tui/test/input-render-latency.test.ts packages/tui/test/input-render-redteam.test.ts` → 9 pass / 27 expects. |
| P1.5.5 profiling infrastructure | Perf corpus schema/ledger/bench, session memory bench, docs/policy. | `bun test packages/coding-agent/test/perf-corpus.test.ts` → 11 pass / 99 expects; `bun packages/coding-agent/bench/perf-corpus.bench.ts` emitted `jwc.perf-corpus/1`; `bun --smol --expose-gc packages/coding-agent/bench/session-memory.bench.ts` emitted finite RSS JSON. |
| P1.5.4 serialization/diff parity | Single-pass secrets/diff/LCS parity tests and source deltas. | `bun test packages/coding-agent/test/secrets-obfuscator.test.ts packages/coding-agent/test/core/diff-oracle.test.ts packages/coding-agent/test/hindsight-mental-models-lcs.test.ts` → 30 pass / 12 snapshots / 204 expects. |
| P1.5.3 pruning digest/staleness | Digest-aware pruning notices and staleness parity. | `bun test packages/agent/test/pruning-redteam.test.ts packages/agent/test/pruning-staleness.test.ts packages/agent/test/pruning-staleness-redteam.test.ts` → 45 pass / 171 expects. |
| P1.5.2 resident cache lifecycle | Split resident cache ownership, fail-closed materialization, lifecycle/reset coverage. | `bun test packages/coding-agent/test/session-resident-cache.test.ts packages/coding-agent/test/session-resident-lifecycle.test.ts packages/coding-agent/test/session-resident-ownership.test.ts packages/coding-agent/test/resident-materialization.test.ts packages/coding-agent/test/session-manager/resident-retention.test.ts` → 28 pass / 171 expects. |
| Workspace integration | No type/lint/rebrand/Rust-scope regression. | `bun run check` → PASS after P1.5.2 C retry. |
| PABCD/goal tracking | Final P1.5.2 cycle closed under PABCD. | `devlog/_plan/260614_performance/66_p1_5_2_d_summary.md`; `jwc orchestrate d --complete` closed state. |

## Conclusion

All concrete P1.5 lanes have current focused verification evidence, and the workspace gate is green. The active goal is complete.
