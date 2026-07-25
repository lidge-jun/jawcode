# Chase OMP v16.2.9 pull — Phase 1: author reference-only gap cards (DOC-ONLY)

> Goal `f47e0507-b13`. Hint: "omp도 하라고".
> OMP chase-DOC authoring phase mirroring the GJC v0.7.8 cycle (260701_chase_gjc_v078_pull),
> but on the OMP axis where cards are **reference-only (1:1 port ❌)**.

## Part 1 — Easy explanation

The repo tracks "chase cards" for two upstreams: GJC (`10.*`, fork-parity) and OMP
(`20.*`, design-reference). The OMP clone was last reviewed at v16.2.5; it has since
advanced 175 commits to v16.2.9. This phase fetches that update, groups the 175
commits into themed **reference** cards, writes them into `struct_har/chase/`, and
updates the OMP MOC + cycle log + follow-index. No application code is touched, and
OMP behavior is recorded as design input only — never a 1:1 port.

## Part 2 — Source facts (verified)

- OMP clone `devlog/_omp_chase/oh-my-pi`: `fetch origin` done. `origin/main` = `b6c9747d4` (v16.2.9).
- Previous reviewed head: `ca9f2847e` (v16.2.5), resolves (`cat-file -e` ok).
- New delta: `git -C devlog/_omp_chase/oh-my-pi rev-list --count ca9f2847e..origin/main` = **175 commits**.
- Commit count: 175 total = **137 non-merge + 38 merge** (`rev-list --count --merges` = 38).
- Non-merge type histogram: 79 fix, 23 feat, 12 style, 10 chore, 8 test, 2 refactor, 1 perf, 1 revert, 1 keep (= 137).
- Accounting split: **105 card-bound** (79 fix + 23 feat + 2 refactor + 1 perf) + **70 no-card** (38 merge + 12 style + 10 chore + 8 test + 1 revert + 1 keep) = 175.
- Version bumps in range: 16.2.6 `0ba736f5b`, 16.2.7 `38250ce88`, 16.2.8 `5bc68f57c`, 16.2.9 `b6c9747d4` (all no-card).
- Existing OMP cards run 20.001..20.022. Next free number = **20.023**.
- OMP MOC "Reviewed through" (struct_har/chase/20_omp_chase_MOC.md:27) currently
  `ca9f2847e ... v16.2.5`; must advance to `b6c9747d4 v16.2.9`.
- OMP cards carry `reference-only` marker (not GJC's `P?`); see 20.022 header as the template.

## Part 3 — Commit → card clustering (175 commits, 8 themed reference cards)

| card | slug | theme | representative SHAs |
|---|---|---|---|
| 20.023 | ai_providers_catalog_service_tier | AI providers/catalog/service-tier/transport | `f1063cdfb`(Sonnet5 caps), `43ad3cd91`(catalog providers), `d20e6c082`(per-family service tier), `d01bf079e`(google interactions api), `6b64ed0ff`(vertex regional fallback), `a2f8b3915`/`00a41749e`/`bc7e5b31a`/`dca8a7afb`(llama.cpp), `cd6ba0214`/`83f901d05`(ollama), `4e747af42`/`6fb9bbfc1`(antigravity), `2ee9fd4a1`(glm watchdog), `093660f8b`(reasoning all_turns), `bebdd22e6`(reasoning fence heal) |
| 20.024 | mcp_oauth_reauth_flow | MCP oauth/reauth login + cmd-shim launch | `3106a15f7`, `6f6577209`, `a6b2bac88`, `d2c767507`, `4ce9d659c`, `a49c7027b`, `e29792afe`, `45df90bda`, `6e166274c` |
| 20.025 | compaction_snapcompact_session_scope | compaction/snapcompact caps + session-branch scoping | `5b026d304`(shake elision), `39688620f`/`156dfd846`/`88308f105`(snapcompact frames), `c21cb6325`/`398796949`/`3ced3a923`/`9e4e0f669`(snapshot caps), `cc2cf5c7d`/`e8b2c5d05`(branch-scoped compaction), `3aa47d2ab`(mid-run compaction key identity) |
| 20.026 | tui_input_loader_mcp_enable | TUI loader re-arm + double-Esc + MCP enable sources | `c2d6c8cf1`/`64734021a`(double-Esc), `7871591b4`(loader after subagent), `e34f2a81e`/`16ef3c54f`/`812b246e7`/`6256f97ea`(MCP enable/status), `68285aa9d`(tui arg throttle), `5cc84db4c`(programmatic editor submit) |
| 20.027 | prompts_subagent_discovery_rules | system prompt + tester/sonic subagent + discovery rules | `213fdca79`/`51ce5a87f`/`63ff563ec`(prompt/bash constraints), `720fb3f12`(tester subagent), `6b7d7e6e7`(loop-guard), `6c1152647`(refactor: sonic rename quick_task), `dcc7a1ce2`(Go discovery rules), `9ccd83a13`(optional agent param) |
| 20.028 | web_search_provider_settings | web-search duckduckgo scrape + provider override settings | `755a61de0`(DDG HTML scrape), `09061ed80`(DDG native align), `ba6b64bf8`(--provider auto), `3560d108d`(search provider settings), `530113eb7`(gemini api key search), `6e166274c`(gemini oauth helper) |
| 20.029 | stats_sync_worker_perf | stats sync worker hardening + perf index | `234c1919f`/`efb96b123`/`b48d488f2`/`7d5544493`(stats worker), `467f46b19`(perf composite index) |
| 20.030 | misc_dictation_binary_font_yield_irc_win | dictation submit, binary detect, CJK font, yield validation, irc asides, windows paths | `168bdae5d`(dictation), `e8090bb48`(binary detect), `242705c06`(CJK font), `4810f47db`(yield per-label), `66eba507f`/`3104d232a`(irc asides), `b4f75abb3`/`777b609e6`(windows paths), `0ef430a39`(bun cpu profiler), `2c8b72308`(stream timeout) |

> No-card bucket (70): 38 merge commits, 10 chore (incl. 4 version bumps `0ba736f5b` 16.2.6 / `38250ce88` 16.2.7 / `5bc68f57c` 16.2.8 / `b6c9747d4` 16.2.9), 12 style, 8 test-only, 1 revert (`d1e412eef`), 1 keep (`6f8f76be4` DuckDuckGo cap unchanged). Recorded in the cycle changelog as "no JWC card (merge/chore/style/test/version/keep)".

Each card is **reference-only**: OMP behavior is design input, translated through JWC
naming (`pi-shell`→`jwc-shell`, `.omp`→`.jwc`, `omp`/`pi` → `jwc`). Decision A
defaults to track/evaluate, never automatic import.

## Part 4 — File change map

NEW (struct_har/chase/):
- `20.023_omp_chase_ai_providers_catalog_service_tier.md`
- `20.024_omp_chase_mcp_oauth_reauth_flow.md`
- `20.025_omp_chase_compaction_snapcompact_session_scope.md`
- `20.026_omp_chase_tui_input_loader_mcp_enable.md`
- `20.027_omp_chase_prompts_subagent_discovery_rules.md`
- `20.028_omp_chase_web_search_provider_settings.md`
- `20.029_omp_chase_stats_sync_worker_perf.md`
- `20.030_omp_chase_misc_dictation_binary_font_yield_irc_win.md`

MODIFY:
- `struct_har/chase/20_omp_chase_MOC.md` — Reviewed-through `ca9f2847e v16.2.5`
  → `b6c9747d4 v16.2.9`; add a v16.2.9 "Recent reference-only deltas" summary row;
  add 8 active rows (023-030, status ⬜, reference).
- `struct_har/chase/20.001_omp_chase_cycle.md` — append a v16.2.9 changelog block
  (175-commit delta → card mapping + no-card bucket summary).
- `struct_har/chase/007_follow_index.md` — add a v16.2.9 OMP section with 8 ⬜ rows.

Each new card follows the existing OMP card format (header with `reference-only`
marker + reviewed source range, Source Facts table with OMP anchors, JWC Reconcile
Notes, Done Gate, Decision Slots A-H), JWC naming per 008.

## Scope boundary

IN:
- Fetch OMP clone (done).
- Write 8 new OMP reference gap cards for the v16.2.9 delta.
- Update OMP MOC reviewed-through + rows, cycle changelog, 007 index.

OUT:
- No JWC application/source/test code changes (doc-only phase).
- No 1:1 port / cherry-pick of OMP code (reference cards only).
- No card closure / _fin moves (these are NEW open cards).
- No GJC-axis changes (10.* untouched this cycle).
- No push unless user asks.

## Testable accept criteria

1. `git -C devlog/_omp_chase/oh-my-pi rev-parse origin/main` = `b6c9747d4...`
   and OMP MOC reviewed-through cites `b6c9747d4` / v16.2.9.
2. 8 files `struct_har/chase/20.023..20.030_*.md` exist, each with the OMP card
   header (`# 20.0NN —`, `> MOC:` line with `reference-only`, reviewed source range)
   and a Source Facts table citing at least one real OMP commit SHA from the delta.
3. All 175 delta commits are accounted: each card-bound commit (105) appears in a
   card's Source Facts cluster (representative set) OR the cycle changelog records the
   no-card bucket (70 merge/chore/style/test/revert/keep) with the 4 version-bump SHAs.
4. OMP MOC has 8 new rows (023-030); 007_follow_index has 8 new rows.
5. `git diff --check` clean; no JWC source files (`packages/**/src`, tests)
   modified — `git status --short` shows only struct_har/chase + devlog/_plan.
6. Every upstream SHA cited resolves: `git -C devlog/_omp_chase/oh-my-pi
   cat-file -e <sha>` for each cited commit.
7. Every card carries the `reference-only` / `1:1 port ❌` marker (no import language).

## Verification gates
- Doc-only: `git diff --check`; confirm no code-file paths in the changed set.
- SHA resolve check for all cited commits.
- Reviewer (Docs): confirm 175-commit accounting (113 card-bound + 62 no-card) +
  naming-contract adherence + reference-only framing.

## Non-goals
- Not deciding adopt vs reject for each gap (each card's future PABCD).
- Not advancing GJC axis.
- Not exhaustively listing all 113 card-bound SHAs in cards (representative anchors
  per theme suffice for a reference card; full enumeration lives in the git log).
