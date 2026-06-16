# P1.5.3 D summary — pruning digest/staleness

## PABCD cycle summary

- P: Planned targeted pruning digest/staleness parity in `41_p1_5_3_pruning_digest_plan.md`, preserving Jawcode's native token-counting path and avoiding wholesale upstream replacement.
- A: Dual audit initially failed on Add File/parent-doc/Encoding evidence gaps; synthesis resolved them and planner/architect delta audits passed in `44_p1_5_3_audit_planner_r2.md` and `45_p1_5_3_audit_architect_r2.md`.
- B: Implemented bounded digest-aware notices, actual-notice `tokensSaved`, Add File staleness, parent-doc alignment, and focused tests; verifier DONE in `47_p1_5_3_b_verifier_done.md`.
- C: First adversarial review failed on missing grep/unavailable and bash tail/error coverage; B fix added coverage and digest budget, verifier DONE in `50_p1_5_3_b_verifier_r2_done.md`; final C gates/re-review passed in `51_p1_5_3_c_check_pass.md`.

## Files changed for this slice

- `packages/agent/src/compaction/pruning.ts`
- `packages/agent/test/pruning-redteam.test.ts`
- `packages/agent/test/pruning-staleness.test.ts`
- `devlog/_plan/260614_performance/04_verification_matrix.md`
- `devlog/_plan/260614_performance/23_p1_5_upstream_v3_merge_plan.md`
- `devlog/_plan/260614_performance/41_p1_5_3_pruning_digest_plan.md`
- `devlog/_plan/260614_performance/42_p1_5_3_critic_synthesis_round1.md`
- `devlog/_plan/260614_performance/43_p1_5_3_audit_synthesis_round1.md`
- `devlog/_plan/260614_performance/44_p1_5_3_audit_planner_r2.md`
- `devlog/_plan/260614_performance/45_p1_5_3_audit_architect_r2.md`
- `devlog/_plan/260614_performance/46_p1_5_3_b_summary.md`
- `devlog/_plan/260614_performance/47_p1_5_3_b_verifier_done.md`
- `devlog/_plan/260614_performance/48_p1_5_3_c_failure_synthesis.md`
- `devlog/_plan/260614_performance/49_p1_5_3_b_fix_summary.md`
- `devlog/_plan/260614_performance/50_p1_5_3_b_verifier_r2_done.md`
- `devlog/_plan/260614_performance/51_p1_5_3_c_check_pass.md`

## Acceptance criteria met

- Digest-capable `bash`, `search`, and `grep` pruned notices include bounded summaries.
- Unparseable search/grep output falls back to `search digest unavailable`.
- Non-digest tools keep generic `[Output truncated - N tokens]` notices.
- `tokensSaved` is calculated from the actual notice length.
- Optional native token-counting signature/branch is preserved; runtime fixture gap is explicitly waived in B/C artifacts.
- `*** Add File:` patch envelopes stale earlier reads; selector, Move to, failed per-file, resolve/ast_edit, and search-default staleness coverage remains.
- Parent P1.5 matrix/plan no longer claim absent `compaction-estimate-cache.test.ts` for this slice.

## Verification evidence

- `bun run check` — PASS.
- `bun test packages/agent/test/pruning-redteam.test.ts packages/agent/test/pruning-staleness.test.ts packages/agent/test/pruning-staleness-redteam.test.ts` — PASS, 45 tests / 171 expects.
- Focused biome command — PASS.
- `bun --cwd=packages/agent run check` — PASS.
- C adversarial re-review — PASS.

## WONDER

- Runtime native `Encoding` behavior is not directly tested because no runtime-safe test fixture exists in `packages/agent/test`; the branch is preserved and typechecked, but not behavior-exercised.
- Digest notice sizing now includes a small extra budget to carry useful fields; future perf corpus data should validate the summary/size tradeoff against real outputs.
- This slice intentionally defers `openai.ts` / token-estimation cache work because the parent-listed `compaction-estimate-cache.test.ts` is absent locally.

## REFLECT

- P1.5.3 plans need sharper separation between digest-notice behavior and token-estimation-cache behavior.
- Tests should state which digest fields must survive truncation; the first C review correctly caught that `exit` alone was not enough.
- If native token-counting behavior remains important, add a reusable `Encoding` fixture/test harness before future compaction changes.

## Goal continuation

This closes P1.5.3. The active goal remains unfinished because P1.5.2 resident cache lifecycle/manual session-manager merge remains.
