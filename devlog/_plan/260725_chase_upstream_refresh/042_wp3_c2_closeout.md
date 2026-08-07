# 042 — wp3 cycle 2 closeout: card 20.109 tool/platform runtime hardening

Outcome: **DONE (partial with tracked residual)** — 15 of 37 anchors implemented, 4 no-op (already-fixed/test-only), 13 no-surface, 5 residual.

## Phase records

| phase | evidence |
|---|---|
| P | `040_wp3_c2_runtime_hardening.md` — Laplace 37-anchor survey (20 import / 3 already-fixed / 13 no-surface / 1 na-test) with path:line evidence per anchor |
| A | Wegener GO-WITH-FIXES (6 blockers) → `041_wp3_c2_a_synthesis.md` (7127538): approval slice + memory lifecycle descoped to design units, markdown default corrected to upstream contract, write-set deconflicted, mupdf gate upgraded |
| B | 3 sol workers — T1 Popper 4/5 slices, T2 Volta 5/5, T3 Epicurus 2/3 (ea0f834); integration 8a2c79b; mupdf RESIDUAL with build evidence (mupdf top-level await vs Bun 1.3.14 bundling; reverted cleanly), PDF image cache RESIDUAL (no JWC extraction path) |
| C | Averroes FAIL (2 High) → main fixes: LSP stale-exit identity guard (56e3e04), bounded python replacement + full-startup envelope (56e3e04, d623c96) → re-verify **PASS** |
| bonus | Erdos repaired all 26 pre-existing suite failures (fd7a9f0f): fakeAuth getGeneration drift, SkillTool canonical state names, lsp.enabled default, ralplan→planphase contract |

## Residual (card 20.109 Decision F)

- `6d7457663`+`09d02c641` bash approval rules: needs C4 security design unit (AgentSession permission bridge first).
- `5a1f227a6` memory backend lifecycle: needs JWC-native lifecycle design unit (no stop/dispose contract).
- `6b6e39ff6` mupdf bundling: blocked by mupdf TLA × Bun bundling conflict (build evidence: 251,795,744 bytes pre-change build ok; post-change compile fails in markit-ai extract.js require); needs dependency-level fix.
- `7877df00e` PDF image cache: JWC has no PDF image-member extraction path — needs preceding feature.
- 13 no-surface anchors: direnv, vibe, TTS, Codex Live, xdev, pi-walker — JWC feature absent.
