# 009 — chase follow tiers (따라가기 난이도 분류)

> 상태: 🟡 운영 중 · 2026-07-01 ② 결정 인터뷰 기반
> **의미**: active chase 카드를 "따라가기 난이도"로 3분류. [007_follow_index](./007_follow_index.md)가 우선순위(P)라면, 009는 **결정 부담** 축.
> 규약: [005_devlog_numbering](./005_devlog_numbering.md) · 판정 근거는 각 카드 "Interview decision (2026-07-01)" 블록.

## 분류 정의

| Tier | 의미 | 처리 |
|---|---|---|
| ① | 기능 결정 없이 따라갈 수 있음 (격리 버그픽스·플랫폼·UX 말단·확정 import/adapt) | 카드별 구현 goal로 바로 진행 가능 |
| ② | 기능 결정 필요 (정체성·아키텍처·과금·상태 마이그레이션·보안) | 구현 전 인터뷰/리뷰 게이트 필수 |
| ③ | 더 하드닝 될 때까지 백로그 (게이트 미충족·JWC 개념 부재·대형 미성숙) | 선행조건 충족 시 재평가 |

## ① 기능 결정 없이 따라갈 수 있음

### ②→① 격하 (2026-07-01 인터뷰 확정, 15장)

| NNN | 스코프 | 판정 |
|---|---|---|
| [10.065](./10.065_gjc_chase_prompt_self_awareness_grounding.md) | prompt self-awareness | ADAPT · content는 JWC-authored 불변식 |
| [20.027](./20.027_omp_chase_prompts_subagent_discovery_rules.md) | prompts/subagent/discovery | ADAPT · subagent 이름 JWC 재작성 |
| [10.062](./_fin/10/10.062_gjc_chase_ai_provider_deepinfra_gemini_ua.md) | DeepInfra + Gemini UA | IMPORT ✅ _fin 260701 |
| [10.054](./_fin/10/10.054_gjc_chase_local_provider_discovery.md) | local provider discovery | IMPORT ✅ _fin 260701 |
| [20.023](./_fin/20/20.023_omp_chase_ai_providers_catalog_service_tier.md) | providers/catalog/service-tier | IMPORT/ADAPT ✅ _fin 260701 (reference-triage, no code) |
| [20.019](./_fin/20/20.019_omp_chase_codex_ai_config.md) | codex/AI config | ADAPT ✅ _fin 260701 (base-url fix + textVerbosity; default-verbosity/tiny-role defer→③) |
| [20.021](./_fin/20/20.021_omp_chase_v2_streaming_integrity.md) | v2 streaming integrity | ✅ _fin 260701 (IMPORT: partialJson terminal scrub) |
| [20.009](./_fin/20/20.009_omp_chase_append_only_context_integrity.md) | append-only context integrity | ✅ _fin 260701 (IMPORT) |
| [20.025](./_fin/20/20.025_omp_chase_compaction_snapcompact_session_scope.md) | snapcompact/session-scope | ✅ _fin 260701 (IMPORT: bounded edit snapshots; snapcompact/session-loader defer③) |
| [20.020](./_fin/20/20.020_omp_chase_session_title_idle_recap.md) | session title/idle recap | ✅ _fin 260701 (ADAPT: title casing) |
| [10.042](./10.042_gjc_chase_deep_interview_ask_goal_state.md) | deep-interview ask+goal-state | ADAPT |
| [10.059](./_fin/10/10.059_gjc_chase_deep_interview_ask_ralplan_gate.md) | ralplan ask gate + render guard | ✅ _fin 260701 (ADAPT+IMPORT) |
| [10.019](./10.019_gjc_chase_gc_file_lock.md) | jwc gc 명령 | ADAPT |
| [20.028](./20.028_omp_chase_web_search_provider_settings.md) | web-search provider settings | IMPORT |
| [10.048](./10.048_gjc_chase_dev_ci_release_packaging.md) | dev/CI/release packaging | ADAPT |

> 추가 ① 후보(플랫폼/UX 말단, 미인터뷰): 10.057 · 10.061 · 10.041 · 10.056 · 10.064 · 10.060 · 10.052 · 20.015. 다음 사이클에서 확정.

## ② 기능 결정 필요 (게이트 유지)

| NNN | 스코프 | 판정 |
|---|---|---|
| [20.024](./20.024_omp_chase_mcp_oauth_reauth_flow.md) | MCP oauth/reauth | ADAPT + 독립 보안리뷰 게이트 (① 격하 금지) |

## ③ 더 하드닝 될 때까지 백로그

### 인터뷰 확정 defer (2026-07-01, 3장)

| NNN | 스코프 | 사유 |
|---|---|---|
| [10.027](./10.027_gjc_chase_goal_live_artifact_engine.md) | goal live-artifact 검증엔진 | 대형 신규표면, 코어 안정화 대기 |
| [10.044](./10.044_gjc_chase_plugin_extensibility_bundle.md) | plugin extensibility/bundle | 대형 신규표면 |
| [10.063](./10.063_gjc_chase_natives_platform_split_packages.md) | natives 플랫폼 분리 | 대형 배포아키텍처, 저긴급 |

### 기존 게이트/미성숙 (미인터뷰)

| NNN | 사유 |
|---|---|
| [10.006](./10.006_gjc_chase_tui_core.md) | 082/083 분리 후에만 |
| [20.004](./20.004_omp_chase_lsp_dap.md) | held |
| [20.017](./20.017_omp_chase_multi_advisor_runtime.md) | JWC에 advisor 개념 부재 — 미래 설계 입력 |
| [20.018](./20.018_omp_chase_thinking_normalization.md) | pi-dialect 부재 — 재설계 |
| [20.022](./20.022_omp_chase_ssh_tooling_ux.md) | ssh:// 표면 미성숙 |
| [10.045](./10.045_gjc_chase_computer_use_native_control.md) | 대형 |
| [10.046](./10.046_gjc_chase_rlm_research_mode.md) | 대형 |
| [10.039](./10.039_gjc_chase_harness_receipts_phase_rollup.md) | harness 레인 선행 |
| [10.049](./10.049_gjc_chase_performance_bench_corpus.md) | 벤치 코퍼스 미성숙 |
| [10.050](./10.050_gjc_chase_session_tmux_team_worktree.md) | 대형 |
| [20.029](./20.029_omp_chase_stats_sync_worker_perf.md) | JWC packages/stats peer 부재 |

> OMP 20.* 카드는 설계상 전부 reference-only(1:1 port ❌)이므로, ①로 분류돼도 "그대로 복사"가 아니라 "JWC식 재설계 후 채택"을 뜻한다.
