# 041 — wp3 cycle 2 A-stage synthesis

Auditor: Wegener (019f9a1b-58a2-7e72-94af-3ba8b4dc9b9d), verdict **GO-WITH-FIXES (blockers=6)**.
Main judgment: **near-pass → A>B** — all 6 folded into 040 amendments, no open residuals.

| # | severity | disposition |
|---|---|---|
| 1 write-set overlap | High | folded — descope removes the settings-schema collision (only T1 keeps it); CHANGELOG reserved to main integration; packets re-verified disjoint |
| 2 markdown default | High | folded — `read.renderMarkdown` default false, local-only tagging, internal-URL rendering preserved; 4 pinned test cases |
| 3 approval redesign | Critical | folded — `6d7457663`+`09d02c641` descoped to residual; needs C4 security design unit (AgentSession permission bridge first) |
| 4 memory lifecycle redesign | High | folded — `5a1f227a6` descoped to residual; needs JWC-native lifecycle design unit (stop/dispose contract absent) |
| 5 activation scenarios | Medium | folded — DAP: exported transport helper + nonexistent path + short timeout; settings: save-spy + debounce control |
| 6 mupdf gate | High | folded — A3 = full binary build + isolated no-node_modules PDF smoke + size/startup record |

Scope effect: cycle 2 implements 15 of 37 commits (was 20); 2 slices (5 commits) become tracked residuals pending design units.
