# 040 — OMP sol dispatch (10 workers)

OMP 20개 클러스터를 10개 worker가 나눠 쓴다. 각 worker는 아래에 지정된 card file만 생성하며, MOC·README·gap inventory와 다른 worker의 card는 수정하지 않는다.

## Worker 배정 상세

| worker | clusters | card range | write scope |
|---|---|---|---|
| OW1 | D01 (model hub), D05 (resolver/fallback) | 20.051–20.052 | `struct_har/chase/20.051_omp_chase_model_hub_selector.md`, `struct_har/chase/20.052_omp_chase_model_resolver_fallback.md` |
| OW2 | D02 (catalog), D17 (usage/quota) | 20.053–20.054 | `struct_har/chase/20.053_omp_chase_catalog_pricing_routing.md`, `struct_har/chase/20.054_omp_chase_usage_quota_spend_limit.md` |
| OW3 | D03 (auth/OAuth), D04 (provider/schema) | 20.055–20.056 | `struct_har/chase/20.055_omp_chase_auth_oauth_credential.md`, `struct_har/chase/20.056_omp_chase_provider_transport_schema.md` |
| OW4 | D06 (vibe mode), D07 (ask dialog) | 20.057–20.058 | `struct_har/chase/20.057_omp_chase_vibe_mode.md`, `struct_har/chase/20.058_omp_chase_ask_dialog.md` |
| OW5 | D08 (TUI render), D18 (sixel/misc) | 20.059–20.060 | `struct_har/chase/20.059_omp_chase_tui_render_streaming.md`, `struct_har/chase/20.060_omp_chase_tui_sixel_subagent_misc.md` |
| OW6 | D09 (advisor), D10 (agent loop) | 20.061–20.062 | `struct_har/chase/20.061_omp_chase_advisor_steering.md`, `struct_har/chase/20.062_omp_chase_agent_loop_tool_stream.md` |
| OW7 | D11 (search/grep), D12 (plugin/MCP) | 20.063–20.064 | `struct_har/chase/20.063_omp_chase_search_grep_tools.md`, `struct_har/chase/20.064_omp_chase_plugin_mcp_discovery.md` |
| OW8 | D13 (session/startup), D15 (browser/bash) | 20.065–20.066 | `struct_har/chase/20.065_omp_chase_session_settings_startup.md`, `struct_har/chase/20.066_omp_chase_browser_bash_commit.md` |
| OW9 | D14 (mnemopi/eval), D16 (collab/ext), D19 (small model) | 20.067–20.069 | `struct_har/chase/20.067_omp_chase_mnemopi_memory_eval.md`, `struct_har/chase/20.068_omp_chase_collab_web_extension.md`, `struct_har/chase/20.069_omp_chase_centralized_prompt_small_model.md` |
| OW10 | D20 (CI/release/changelog) | 20.070 | `struct_har/chase/20.070_omp_chase_ci_release_changelog.md` (batch-note only) |

위 20개 경로는 번호와 파일명이 겹치지 않는다. 각 worker의 write scope는 명시된 파일로 한정되어 상호 배타적이다.

## Worker별 TASK packet 템플릿

각 OMP worker는 아래 packet을 받는다.

1. Read-only context: `devlog/_plan/260717_chase_pull_delta_tracking/`
2. Assigned clusters: 위 배정표의 cluster ID와 해당 `020_omp_D{NN}_*.md` 커밋 전수 표
3. Write scope: 위 배정표에 명시된 exact `struct_har/chase/*.md` 경로만
4. Quality reference: `struct_har/chase/20.050e_omp_chase_providers_usage_orchestration_misc.md`
5. Constraint: 신규 chase card만 작성한다. MOC, README, `002_gap_inventory`, model 폴더, 코드와 다른 worker의 파일은 수정하지 않는다.
6. Evidence: 모든 인용 hash에 `git cat-file -e <hash>^{commit}`을 적용하고 card convention header를 확인한다.
7. Runtime: model `gpt-5.6-sol`, `fork_context=true`

### Worker packet 입력값

| worker | cluster source | output files |
|---|---|---|
| OW1 | `020_omp_D01_*`, `020_omp_D05_*` | 20.051, 20.052 |
| OW2 | `020_omp_D02_*`, `020_omp_D17_*` | 20.053, 20.054 |
| OW3 | `020_omp_D03_*`, `020_omp_D04_*` | 20.055, 20.056 |
| OW4 | `020_omp_D06_*`, `020_omp_D07_*` | 20.057, 20.058 |
| OW5 | `020_omp_D08_*`, `020_omp_D18_*` | 20.059, 20.060 |
| OW6 | `020_omp_D09_*`, `020_omp_D10_*` | 20.061, 20.062 |
| OW7 | `020_omp_D11_*`, `020_omp_D12_*` | 20.063, 20.064 |
| OW8 | `020_omp_D13_*`, `020_omp_D15_*` | 20.065, 20.066 |
| OW9 | `020_omp_D14_*`, `020_omp_D16_*`, `020_omp_D19_*` | 20.067–20.069 |
| OW10 | `020_omp_D20_*` | 20.070 |
