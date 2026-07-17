# 10 — GJC cluster manifest INDEX

> Range: `4a80bac9..3ddf26079` (`upstream/dev`), **302 non-merge commits**
> Last carded: 10.086 @ `4a80bac9` (v0.9.6)
> Versions crossed: v0.10.0, v0.10.1, v0.10.2, v0.11.0, v0.11.1+
> Date: 2026-07-17
> Status: **INDEX** — 세부 파일은 `010_gjc_C{NN}_*.md` 참조

## 클러스터 세부 파일

| # | file | theme | priority | model |
|---|---|---|---|---|
| C01 | [010_gjc_C01_sdk_lifecycle_ledger.md](./010_gjc_C01_sdk_lifecycle_ledger.md) | SDK lifecycle ledger hardening | P1 | ✗ |
| C02 | [010_gjc_C02_security_prompt_control_token.md](./010_gjc_C02_security_prompt_control_token.md) | security/prompt/control-token | P1 | ✓ |
| C03 | [010_gjc_C03_model_preset_fallback_selection.md](./010_gjc_C03_model_preset_fallback_selection.md) | model preset/fallback/selection | P1 | ✓ |
| C04 | [010_gjc_C04_prompt_refactor_compact_ralplan.md](./010_gjc_C04_prompt_refactor_compact_ralplan.md) | prompt refactor/compact/ralplan | P2 | ✗ |
| C05 | [010_gjc_C05_tui_command_palette.md](./010_gjc_C05_tui_command_palette.md) | TUI command palette | P2 | ✗ |
| C06 | [010_gjc_C06_tui_irc_sidebar_kitty_tmux.md](./010_gjc_C06_tui_irc_sidebar_kitty_tmux.md) | TUI IRC/sidebar/Kitty/tmux | P2 | ✗ |
| C07 | [010_gjc_C07_coordinator_mcp_session_reaper.md](./010_gjc_C07_coordinator_mcp_session_reaper.md) | coordinator MCP/session reaper | P2 | ✗ |
| C08 | [010_gjc_C08_telegram_notification_v2.md](./010_gjc_C08_telegram_notification_v2.md) | Telegram notification v2 | P2 | ✗ |
| C09 | [010_gjc_C09_deep_interview_goal_ultragoal.md](./010_gjc_C09_deep_interview_goal_ultragoal.md) | deep-interview/goal/ultragoal | P2 | ✗ |
| C10 | [010_gjc_C10_session_context_usage_ssot.md](./010_gjc_C10_session_context_usage_ssot.md) | session context-usage SSOT | P2 | ✗ |
| C11 | [010_gjc_C11_grok_codex_benchmark_presets.md](./010_gjc_C11_grok_codex_benchmark_presets.md) | Grok 4.5/Codex benchmark/presets | P1 | ✓ |
| C12 | [010_gjc_C12_codex_reasoning_thinking_sdk.md](./010_gjc_C12_codex_reasoning_thinking_sdk.md) | Codex reasoning/thinking/SDK | P1 | ✓ |
| C13 | [010_gjc_C13_rpc_durable_selection_pet.md](./010_gjc_C13_rpc_durable_selection_pet.md) | RPC durable selection/pet | P3 | ✓ partial |
| C14 | [010_gjc_C14_ci_release_stabilization.md](./010_gjc_C14_ci_release_stabilization.md) | CI/release stabilization | P3 | ✗ |
| C15 | [010_gjc_C15_browser_psmux_misc.md](./010_gjc_C15_browser_psmux_misc.md) | browser/psmux/misc | P3 | ✗ |
| C16 | [010_gjc_C16_agent_async_misc.md](./010_gjc_C16_agent_async_misc.md) | agent async/misc | P3 | ✗ |
| C17 | [010_gjc_C17_provider_safety_transport.md](./010_gjc_C17_provider_safety_transport.md) | provider safety/transport | P2 | ✓ |
| C18 | [010_gjc_C18_docs_changelog_qa.md](./010_gjc_C18_docs_changelog_qa.md) | docs/changelog/QA | P3 | ✗ |
| — | [019_gjc_batch_note.md](./019_gjc_batch_note.md) | batch-note (bumps/CI/style) | — | ✗ |

## Cluster summary

| # | slug | theme | ~commits | sol priority | model-related |
|---|---|---|---:|---|---|
| C1 | `sdk_lifecycle_ledger_hardening` | SDK lifecycle ledger crash-safety, PID reuse, receipt parsing, sibling ownership, compaction | ~25 | **P1** | ✗ |
| C2 | `security_prompt_control_token_hardening` | control-token neutralization (gpt-5.6 Request blocked), untrusted content framing, reasoning egress gating, hostile boundary fixes | ~30 | **P1** | ✓ |
| C3 | `model_preset_fallback_durable_selection` | sticky model fallback chains, durable default model selection, /model role overrides, codex preset reasoning, model cache reuse, GPT-5.6 prompt cap | ~20 | **P1** | ✓ |
| C4 | `prompt_refactor_compact_ralplan` | core prompt compaction, shared role-agent ralplan guidance, dead discovery plumbing removal, prompt fixture coverage | ~15 | **P2** | ✗ |
| C5 | `tui_command_palette_viewport` | searchable command palette, double-Esc draft clear, palette composer ownership/draft preservation, slash command dispatch | ~10 | **P2** | ✗ |
| C6 | `tui_irc_sidebar_kitty_tmux` | IRC sidebar 70:30 responsive split default-on, Kitty anchored-wrap, ghost IRC fix, Korean prose wrapping, sixel probe under tmux, graphics suppression, viewport anchors, scrollback preservation | ~25 | **P2** | ✗ |
| C7 | `coordinator_mcp_session_reaper` | owner-proof idle session reaper, stop_session, tmux ≥3.7 no-server recognition, resilient owner-server probe, bounded concurrent stdio dispatch, ACP fail-closed session deletion | ~12 | **P2** | ✗ |
| C8 | `telegram_notification_v2` | /verbose /lean tool-activity + reasoning-summary contract, directed replay provenance hardening, Telegram ask controls per-client capability, configurable topic name template, shared notification service, child notification suppression, poll-health/malformed-update safety | ~18 | **P2** | ✗ |
| C9 | `deep_interview_goal_ultragoal` | deep-interview continuation fencing/race fix, goal reminder suppression, hold repeated timeout continuations, ultragoal receipt re-mint deadlock fix | ~8 | **P2** | ✗ |
| C10 | `session_context_usage_ssot` | provider-reported usage SSOT, context-usage snapshot cache, status-line heuristic retirement, anchor pre-prompt context estimates, cache miss attribution by evidence | ~8 | **P2** | ✗ |
| C11 | `grok_45_codex_benchmark_presets` | Grok 4.5 documented support, GPT-5.6 Codex benchmark presets, mpreset authoritative model profile selection | ~5 | **P1** | ✓ |
| C12 | `codex_reasoning_thinking_sdk` | expose model thinking capabilities, durable thinking in model selection, invalid_prompt classification + circuit breaker, Responses reasoning fail-closed | ~10 | **P1** | ✓ |
| C13 | `rpc_durable_selection_pet` | durable default model selection via RPC, deferred selection saves, session persist/rollback, pet opt-in terminal Gajae pet with skin picker | ~10 | **P3** | ✓ partial |
| C14 | `ci_release_stabilization` | affected-path resolution, SDK publish contract, release gates, shard isolation, fixture scoping, biome pin | ~25 | **P3** | ✗ |
| C15 | `browser_psmux_misc` | expired dead browser tab recovery, psmux compatibility lifecycle, Windows psmux coordinator, managed assistant message shells, cooperative mid-run context maintenance, browser profile reuse | ~12 | **P3** | ✗ |
| C16 | `agent_async_misc` | async resume authority binding, queued epochs/turn lifecycle, managed session directory collisions, MCP explicit tools-only config, Python admission close, serialized prompt/model admission | ~15 | **P3** | ✗ |
| C17 | `provider_safety_transport` | classify provider safety stops across transports, managed fallback local failures outside provider authority | ~5 | **P2** | ✓ |
| C18 | `docs_changelog_qa` | changelog dedup, QA evidence artifacts, TUI PTY capture, SDK application development guide repair | ~10 | **P3** | ✗ |

Total allocated: ~263 (remaining ~39 are version bumps, CI-only, test-contract syncs, style-only — batch-noted, no dedicated card needed).

## Model-related commits cross-reference

These clusters also feed `30_model_provider_delta.md`:

- **C2**: control-token neutralization affects GPT-5.6 request boundary → `packages/ai` transport
- **C3**: sticky fallback chains, /model overrides, preset reasoning → `model-resolver`, `model-selector`
- **C11**: Grok 4.5, GPT-5.6 Codex presets, mpreset → `descriptors`, `models.json`, selector
- **C12**: thinking capabilities, invalid_prompt circuit breaker → `providers/`, `ai/` typing
- **C13**: durable default model selection → `session`, `rpc`
- **C17**: safety stop classification → provider transport layer

## Sol dispatch slots (disjoint write scopes)

| worker | clusters | write scope |
|---|---|---|
| W1 | C1, C16 | `struct_har/chase/10.087_*`, `10.088_*` |
| W2 | C2, C4 | `struct_har/chase/10.089_*`, `10.090_*` |
| W3 | C3, C11, C12, C17 | `struct_har/chase/10.091_*`, `10.092_*`, `10.093_*`, `10.094_*` |
| W4 | C5, C6 | `struct_har/chase/10.095_*`, `10.096_*` |
| W5 | C7, C8, C9 | `struct_har/chase/10.097_*`, `10.098_*`, `10.099_*` |
| W6 | C10, C13, C15 | `struct_har/chase/10.100_*`, `10.101_*`, `10.102_*` |
| W7 | C14, C18 | `struct_har/chase/10.103_*`, `10.104_*` |

Main session owns: MOC rows, README pin table, 002_gap_inventory update, C-phase verification, D close.
