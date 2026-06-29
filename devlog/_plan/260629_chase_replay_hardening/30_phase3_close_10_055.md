# Phase 3 — Close 10.055 (Codex/AI replay stability + sanitization)

> Goal `65f1dc1a-373`. Work-phase = one FULL PABCD cycle (P→A→B→C→D).
> Docs-only phase: confirm already-shipped sub-features with live-code evidence,
> record per-sub-feature import/defer/confirm decisions, retire card to `_fin`,
> update MOC + 007_follow_index. No source changes. No push.

## Part 1 — Easy explanation

The 10.055 card bundled 7 replay/data-integrity protections that GJC shipped
upstream. Two earlier PABCD cycles already handled the only real code gaps
(Phase 1: codex `encrypted_content` invalid-drop guard, committed `29f4621`;
Phase 2: replay `image_url` guard, evidence-based DEFER `16d4e2b`). The
remaining 3 surfaces turned out to be **already present in JWC** — sometimes
richer than upstream. This phase does no new code: it verifies those 3 in the
live tree, writes the per-sub-feature decision table into the card, and retires
10.055 to `_fin` with MOC + 007 updated. Nothing here touches files another
agent is editing.

## Part 2 — Per-sub-feature decision table (live-code evidence)

| # | sub-feature | GJC src | JWC decision | evidence (file:line) |
|---|---|---|---|---|
| 1 | drop invalid Codex encrypted_content | `4e0c22db` #1208 | IMPORT (adapt) — done Phase 1 | commit `29f4621`; `packages/ai/src/providers/openai-codex/request-transformer.ts` + focused test |
| 2 | preserve Codex encrypted replay strings | `1214f606` #1218 | covered by Phase 1 guard (well-form preserves valid strings, drops only malformed) | `29f4621` transformer guard |
| 3 | replay image_url/detail sanitization | `a8904baa` #1214 | DEFER (evidence-based) — no matching JWC replay image-part path | Phase 2 doc `20_phase2_replay_image_url_guard.md`; commit `16d4e2b` |
| 4 | GPT-5.5 context cap clamp | `89035bce` #1231 | CONFIRM — already present | `packages/ai/src/model-thinking.ts:444 applyGpt55ContextWindow` (hard 272K) |
| 5 | harmony/invoke envelope leak guard | `b37acf3d` #1219, `83c59f78` | CONFIRM — already present, richer than upstream | `packages/agent/src/harmony-leak.ts` |
| 6 | materialize resident compaction replay blobs | `c855f923` #1213 | DEFER — JWC compaction path diverges; no data-loss evidence in JWC | overview Phase 0 finding; session-layer differs |
| 7 | vision role removal + direct image embed | `5674460f` #1228 | CONFIRM — JWC already embeds directly | `packages/ai/src/providers/openai-responses-shared.ts` (partitionVisionContent) + `vision-guard.ts` |

Net: 1 imported (Phase 1, covers #1+#2), 1 deferred with evidence (Phase 2, #3),
3 confirmed already-shipped (#4,#5,#7), 1 deferred (#6). All 7 surfaces have a
recorded decision → card is closeable.

## Part 3 — Doc edits (NEW/MODIFY)

### MODIFY `struct_har/chase/10.055_gjc_chase_codex_replay_stability.md`
- Header status `⬜` → `✅` (retired); add closure note with the decision table
  above and commit anchors (`29f4621`, `16d4e2b`).
- Tick Done-Gate boxes with evidence (source facts checked, owner files listed,
  per-fix decision recorded, focused test/manual evidence, security reviewer
  sign-off from Phase 1 THOROUGH dispatch, `git diff --check`).

### MODIFY `struct_har/chase/10_gjc_chase_MOC.md`
- Line 94: status `⬜` → `✅ **_fin** [10.055](./_fin/10/10.055_gjc_chase_codex_replay_stability.md) 260629` for row 055.

### MODIFY `struct_har/chase/007_follow_index.md`
- Add a 10.055 closure row (date, decision summary, commit anchors).

### MOVE card to `_fin/10/`
- Convention confirmed against existing closed cards (e.g. `_fin/10/10.004`,
  `_fin/10/10.022`): `git mv struct_har/chase/10.055_*.md struct_har/chase/_fin/10/`.
- MOC row 94 becomes `✅ **_fin** [10.055](./_fin/10/10.055_gjc_chase_codex_replay_stability.md) 260629`
  (matching the `✅ **_fin** [...]` format used on rows 40-46).

## Verification gates
- `git diff --check` (docs-only, no whitespace errors).
- No source/test changes in this phase (implementation evidence = prior commits
  `29f4621` + `16d4e2b`; this phase's evidence = the decision table + live-code
  anchors above).
- Independent read-only reviewer confirms each "CONFIRM" anchor resolves and the
  closure is evidence-backed (THOROUGH — security surface).

## Non-goals
- No new guards. Deferred items (#3 image_url, #6 compaction blobs) stay deferred
  with their recorded rationale; reopen only if a concrete JWC data-loss path is
  found.
