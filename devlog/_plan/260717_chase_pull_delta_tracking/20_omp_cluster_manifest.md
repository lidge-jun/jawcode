# 20 — OMP cluster manifest INDEX

> Range: `7aa1d581c..b0d04e517` (`origin/main`), **586 non-merge commits**
> Last carded: 20.050e @ `7aa1d581c` (v16.4.2)
> Versions crossed: v16.4.3, v16.4.4, v17.0.0, v17.0.1
> Date: 2026-07-17
> Status: **INDEX** — 세부 파일은 `020_omp_D{NN}_*.md` 참조

## 클러스터 세부 파일

| # | file | theme | priority | model |
|---|---|---|---|---|
| D01 | [020_omp_D01_model_hub_selector.md](./020_omp_D01_model_hub_selector.md) | model hub/selector | P1 | ✓ |
| D02 | [020_omp_D02_catalog_pricing_routing.md](./020_omp_D02_catalog_pricing_routing.md) | catalog pricing/routing | P1 | ✓ |
| D03 | [020_omp_D03_auth_oauth_credential.md](./020_omp_D03_auth_oauth_credential.md) | auth/OAuth/credential | P1 | ✓ |
| D04 | [020_omp_D04_provider_transport_schema.md](./020_omp_D04_provider_transport_schema.md) | provider/transport/schema | P1 | ✓ |
| D05 | [020_omp_D05_model_resolver_fallback.md](./020_omp_D05_model_resolver_fallback.md) | model resolver/fallback | P1 | ✓ |
| D06 | [020_omp_D06_vibe_mode.md](./020_omp_D06_vibe_mode.md) | vibe mode | P2 | ✗ |
| D07 | [020_omp_D07_ask_dialog.md](./020_omp_D07_ask_dialog.md) | ask dialog | P2 | ✗ |
| D08 | [020_omp_D08_tui_render_streaming.md](./020_omp_D08_tui_render_streaming.md) | TUI render/streaming | P2 | ✗ |
| D09 | [020_omp_D09_advisor_steering.md](./020_omp_D09_advisor_steering.md) | advisor/steering | P2 | ✗ |
| D10 | [020_omp_D10_agent_loop_tool_stream.md](./020_omp_D10_agent_loop_tool_stream.md) | agent-loop/tool/stream | P2 | ✓ partial |
| D11 | [020_omp_D11_search_grep_tools.md](./020_omp_D11_search_grep_tools.md) | search/grep/tools | P2 | ✗ |
| D12 | [020_omp_D12_plugin_mcp_discovery.md](./020_omp_D12_plugin_mcp_discovery.md) | plugin/MCP/discovery | P2 | ✗ |
| D13 | [020_omp_D13_session_settings_startup.md](./020_omp_D13_session_settings_startup.md) | session/settings/startup | P3 | ✗ |
| D14 | [020_omp_D14_mnemopi_memory_eval.md](./020_omp_D14_mnemopi_memory_eval.md) | mnemopi/memory/eval | P3 | ✗ |
| D15 | [020_omp_D15_browser_bash_commit.md](./020_omp_D15_browser_bash_commit.md) | browser/bash/commit | P3 | ✗ |
| D16 | [020_omp_D16_collab_web_extension.md](./020_omp_D16_collab_web_extension.md) | collab-web/extension | P3 | ✗ |
| D17 | [020_omp_D17_usage_quota_spend_limit.md](./020_omp_D17_usage_quota_spend_limit.md) | usage/quota/spend-limit | P1 | ✓ |
| D18 | [020_omp_D18_tui_sixel_subagent_misc.md](./020_omp_D18_tui_sixel_subagent_misc.md) | TUI sixel/subagent/misc | P3 | ✗ |
| D19 | [020_omp_D19_centralized_prompt_small_model.md](./020_omp_D19_centralized_prompt_small_model.md) | centralized prompt/small model | P2 | ✓ |
| D20 | [020_omp_D20_ci_release_changelog.md](./020_omp_D20_ci_release_changelog.md) | CI/release/changelog | P3 | ✗ |
| — | [029_omp_batch_note.md](./029_omp_batch_note.md) | batch-note (bumps/merge/style) | — | ✗ |

## Cluster summary

| # | slug | theme | ~commits | sol priority | model-related |
|---|---|---|---:|---|---|
| D1 | `model_hub_selector_role_management` | model hub unified management/search, floating model selection, model browser keyboard nav, sidebar reordering, custom role management, model search ranking, visual separator, session selector tiered search | ~18 | **P1** | ✓ |
| D2 | `catalog_pricing_routing_kimi_glm_mai` | Kimi K2.7-Code maxTokens 65K on Fireworks, Kimi K2.7 timeout scoping to Moonshot, MAI Code route invalidation → /responses, Z.ai GLM-5.2 anthropic-messages budget-effort, GLM coding-plan idle timeout widen, OpenRouter usage reconciliation + catalog updates, copilot mai-code routing | ~12 | **P1** | ✓ |
| D3 | `auth_oauth_credential_rotation` | automatic credential rotation for invalidated OAuth, serialized provider OAuth refreshes, targeted OAuth row retention after races, org-scoped credential identity, org-presence broker routing, login dialog paste-code fallback, stale OAuth session sticky clearing, perplexity OAuth token leak fix, auth storage schema paranoia, enhanced paste login prompts, diagnostic headers on auth-gateway | ~25 | **P1** | ✓ |
| D4 | `provider_transport_schema_hardening` | Anthropic Vertex effort beta gating, Vertex fallback effort sanitization, Google/CCA boolean schema coercion, conditional keyword stripping, not-schema rejection, reasoning sampling param omission, legacy Anthropic beta gating to official endpoints, eager streaming disable for custom Anthropic, provider header defaults isolation, thinking suffix fuzzy match preservation, copilot business vision restoration/confirmation/denial | ~20 | **P1** | ✓ |
| D5 | `model_resolver_fallback_perf_tracking` | model fallback for hard errors, retry budget exhaustion fallback, persistent model performance tracking + migration, fuzzy literal thinking suffix preservation, text-only model image stripping/replay, thinking auto-clear on role assignment, GPT-5.6 Codex web search support | ~12 | **P1** | ✓ |
| D6 | `vibe_mode_persistent_agents` | vibe mode infrastructure, persistent worker sessions, interactive interface integration, vibe runtime session lifecycle/concurrency, dynamic rendering/state syncing, background agents, vibe mode tool lifecycle | ~12 | **P2** | ✗ |
| D7 | `ask_dialog_rich_interactive` | rich interactive ask dialog, multi-select Next gating, guest tagging, countdown reset, row-specific note prefill, chat redirect result | ~8 | **P2** | ✗ |
| D8 | `tui_render_streaming_stability` | streamed table scrollback stabilization, deferred alternate exit, stale-buffer flicker prevention, blank streamed diff row preservation, streamed diff scrollback highlighting, cursor final answer display after tools, viewport/transcript fixes, cmux notification routing, modifyOtherKeys tmux fallback, keyed hook status rendering | ~18 | **P2** | ✗ |
| D9 | `advisor_steering_terminal_blocker` | late blocker steering after terminal answer, immune window arming, quarantined unsafe advise notes, unknown tool response quarantine, empty tool list preservation, late advisor terminal note preservation | ~10 | **P2** | ✗ |
| D10 | `agent_loop_tool_stream_fixes` | empty toolUse stop reclassification → retryable, incomplete sibling tool call discard, eager tool streaming disable for custom Anthropic, nested subagent output resolution, malformed tool argument recovery, provider stream failure surfacing, provider error surfacing to ACP clients | ~12 | **P2** | ✓ partial |
| D11 | `search_grep_tools_natives` | xAI transport web-search honor, advanced grep pcre2/file traversal, ranged grep budgets, tool surface consolidation onto xd://, file completion in slash arguments, glob depth restriction, context padding disable for raw reads, read-only internal URL write rejection | ~15 | **P2** | ✗ |
| D12 | `plugin_mcp_discovery_config` | plugin verb alias guarding, plugin tool renderer crash guard, MCP local roots threading, plugin stdio command resolution, Codex config.toml MCP root, local image path resolution for MCP, skill reload/refresh, skill URL directory resolution, system-prompt cache stabilization via delta notices | ~15 | **P2** | ✗ |
| D13 | `session_settings_startup` | settings key rename collision avoidance, task prewalk opt-in, --tools/xdev tightening, startup changelog bounding, compiled appserver extension exit, plan mode reentry anchor, print-mode working indicator, autolearn capture skip after aborted turns | ~12 | **P3** | ✗ |
| D14 | `mnemopi_memory_eval` | Windows ORT DLL path pinning, working memory trim protection + cascade linked artifacts, direct runtime load failure recovery, isolated eval runtimes, python URI delegation, eval js URI selectors | ~10 | **P3** | ✗ |
| D15 | `browser_bash_commit_misc` | browser stealth acquire debugCatchError, tab teardown wait bounding, browser selector watchdog, puppeteer locator timeout fix, isolated bash shell abort, commit creation before agent teardown, nested internal URL resolution, html comment hiding, macOS stderr viewport corruption fix, empty stop retry failure surfacing | ~15 | **P3** | ✗ |
| D16 | `collab_web_extension` | user/host message markdown rendering, active transcript args/tools dedup, extension sendUserMessage steer queueing, plugin build restructuring | ~8 | **P3** | ✗ |
| D17 | `usage_quota_spend_limit` | Anthropic spend-limit as persistent usage-limit, spend limit classification in quota parser, usage-limit classifier retention, OpenRouter usage reconciliation, content-filter retry classification, codex reset to selected account, snapshot validation for login-sourced API keys | ~10 | **P1** | ✓ |
| D18 | `tui_sixel_subagent_pet_misc` | SIXEL height rounding/aspect scaling, OSC 99 probe tmux gate, subagent progress output sanitization, mixed assistant segment order, empty image placeholder prevention, CJK grapheme_width_str CRLF zero-width, editor CRLF trim, beginner-safe daemon shortcuts, cursor max-mode cache/flag preservation, npm self-update routing, max-time duration suffix parsing, magic keyword punctuation, pinned git source replacement, startup changelog versioning | ~20 | **P3** | ✗ |
| D19 | `centralized_prompt_small_model` | centralized preprocessing/guidance for small models, thinking-level configuration precedence, task-agent field/model resolution, chat envelope title preprocessing, plan subagent removal, agent delegation logic refinement | ~8 | **P2** | ✓ |
| D20 | `ci_release_changelog` | version bumps, changelog rewrites/dedup, biome formatting, stale test fixes, CI flaky clipboard, vouched list updates | ~40 | **P3** | ✗ |

Total allocated: ~320 (remaining ~266 are version bumps, merge resolutions, --amend pairs, test-only, style-only, changelog — batch-noted, fold into owning cluster or skip).

## Model-related commits cross-reference

These clusters also feed `30_model_provider_delta.md`:

- **D1**: model hub, floating selection, role management, search ranking → `model-selector`, UI layer
- **D2**: catalog pricing/routing/timeout → `packages/catalog`, `models.json`
- **D3**: OAuth/credential rotation, org-scoped identity → `auth`, `ai/` provider transport
- **D4**: Anthropic/Google schema/effort/transport → `providers/`, `schema`
- **D5**: fallback chains, perf tracking, image stripping → `model-resolver`, `session`
- **D10**: toolUse retry, stream failure surfacing → `agent-loop`, provider interaction
- **D17**: usage/quota/spend-limit → `ai/` billing/usage
- **D19**: small model preprocessing, task-agent resolution → `prompts`, `model-resolver`

## Sol dispatch slots (disjoint write scopes)

| worker | clusters | write scope |
|---|---|---|
| W1 | D1, D5 | `struct_har/chase/20.051_*`, `20.052_*` |
| W2 | D2, D17 | `struct_har/chase/20.053_*`, `20.054_*` |
| W3 | D3, D4 | `struct_har/chase/20.055_*`, `20.056_*` |
| W4 | D6, D7 | `struct_har/chase/20.057_*`, `20.058_*` |
| W5 | D8, D18 | `struct_har/chase/20.059_*`, `20.060_*` |
| W6 | D9, D10 | `struct_har/chase/20.061_*`, `20.062_*` |
| W7 | D11, D12 | `struct_har/chase/20.063_*`, `20.064_*` |
| W8 | D13, D15 | `struct_har/chase/20.065_*`, `20.066_*` |
| W9 | D14, D16, D19 | `struct_har/chase/20.067_*`, `20.068_*`, `20.069_*` |
| W10 | D20 | `struct_har/chase/20.070_*` (batch-note only) |

Main session owns: MOC rows, README pin table, 002_gap_inventory update, C-phase verification, D close.
