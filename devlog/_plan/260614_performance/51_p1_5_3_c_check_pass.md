PASS

Mechanical gates:
- `bun run check` — PASS.
- `bun test packages/agent/test/pruning-redteam.test.ts packages/agent/test/pruning-staleness.test.ts packages/agent/test/pruning-staleness-redteam.test.ts` — PASS, 45 tests / 171 expects.
- Focused biome command from plan — PASS.
- `bun --cwd=packages/agent run check` — PASS.

Adversarial review:
- First C review failed on missing grep/unavailable digest coverage and missing tail/error bash assertions: `48_p1_5_3_c_failure_synthesis.md`.
- B fix added grep and unavailable search redteam coverage, increased bounded digest budget, and asserted bash `exit`, `tail`, and `error` fields: `49_p1_5_3_b_fix_summary.md`.
- B verifier confirmed fixes: `50_p1_5_3_b_verifier_r2_done.md`.
- C re-review PASS: no blocking findings.

Acceptance criteria:
- Digest-capable bash/search/grep pruned notices include bounded summary fields.
- Non-digest tool notices preserve generic `[Output truncated - N tokens]` format.
- `tokensSaved` accounts for actual digest notice length.
- Encoding branch preserved; runtime fixture unavailable waiver recorded and cited.
- Add File patch envelopes stale earlier reads; existing selector, Move to, failed per-file, and search-default staleness coverage remains.
- Parent plan/matrix wording aligned for this slice.

Residual risk:
- Encoding preservation is type/signature covered and explicitly waived at runtime fixture level; no test currently instantiates a real native `Encoding` fixture in `packages/agent/test`.
