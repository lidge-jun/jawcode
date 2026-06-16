# P1.5.3 B fix summary after C failure

## C failure fixed

Source C failure: `devlog/_plan/260614_performance/48_p1_5_3_c_failure_synthesis.md` from C reviewer `agent://21-P153CAdversarial`.

### C-P153-1 — grep + unavailable digest paths unverified

Fix:
- Extended `packages/agent/test/pruning-redteam.test.ts` digest test to include:
  - `grep` result with matches/files digest;
  - unparseable `search` result asserting `search digest unavailable`.

### C-P153-2 — bash tail/error digest extraction under-tested and truncated away

Fix:
- Added `DIGEST_NOTICE_MIN_EXTRA_TOKENS = 24` to `packages/agent/src/compaction/pruning.ts` so digest notices remain bounded but can carry useful exit/tail/error summaries.
- Extended redteam assertions to require `exit=2`, `tail=done tail`, and `error=error: compile failed` in the bash digest notice.

## Verification

- `bun test packages/agent/test/pruning-redteam.test.ts packages/agent/test/pruning-staleness.test.ts packages/agent/test/pruning-staleness-redteam.test.ts` — PASS, 45 tests / 171 expects.
- `bun biome check packages/agent/src/compaction/pruning.ts packages/agent/test/pruning-redteam.test.ts packages/agent/test/pruning-staleness.test.ts packages/agent/test/pruning-staleness-redteam.test.ts devlog/_plan/260614_performance/41_p1_5_3_pruning_digest_plan.md devlog/_plan/260614_performance/04_verification_matrix.md devlog/_plan/260614_performance/23_p1_5_upstream_v3_merge_plan.md` — PASS.
- `bun --cwd=packages/agent run check` — PASS.
