# 260629 — chase replay/encrypted hardening (10.055 + 10.058)

> Goal `65f1dc1a-373`: close GJC import-candidate chase cards via autonomous PABCD, card-by-card.
> Source evidence only: `devlog/_gjc_chase/gajae-code` @ `fa995807`. No 1:1 copy. JWC naming/identity preserved.
> No public publish / no push.

## Phase 0 finding — what JWC already has vs the real gap

Investigated the 10.055 cluster against the live JWC tree (`ef28a98`+):

| sub-feature | GJC source | JWC current state | action |
|---|---|---|---|
| GPT-5.5 context cap clamp | `89035bce` (#1231) | already present — `model-thinking.ts:444 applyGpt55ContextWindow` pins 272K for `openai-codex-responses` base 5.5 | confirm-only |
| harmony/invoke envelope leak | `b37acf3d` (#1219), `83c59f78` | already present — `packages/agent/src/harmony-leak.ts` + `agent-loop.ts`; richer than upstream (errata 3) | confirm-only |
| replay image_url sanitization | `a8904baa` (#1214) | JWC replay path differs: `utils.ts sanitizeOpenAIResponsesHistoryItemsForReplay` strips ids/normalizes call_id; no per-part image_url/detail well-form guard | adapt if matching path exists |
| drop invalid Codex encrypted_content | `4e0c22db` (#1208) | GAP — `openai-codex/request-transformer.ts` has no encrypted_content well-form/drop guard | import (adapt) — primary slice |
| preserve Codex encrypted replay strings | `1214f606` (#1218) | depends on JWC replay representation | evaluate in slice |
| materialize resident compaction replay blobs | `c855f923` (#1213) | session-layer; JWC compaction differs | evaluate / likely defer |
| vision role removal + direct image embed | `5674460f` (#1228) | JWC already embeds images directly (openai-responses-shared.ts partitionVisionContent) | confirm-only / defer |

Net: the highest-value, clearly-missing JWC guard is codex `encrypted_content` invalid-drop/well-form (data-integrity, transport-safety). Several other sub-features are already shipped in JWC or live in a diverged code path requiring adapt-not-copy.

## Work-phase slice map (each = one FULL PABCD cycle)

- Phase 1 (10): codex encrypted_content invalid-drop/well-form guard in openai-codex/request-transformer.ts + focused test. [P1, THOROUGH — transport/data-integrity]
- Phase 2 (20): replay image_url/detail well-form guard adapted to JWC utils.ts replay path (only if a real JWC code path carries replayed image parts; else evidence-based deferral). [P2, STANDARD]
- Phase 3 (30): confirm-and-document already-shipped sub-features (GPT-5.5 cap, harmony-leak, direct image embed) as evidence-backed already-covered; close 10.055 to _fin with per-sub-feature decision table; update MOC + 007_follow_index. [docs, STANDARD]
- Phase 4 (40): 10.058 misc stability import candidates — memory GC bounds + web-search hard timeout — evaluate JWC surfaces; adapt or evidence-defer; close/triage card. [P3, STANDARD]

## Verification gates (per phase)

- bunx tsc / bun run check:ts on touched packages.
- focused bun test for the touched file.
- git diff --check.
- THOROUGH (Phase 1): independent reviewer dispatch challenging the closure (security/transport).
- atomic commit per slice; card status/MOC updated only with evidence.

## Phase stubs

- 10_phase1_codex_encrypted_content_guard.md
- 20_phase2_replay_image_url_guard.md
- 30_phase3_close_10_055.md
- 40_phase4_10_058_misc_stability.md
