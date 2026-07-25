# 260711 chase card cycle — card split plan (P artifact)

> Goalplan: `.codexclaw/goalplans/produce-the-2026-07-11-chase-catch-up-card-set-f/`
> Session: `cli` · Phase: P · Date: 2026-07-11
> Ranges: GJC `b3b5b8a9..4a80bac9` (`upstream/dev`, v0.9.1→v0.9.6, 68 non-merge) · OMP `f25ab54c5..7aa1d581c` (`origin/main`, v16.3.12→v16.4.2, 140 non-merge)
> Audit 2026-07-11: sol reviewer `VERDICT: GO-WITH-FIXES (blockers=3)` — all three folded below (unallocated OMP commits assigned, counts corrected, `9342de55` moved 10.084→10.086).

## Loop-spec

- **Archetype**: spec-satisfaction (verifier defines done; no metric search).
- **Trigger**: chase clones fetched 2026-07-11; both axes behind their last carded HEADs.
- **Goal**: 11 new chase cards (10.082-10.086, 20.045-20.050) at existing-card quality + MOC rows + Reviewed-through pin advance.
- **Non-goals**: no `packages/` implementation, no `_fin` moves, no clone mutation, no commits.
- **Verifier**: C-phase hash existence loop (`git cat-file -e`), header/convention grep sweep, MOC row grep.
- **Stop condition**: all 5 goalplan criteria met, or terminal outcome (BLOCKED/NEEDS_HUMAN).
- **Memory artifact**: this doc + goalplan ledger + the cards themselves.
- **Terminal outcomes**: DONE expected; NEEDS_HUMAN if MOC policy contradiction; BLOCKED on clone corruption.
- **Escalation**: 3 failed repair rounds on the same card → replan at P with a changed split.
- **HOTL bounds**: tools = local git/rg/fs + spawn_agent (model pinned `gpt-5.6-sol` per user); write scope = `struct_har/chase/` new cards + MOC/README/002 + `.codexclaw/` + this devlog unit; budget = single session, subagents ≤ 5 concurrent; wall-clock ≈ this turn.

## Card split — GJC (lane G1, absorb; naming per 008 gjc→jwc)

All cards: `> Reviewed source: GJC b3b5b8a9..4a80bac9 (upstream/dev, v0.9.1→v0.9.6) vs JWC worktree 0e8d9f4+dirty`.

| card | slug | theme | allocated commits |
|---|---|---|---|
| 10.082 | `gjc_chase_irc_visualization_kitty_sidebar` | persistent IRC messages, opt-in sidebar, kitty images, expiry/clock integrity, IRC CI | `bd970e00 15357ade f0d8a07d baaef0ca 407b2103 d3c0fb6b 881dbeb6 8d58256b d9f4caae` |
| 10.083 | `gjc_chase_gpt56_tier_models_catalog_embed` | GPT-5.6 Sol/Terra/Luna tier family, context-window normalization, models.json file-type embed (v0.9.3 startup crash), selector effort persistence, Antigravity Gemini selector hide | `a6038ece 11f6a956 2482a16d 3f602807 425df5f5 7ca27503 94050b47 6b970c61 291cb403 11c2d21e fb6604df` |
| 10.084 | `gjc_chase_session_resume_startup_ts7_acp_rpc` | resumed-session confirm/continue, cache-miss cost summary, startup update contract, handlebars static bundle, TS7 stable migration, URL resolver ownership, perf/size reduction, ACP compaction metadata + permission mode, RPC session event listener, release/CI stabilization | `57da96e4 4a80bac9 94fa0fc5 64e97001 5dc197f8 c935d009 2a0aec78 a2e93fe7 8509220b c7d2ec87 64bc71ce bfcdcd49 142bb88c 2ecde380 42713363 b7157cd6 f2fc61e0` |
| 10.085 | `gjc_chase_provider_stream_oauth_integrity` | Anthropic OAuth strict-tool-use ban, tool-call name/arg preservation (stream + start-block), Bedrock credential chain, orphaned image placeholder fail-closed, concrete login hint | `8456f7a6 798308e1 4dec9523 0c8a9539 6a96d6f0 1312b799` |
| 10.086 | `gjc_chase_tui_tmux_telegram_operator_ux` | esc-local ask input, pasted image paths, markdown html comments, macOS IME re-anchor, status-line token % + overflow, credential pinning, Telegram topic rename retry/reap/user renames, tmux title tracking + exit diagnosis, MCP registration disclosure, JS-eval ToolError output, wording/build-label fixes | `da9c2154 c679181c e2190550 0694bcc4 8b8dd7db e0aaeeb7 7549d94e 48889577 38d0b2d6 4af98126 768c02ca a9dc22bf c06d4ad2 9342de55 066b5c94 9f2adf2a` |

Batch-note (may repeat theme-card hashes; fold into the owning card without a dedicated anchor row when trivial): version bumps `9cc4846f 6f200790 a716f9ca 16d274e9 cfc175f1`, CI-only `185334a8 0179813d 4290a94a 70041e0d`, test-contract syncs `11c2d21e 142bb88c 6b970c61`.

## Card split — OMP (lane G2, reference-only; no 1:1 port)

All cards: `> Reviewed source: OMP f25ab54c5..7aa1d581c (origin/main, v16.3.12→v16.4.2) vs JWC worktree 0e8d9f4+dirty`.

| card | slug | theme | allocated commits |
|---|---|---|---|
| 20.045 | `omp_chase_model_catalog_gpt56_grok_effort` | GPT-5.6 integration + logical model resolution, Grok 4.5, tier classification/routing, max-effort tier, standardized effort config, role-agent effort inheritance, catalog image-input inference, xai catalog scoping | `9d5207ea3 faa70100e 46b8ee737 66cd994cb d9854ade7 d435385ab 520f6f9bc 3a9bcc9ed 6e209d3ec 1a72f5693 619519343 68bc6ba60 0e74c85c0 e82592889 cde5d7580` |
| 20.046 | `omp_chase_codex_broker_blocks_responses_lite` | codex broker block guards (initial/fresh/exhausted/recheck/persist), responses-lite enablement + all_turns reasoning context, remote compaction, version headers/turn versioning, codex metadata, fork prompt-cache affinity + scoped-model fork cache, grok prompt-cache affinity, codex version pin, streamed-thinking preservation on empty done summary, incremental append-only reasoning summaries | `04214a8c8 d8745b62b 4911ce02e 0ffc43bfc 5b0d670d6 c143185c0 6d7341b13 29deeef87 c30bdc54c 060179729 1624d48dd 2dafa7ac7 cf2d4c00b b2b1708d8 7fa2c3f42 325375f80 fde4a19c6 396e91e10 d0a4bc477` |
| 20.047 | `omp_chase_xai_oauth_replay_reasoning` | xAI OAuth paste fallback → code login → device flow, RPC OAuth completion, SuperGrok credit-exhaustion rotation, responses replay shape adaptation + catalog compat, default reasoning behavior + summary suppression | `9c9ccb35a 9923bb3a6 60704b40c 5df96e6c2 b9e560d80 d8d33d4e8 f4e9b81ce 3af6088ca 9b4dcaa11 0e3e5ab72` |
| 20.048 | `omp_chase_agent_yield_abort_ask_timeout` | terminal-yield-before-abort, wake-loop stop, budget-bound incremental yields, yield commit validation, external abort boundaries, ask-tool timeout arm/defer/reset/multi-question defaults, stream idle watchdog deferral, anthropic keepalive bounding, extension sendUserMessage steer queueing | `9af5a28c6 0f3cf73a8 92307e11d 2bf8f43b6 1bb97efec 4f689c0b1 17c7c6d0f bc9f4c4be fcf389ae7 095353ed4 facfb3c35 4f4f852ad 9002f4ff0 7f7710492 c8196b656 e42916667` |
| 20.049 | `omp_chase_oauth_refresh_serialization_mcp` | fenced/leased/serialized OAuth refresh writes, login-success vs model-refresh decoupling, built-in discovery OAuth refresh, dynamic client registration scopes, late MCP discovery reconcile, macOS stdio server attachment, tools-filter MCP preservation, MCP profile auth binding tests | `b60dc669e cb3285313 cf021ad39 497d385ce 898643f9a bce6aa89a 390a4ae92 bf6480647 0d606f2f3 3e9057622` |
| 20.050 | `omp_chase_tui_grid_render_tools_natives_config` | grid-based math render engine, destructive-paint flicker + stale cells, partial-result repaint, first-escape cancel, transcript auto-sealing + row emission, DEC 2048 resize, terminal appearance replay, slash/selector edge fixes, ranged-grep budgets/selectors, native bash bridge backpressure + timeout crash contract, CF_DIB clipboard decode + PowerShell fallback, yaml config discovery/clone/preseed + profile keybindings, autocomplete provider API, go.work LSP, mnemopi recall ids, snapcompact collapsed frames, AWS compaction retry, cached-token usage preservation, task orchestration centralization, advisor/testing system-prompt updates, bigint serialization, legacy stats cost, Novita provider, scout rename, same-realm guards | `7cbe9fc0a 6db9ab606 0dbb59a14 cde9ee750 894cf489f 4a20b51ca 2aee4bd3f e07909fda 80b186cd8 58336f588 ba91877b6 7c560c715 029720298 81a774983 f9b425f4b 2553495d0 5d1e25f83 4f8c34174 606c51a7b cab5c4b62 314b9a7c9 668741b40 9ce8b69b3 48877de08 c94487056 993b21204 ca68daa81 f21d2385e cdecf65f8 8495931e0 f9ead2ac4 1b490044f 531880c62 7df2ac297 a45ecd559 f79098b9b 68c3c7ea9 6dbbfbe1e 71c9cc032 70754dfa0 e8add6101 60c9ad625 e2e5d8835` |

Batch-note (may repeat theme-card hashes; fold into the owning card without a dedicated anchor row when trivial): version bumps `fd2d4616a 395e4a5fc a0f7266fb e8d0a93db 5ddb0719a dd67447a0`, deps `d048298a3`, changelog/style-only `a99f46e94 eae4580a3 5809c1a63 72d4e0362 4ff9dfc12 f27596d28 b04cb7059 efc90d26b bd216f439 e22ee0b66 2d2a10ab9 3c325cdb6 68c3c7ea9`, ci-only `e8fd93d23 2b46d6711 10846c255`, vouched-user `ff1fe5ffd`, ditto `219e12b95`, test syncs `558e0bd08 6813fa128 92307e11d 0dbb59a14 cab5c4b62 4f8c34174 3e9057622 68bc6ba60 7aa1d581c`.

## Worker assignment (B phase, all `gpt-5.6-sol`, fork_context=true)

| worker | write scope (disjoint) |
|---|---|
| W1 | `struct_har/chase/10.082_*.md`, `10.083_*.md` |
| W2 | `struct_har/chase/10.084_*.md`, `10.085_*.md`, `10.086_*.md` |
| W3 | `struct_har/chase/20.045_*.md`, `20.046_*.md`, `20.047_*.md` |
| W4 | `struct_har/chase/20.048_*.md`, `20.049_*.md`, `20.050_*.md` |

Main session owns: MOC rows (10_/20_), README pin table, 002_gap_inventory (only if new gap class), C-phase verification, D close.

## Accept criteria (mirror of goalplan c1-c5)

1. 11 card files exist with `NN.NNN_` names.
2. Convention headers present (MOC link, lane, ⬜, Reviewed source).
3. Every cited hash exists in its clone (`git cat-file -e` loop exits 0).
4. MOC rows + Reviewed-through pins advanced (GJC `4a80bac9` v0.9.6 / OMP `7aa1d581c` v16.4.2).
5. A-phase sol reviewer verdict PASS or GO-WITH-FIXES recorded before B.
