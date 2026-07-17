# 040 — GJC sol dispatch (7 workers)

GJC 18개 클러스터를 7개 worker가 나눠 쓴다. 각 worker는 아래에 지정된 card file만 생성하며, MOC·README·gap inventory와 다른 worker의 card는 수정하지 않는다.

## Worker 배정 상세

| worker | clusters | card range | write scope |
|---|---|---|---|
| GW1 | C01 (SDK lifecycle), C16 (agent async misc) | 10.087–10.088 | `struct_har/chase/10.087_gjc_chase_sdk_lifecycle_ledger.md`, `struct_har/chase/10.088_gjc_chase_agent_async_misc.md` |
| GW2 | C02 (security/prompt), C04 (prompt refactor) | 10.089–10.090 | `struct_har/chase/10.089_gjc_chase_security_prompt_control_token.md`, `struct_har/chase/10.090_gjc_chase_prompt_refactor_compact_ralplan.md` |
| GW3 | C03 (model preset), C11 (Grok/codex), C12 (reasoning), C17 (safety) | 10.091–10.094 | `struct_har/chase/10.091_gjc_chase_model_preset_fallback_selection.md`, `struct_har/chase/10.092_gjc_chase_grok_codex_benchmark_presets.md`, `struct_har/chase/10.093_gjc_chase_codex_reasoning_thinking_sdk.md`, `struct_har/chase/10.094_gjc_chase_provider_safety_transport.md` |
| GW4 | C05 (command palette), C06 (IRC/Kitty/tmux) | 10.095–10.096 | `struct_har/chase/10.095_gjc_chase_tui_command_palette.md`, `struct_har/chase/10.096_gjc_chase_tui_irc_sidebar_kitty_tmux.md` |
| GW5 | C07 (coordinator), C08 (telegram v2), C09 (interview/goal) | 10.097–10.099 | `struct_har/chase/10.097_gjc_chase_coordinator_mcp_session_reaper.md`, `struct_har/chase/10.098_gjc_chase_telegram_notification_v2.md`, `struct_har/chase/10.099_gjc_chase_deep_interview_goal_ultragoal.md` |
| GW6 | C10 (context SSOT), C13 (RPC/pet), C15 (browser/psmux) | 10.100–10.102 | `struct_har/chase/10.100_gjc_chase_session_context_usage_ssot.md`, `struct_har/chase/10.101_gjc_chase_rpc_durable_selection_pet.md`, `struct_har/chase/10.102_gjc_chase_browser_psmux_misc.md` |
| GW7 | C14 (CI/release), C18 (docs/changelog) | 10.103–10.104 | `struct_har/chase/10.103_gjc_chase_ci_release_stabilization.md`, `struct_har/chase/10.104_gjc_chase_docs_changelog_qa.md` |

위 18개 경로는 번호와 파일명이 겹치지 않는다. 각 worker의 write scope는 명시된 파일로 한정되어 상호 배타적이다.

## Worker별 TASK packet 템플릿

각 GJC worker는 아래 packet을 받는다.

1. Read-only context: `devlog/_plan/260717_chase_pull_delta_tracking/`
2. Assigned clusters: 위 배정표의 cluster ID와 해당 `010_gjc_C{NN}_*.md` 커밋 전수 표
3. Write scope: 위 배정표에 명시된 exact `struct_har/chase/*.md` 경로만
4. Quality reference: `struct_har/chase/10.086_gjc_chase_tui_tmux_telegram_operator_ux.md`
5. Constraint: 신규 chase card만 작성한다. MOC, README, `002_gap_inventory`, model 폴더, 코드와 다른 worker의 파일은 수정하지 않는다.
6. Evidence: 모든 인용 hash에 `git cat-file -e <hash>^{commit}`을 적용하고 card convention header를 확인한다.
7. Runtime: model `gpt-5.6-sol`, `fork_context=true`

### Worker packet 입력값

| worker | cluster source | output files |
|---|---|---|
| GW1 | `010_gjc_C01_*`, `010_gjc_C16_*` | 10.087, 10.088 |
| GW2 | `010_gjc_C02_*`, `010_gjc_C04_*` | 10.089, 10.090 |
| GW3 | `010_gjc_C03_*`, `010_gjc_C11_*`, `010_gjc_C12_*`, `010_gjc_C17_*` | 10.091–10.094 |
| GW4 | `010_gjc_C05_*`, `010_gjc_C06_*` | 10.095, 10.096 |
| GW5 | `010_gjc_C07_*`, `010_gjc_C08_*`, `010_gjc_C09_*` | 10.097–10.099 |
| GW6 | `010_gjc_C10_*`, `010_gjc_C13_*`, `010_gjc_C15_*` | 10.100–10.102 |
| GW7 | `010_gjc_C14_*`, `010_gjc_C18_*` | 10.103, 10.104 |
