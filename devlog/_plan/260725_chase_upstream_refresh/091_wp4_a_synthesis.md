# 091 — wp4 A-stage synthesis

Auditor: Halley (019f9d42-9b06-7923-ba7d-699697f34cdf), verdict **GO-WITH-FIXES (blockers=5)**.
Main judgment: **near-pass → A>B** — all folded into 090; no open residuals.

| # | severity | disposition |
|---|---|---|
| 1 markerless arithmetic wrong ("keep 9", list had 10) | blocker | folded — 10 keep + 5 remap + 1 active = 16, asserted in the doc and in D2/D9 |
| 2 blanket ACTIVE return over-corrected | blocker | folded — the auditor produced implementation evidence for `10.083`, `10.089`, `10.092`, `10.097`, `10.106` (`fa66b165`, `bc1e8c3`, `925a3f5`, `8a2c79b`), so they become ADAPT-partial with exact residuals; only `10.090` returns to active |
| 3 kept-closed cards lacked clean-vs-partial disposition | blocker | folded — each of the 10 must state clean or ADAPT-partial; `20.053`, `20.067`, `20.079` may close only as partial (their bodies still say TBD / parity unproven) |
| 4 D4 not executable | blocker | folded — `struct_har/_scripts/chase-lifecycle-check.ts` specified: location-vs-status, duplicate ids, broken MOC links, missing MOC rows, README/INDEX excluded, exit 1 on any violation |
| 5 no closure-claim integrity gate | blocker | folded — `struct_har/_scripts/chase-closure-integrity.ts` specified: `git cat-file -e` per cited hash, `git diff-tree` intersection with the card's declared owner paths, and clean-vs-partial marking consistency |

Also adopted: the auditor confirmed the 23-count arithmetic reproduces (16 from `1614a41` + 7 legacy), with the README-exclusion rule now written into the script spec; and D6 was demoted to baseline health since the repo-standard gates do not actually verify a docs-only diff — the real evidence is D4/D7/D8/D9.

Auditor also confirmed all 8 cycle cards genuinely have implementation and that ADAPT-partial (never clean close) is the honest disposition for every one of them.
