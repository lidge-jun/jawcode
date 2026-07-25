# 000 — 전체 로드맵 + 파일 구조 설계

> Goalplan: `.codexclaw/goalplans/jawcode-chase-pull-delta-tracking-gjc-omp-upstre/`
> Session: `019f6de9-f741-7233-9af9-c1684303685b`
> Phase: 0 (docs-first roadmap)
> Date: 2026-07-17
> CWD: `/Users/jun/Developer/new/700_projects/jawcode`

## 목적

기존 monolithic 4개 파일(10_, 20_, 30_, 40_)을 260711_chase_card_cycle 및 260703_chase_pull_refresh 패턴에 맞춰 세부 파일로 분해한다. 각 클러스터가 독립 파일을 가지고, sol 서브에이전트가 개별 파일을 받아 diff-level 카드를 작성할 수 있도록 한다.

## 패턴 분석: 기존 devlog units

### 260711_chase_card_cycle (참조 패턴 A — 카드 분할)

```
000_card_split.md    ← P artifact: 전체 카드 분할 계획, 커밋 전수 테이블, worker 배정
001_d_summary.md     ← D summary: 완료 증거, 검증, pessimist record
```

특징: 하나의 P 문서에 GJC/OMP 양쪽 카드 분할을 전부 담음. 11개 카드를 4 worker에 배정.

### 260703_chase_pull_refresh (참조 패턴 B — pull + synthesis)

```
00_moc.md            ← MOC: 목적, 스코프, 에비던스 읽기 목록
10_pull_delta.md     ← pull 전후 해시, 커밋 클러스터 증거
20_card_synthesis.md ← 카드별 분류/근거 테이블
30_quality_gate.json ← 품질 게이트 상태
31_goal_snapshot.json← 목표 스냅샷
```

특징: 단계별로 분리된 10/20/30 번호대 파일.

## 이번 unit의 파일 설계

888개 커밋, 38개 클러스터, 17 workers — 260711 패턴의 `000_card_split.md` 하나로는 너무 크다.
decade-range 분리 + 클러스터별 독립 파일을 쓴다.

### 최종 파일 트리

```
260717_chase_pull_delta_tracking/
├── 000_plan.md                          ← 이 파일 (전체 로드맵)
├── 00_moc.md                            ← 기존 MOC (목차로 전환)
│
├── 001_pull_evidence.md                 ← pull 전후 해시, 범위, 커밋 수 증거
│
├── 010_gjc_C01_sdk_lifecycle_ledger.md        ← GJC 클러스터 세부 파일
├── 010_gjc_C02_security_prompt_control_token.md
├── 010_gjc_C03_model_preset_fallback_selection.md
├── 010_gjc_C04_prompt_refactor_compact_ralplan.md
├── 010_gjc_C05_tui_command_palette.md
├── 010_gjc_C06_tui_irc_sidebar_kitty_tmux.md
├── 010_gjc_C07_coordinator_mcp_session_reaper.md
├── 010_gjc_C08_telegram_notification_v2.md
├── 010_gjc_C09_deep_interview_goal_ultragoal.md
├── 010_gjc_C10_session_context_usage_ssot.md
├── 010_gjc_C11_grok_codex_benchmark_presets.md
├── 010_gjc_C12_codex_reasoning_thinking_sdk.md
├── 010_gjc_C13_rpc_durable_selection_pet.md
├── 010_gjc_C14_ci_release_stabilization.md
├── 010_gjc_C15_browser_psmux_misc.md
├── 010_gjc_C16_agent_async_misc.md
├── 010_gjc_C17_provider_safety_transport.md
├── 010_gjc_C18_docs_changelog_qa.md
├── 019_gjc_batch_note.md                ← 카드 불필요 커밋 (bumps, CI-only, style)
│
├── 020_omp_D01_model_hub_selector.md          ← OMP 클러스터 세부 파일
├── 020_omp_D02_catalog_pricing_routing.md
├── 020_omp_D03_auth_oauth_credential.md
├── 020_omp_D04_provider_transport_schema.md
├── 020_omp_D05_model_resolver_fallback.md
├── 020_omp_D06_vibe_mode.md
├── 020_omp_D07_ask_dialog.md
├── 020_omp_D08_tui_render_streaming.md
├── 020_omp_D09_advisor_steering.md
├── 020_omp_D10_agent_loop_tool_stream.md
├── 020_omp_D11_search_grep_tools.md
├── 020_omp_D12_plugin_mcp_discovery.md
├── 020_omp_D13_session_settings_startup.md
├── 020_omp_D14_mnemopi_memory_eval.md
├── 020_omp_D15_browser_bash_commit.md
├── 020_omp_D16_collab_web_extension.md
├── 020_omp_D17_usage_quota_spend_limit.md
├── 020_omp_D18_tui_sixel_subagent_misc.md
├── 020_omp_D19_centralized_prompt_small_model.md
├── 020_omp_D20_ci_release_changelog.md
├── 029_omp_batch_note.md                ← 카드 불필요 커밋
│
├── 030_model_gjc_delta.md               ← model/provider 교차: GJC 쪽
├── 030_model_omp_delta.md               ← model/provider 교차: OMP 쪽
├── 030_model_update_plan.md             ← model/ 폴더 갱신 계획
│
├── 040_sol_dispatch_gjc.md              ← GJC worker 배정 상세
├── 040_sol_dispatch_omp.md              ← OMP worker 배정 상세
├── 040_sol_dispatch_priority.md         ← wave 우선순위 + 작업 템플릿
│
└── 099_d_summary.md                     ← 각 work-phase D summary (Phase 0용)
```

총 파일 수: 50개 (000-range 3, 010-range 19, 020-range 21, 030-range 3, 040-range 3, 099 1)

## 세부 파일 포맷 (010/020 클러스터 파일)

각 클러스터 파일은 260711의 카드 분할 테이블과 같은 구조를 따른다:

```markdown
# 010_gjc_C{NN}_{slug}

> Range: `{start_hash}..{end_hash}` (클러스터 범위)
> Cluster: C{NN} — {theme}
> Sol priority: P{1|2|3}
> Model-related: {✓|✗}
> Card target: 10.{NNN}_{slug}
> Worker: GW{N}

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `{hash}` | {one-line} | {packages/path} |
| ... | ... | ... | ... |

## 주제 분석

{클러스터의 핵심 변경 사항, JWC에 대한 영향 분석}

## model/ 교차 참조

{model-related인 경우: 어떤 model/ 파일에 영향을 미치는지}

## Worktree 대조

{JWC 워크트리에서 해당 영역의 현재 상태}
```

## 의존성 순서

```
Phase 0 (이 로드맵) → Phase 1 (GJC) → Phase 2 (OMP) → Phase 3 (교차 추적 + dispatch)
                                   ↘                ↗
                                    Phase 1 & 2는 병렬 가능하지만
                                    Phase 3은 둘 다 완료 후
```

Phase 1과 2는 서로 독립적이므로 병렬 실행 가능. Phase 3은 1+2의 결과를 종합하므로 순서 의존.

## 기존 monolithic 파일 처리

| 기존 파일 | 처리 |
|---|---|
| `10_gjc_cluster_manifest.md` | → 목차 + 세부 파일 링크 (010_gjc_C01~C18 + 019) |
| `20_omp_cluster_manifest.md` | → 목차 + 세부 파일 링크 (020_omp_D01~D20 + 029) |
| `30_model_provider_delta.md` | → 목차 + 세부 파일 링크 (030_model_*) |
| `40_sol_dispatch_plan.md` | → 목차 + 세부 파일 링크 (040_sol_*) |

monolithic 파일은 삭제하지 않고 세부 파일 목차(index)로 전환한다.

## Accept criteria 매핑

| criteria | 검증 방법 |
|---|---|
| C1 diff-level 정밀도 | 각 010/020 파일에 커밋 해시 테이블 + 파일 경로 존재 확인 |
| C2 커밋 전수 배정 | `git rev-list --no-merges` 커밋 수 vs 세부 파일 합산 커밋 수 교차 검증 |
| C3 model 이중 태깅 | 030 파일에 해당 커밋 + 010/020 역참조 존재 확인 |
| C4 disjoint write scope | 040 파일에 worker별 scope 테이블, 겹침 확인 |
| C5 monolithic → index | 10_/20_/30_/40_ 파일이 링크 목차로 변환됨 확인 |
