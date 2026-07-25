# 024 — C-stage failure synthesis (wp2, adversarial review round 1)

Reviewer: Noether (019f99ee-7945-7a91-9571-11fecab98ca6), fresh sol adversarial reviewer, verdict **FAIL** with 6 blockers.
Synthesis per REVIEW-SYNTHESIS-01: per-blocker RCA + accept/rebut + disposition.

| # | severity | RCA | accept/rebut | disposition |
|---|---|---|---|---|
| 1 | Critical — 021 no-card exclusions invalid (`7cbcc3e3a`, `08e617eec`, `dd84ec57c`) | O1 worker over-broadened "maintenance-only" to product fixes with regression tests | accept (verified diffs myself: OSC-8 markdown fixes with tests; advisor terminal-failure retry behavior change) | moved to 20.085 (2 markdown) and 20.084 (advisor); 021 counts amended 507+171 → 510+168; hash-set re-verified 678/678 |
| 2 | High — Worktree Verification establishes no concrete gap in 6 sampled cards | workers followed the repo's legacy template style (probe vs current-tree contract) but did not run semantic parity probes | partial accept — legacy template (e.g. 10.104) uses the same style, so this is a real but pre-existing weakness; fix the 6 sampled cards with a reproducible semantic probe each | probe subsection added to 10.108, 10.112, 10.116, 20.083, 20.105, 20.124 (sol worker, bounded packet) |
| 3 | High — 10.116 A bucket includes welcome.ts commit | worker missed the AGENTS.md protected-visual rule | accept | A-slice annotation: `87ac45be54` welcome.ts portion excluded from bucket A (rejected for autonomous import, needs explicit user instruction); 007/009 updated |
| 4 | High — 20.083 A bucket too broad | worker grouped isolated fixes with config/product decisions | accept | A-slice = shell/fs/tool-safety correctness only; `PI_CONFIG_FILES`, GitHub file reads, tool-inventory, provider/session policy → C; 007/009 updated |
| 5 | High — 20.124 A bucket includes account/tier semantics | worker grouped wire integrity with auth/catalog policy | accept | A-slice = wire/stream integrity only; authenticated discovery + Z.AI quota/tier (`443398a9d`) → C; 007/009 updated |
| 6 | Medium — 20.105 noisy assignment (`48d0c4040`) | worker bucketed a generic post-merge typecheck repair into provider policy | accept (verified: type repair, no product behavior) | moved from 20.105 anchors to 022 no-card; counts amended 422+117 → 421+118; hash-set re-verified 539/539 |

Cross-blocker conflicts: none. Blocker 1 and 6 both touch coverage sets — reconciled by re-running the independent hash-set verification after all moves (B1 678/678, B2 539/539, uncovered=0, extraneous=0).

Re-verification: same reviewer (Noether) per DISPATCH-ACTOR-01, after probe subsections land.
