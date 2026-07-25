# Chase GJC v0.7.8 pull — Phase 1: author new gap cards (DOC-ONLY)

> Goal `8b23b5f2-da1`. Hint: "지금 다시 pull 하고 chase 폴더에 파일들 작성해놔".
> This is a chase-DOC authoring phase: pull upstream clones, triage the new
> delta, and WRITE new gap cards in struct_har/chase/. No JWC source code change.

## Part 1 — Easy explanation

The repo tracks "chase cards" — notes about features the upstream projects
(GJC, OMP) shipped that JWC might want to follow. The upstream GJC clone was
last reviewed at v0.7.7; it has since advanced to v0.7.8 with 21 new commits.
This phase fetches that update, groups the 21 commits into themed gap cards,
writes those cards into `struct_har/chase/`, and updates the MOC + cycle log so
a future agent can decide what to import. No application code is touched.

## Part 2 — Source facts (verified)

- GJC clone `devlog/_gjc_chase/gajae-code`: `fetch` done. Reviewed head was
  `fa995807` (v0.7.7); `upstream/dev` is now `20c299eb` (v0.7.8).
- New delta: `git -C devlog/_gjc_chase/gajae-code log fa995807..upstream/dev`
  = **21 commits** (rev-list count = 21).
- OMP clone advanced 849 commits — FAR too large for this cycle; OUT of scope.
  Recorded as a deferred note only (no OMP cards this phase).
- Existing GJC cards run 10.001..10.058 (10.058 just closed to _fin). Next free
  number = **10.059**.
- MOC "Reviewed through" line (struct_har/chase/10_gjc_chase_MOC.md:29) currently
  `fa995807 ... v0.7.7`; must advance to `20c299eb v0.7.8`.

## Part 3 — Commit → card clustering (21 commits, themed)

| card | slug | commits | theme |
|---|---|---|---|
| 10.059 | deep_interview_ask_ralplan_gate | 20c299eb, bb6f0e98, eef6ec3a, f1343220, 2bc0e2c5, 19408acc | deep-interview wording/spec, ralplan ask approval gate, ultragoal ask-guard session scope, render-middleware undefined guard |
| 10.060 | tui_render_resilience_editor_submit | eb346860, 0455d408, 0e537348, 8bf665af | per-component render isolation, Ctrl+Enter composer submit, status-line custom editor UX + usage display mode |
| 10.061 | tmux_team_windows_psmux_titles | beec1af0, 1d65050d | tmux workspace titles + Windows/psmux team spawn reliability (follow-up to #1282) |
| 10.062 | ai_provider_deepinfra_gemini_ua | 68179e2d, b200fc0e | DeepInfra provider + service-tier; Gemini CLI user-agent alignment + spoofed-version guard |
| 10.063 | natives_platform_split_packages | eb8a76f6 | split @jawcode-dev/natives into per-platform packages (darwin-arm64 etc.) |
| 10.064 | telegram_daemon_entrypoint_notify | d00cbe2c, 308d4a20 | compiled Telegram daemon entrypoint startup fix; Windows Terminal bell workaround doc + setting |
| 10.065 | prompt_self_awareness_grounding | aa7322f6 | system prompt self-awareness source grounding |

> Non-card commits: `af1e9c5d chore: bump version to 0.7.8`, `b948e377 Add
> maintainer contributing guide`, `ebacf8d0 docs: refresh Discord invite link`
> — recorded in the cycle changelog row as "no JWC card (chore/docs)".

Each card cross-checks JWC worktree for already-landed behavior (README step 5:
`001 §worktree 검증`). Where JWC already has it, the card records CONFIRM/partial;
where genuinely behind, records the gap with source anchors. This is triage
authoring, not import — Decision A (import/adapt/reject/split) left open per card.

## Part 4 — File change map

NEW (struct_har/chase/):
- `10.059_gjc_chase_deep_interview_ask_ralplan_gate.md`
- `10.060_gjc_chase_tui_render_resilience_editor_submit.md`
- `10.061_gjc_chase_tmux_team_windows_psmux_titles.md`
- `10.062_gjc_chase_ai_provider_deepinfra_gemini_ua.md`
- `10.063_gjc_chase_natives_platform_split_packages.md`
- `10.064_gjc_chase_telegram_daemon_entrypoint_notify.md`
- `10.065_gjc_chase_prompt_self_awareness_grounding.md`

MODIFY:
- `struct_har/chase/10_gjc_chase_MOC.md` — Reviewed-through `fa995807 v0.7.7`
  → `20c299eb v0.7.8`; add 7 MOC rows (059-065, status ⬜).
- `struct_har/chase/10.001_gjc_chase_cycle.md` — append a v0.7.8 changelog
  block (21-commit delta → card mapping + chore/docs no-card rows).
- `struct_har/chase/007_follow_index.md` — add 7 new ⬜ rows (execution order).

Each new card follows the existing card header/section format (목표, Source
Facts table with upstream anchors, JWC Reconcile Notes, Done Gate checklist,
Decision Slots A-H), with JWC naming per 008 (gjc→jwc translation noted where a
source path uses `gjc`/`gjc-runtime`).

## Scope boundary

IN:
- Fetch GJC + OMP clones (already done).
- Write 7 new GJC gap cards for the v0.7.8 delta.
- Update MOC reviewed-through + rows, cycle changelog, 007 index.

OUT:
- No JWC application/source/test code changes (doc-only phase).
- No card closure / _fin moves (these are NEW open cards).
- No OMP cards (849-commit backlog deferred; noted only).
- No import/cherry-pick of upstream code.
- No push unless user asks.

## Testable accept criteria

1. `git -C devlog/_gjc_chase/gajae-code rev-parse upstream/dev` = `20c299eb...`
   and MOC reviewed-through cites `20c299eb` / v0.7.8.
2. 7 files `struct_har/chase/10.059..10.065_*.md` exist, each with the standard
   card header (`# 10.0NN —`, `> MOC:`, `> 상태: ⬜`) and a Source Facts table
   citing at least one real upstream commit SHA from the delta.
3. All 21 delta commits are accounted for: each appears in exactly one card's
   Source Facts OR in the cycle changelog "no-card (chore/docs)" rows.
4. MOC has 7 new rows (059-065); 007_follow_index has 7 new rows.
5. `git diff --check` clean; no JWC source files (`packages/**/src`, tests)
   modified — `git status --short` shows only struct_har/chase + devlog/_plan.
6. Every upstream SHA cited resolves: `git -C devlog/_gjc_chase/gajae-code
   cat-file -e <sha>` for each.

## Verification gates
- Doc-only: `git diff --check`; confirm no code-file paths in the staged set.
- SHA resoldistence check for all cited commits.
- Reviewer (docs): confirm 21-commit accounting + naming-contract adherence.

## Non-goals
- Not deciding import vs reject for each gap (that is each card's future PABCD).
- Not advancing OMP axis.
