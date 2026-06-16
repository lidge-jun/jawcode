# 000 MOC — cli-jaw × jawcode distribution strategy

> 상태: 계획 정본. 기존 `jawcode_fork`, `github_deploy`, `packaging`, bridge 문서는 `_legacy/`로 보존한다.
> 260614 결정 반영: npm package는 `jawcode`, 설치 UX는 `npm install -g jawcode`, 실행 명령은 `jwc`, cli-jaw import surface는 `jawcode/sdk`.
> 260615 보강: 270–310은 jawcode/JWC를 cli-jaw에 이식하는 cross-repo porting queue이며, jawcode 계약 API와 cli-jaw API/Manager frontend 시안을 함께 문서화한다.

## 왜 새 폴더인가

기존 세 밴드는 같은 문제를 다른 이름으로 다루고 있었다.

| Legacy band | 실제 질문 | 새 위치 |
|---|---|---|
| `260612_jawcode_fork` | JWC를 cli-jaw의 네이티브 런타임으로 승격할 수 있는가 | 020, 100-160 |
| `260613_github_deploy` | 공개 repo/CI/release가 어떤 상태를 보증해야 하는가 | 060, 140, 180 |
| `260613_packaging` | 사용자가 설치할 수 있는 JWC 패키지를 어떻게 만들 것인가 | 040, 130, 140 |
| `260614_deploy_fork_packaging_bridge` | 세 밴드가 서로 막는 지점을 어디서 풀 것인가 | 이 MOC로 흡수 |

## 최종 제품 모양

1. **jawcode repo**는 JWC 엔진과 standalone CLI의 원천이다.
2. **standalone 배포**는 `npm install -g jawcode` 후 `jwc` 명령으로 동작한다.
3. **cli-jaw 통합 배포**는 별도 글로벌 `jwc` 설치 없이 JWC 기능을 포함한다. cli-jaw는 npm dependency `jawcode`의 `jawcode/sdk` export를 통해 같은 엔진을 로드한다.
4. **Bun 포함 배포**는 standalone JWC의 기본 전제다. 사용자가 별도 Bun을 설치하지 않아도 `jwc`가 실행되어야 한다.
5. **legacy identity cleanup**은 public/current surface에 남기지 않는다. 내부 `@gajae-code/*` 계보는 build 구현 상세로만 보존 가능하고, public docs/examples/status/artifact names는 Jawcode/JWC 기준이어야 한다.

## Decade map

| Range | 문서 | 목적 |
|---|---|---|
| 000 | 이 문서 | 통합 MOC |
| 010 | `010_current_state.md` | 현재 진행 상태와 legacy 위치 |
| 020 | `020_architecture_concept.md` | 별도 repo + cli-jaw 내장 개념 정리 |
| 030 | `030_product_surfaces.md` | standalone JWC / embedded cli-jaw / dev mode 표면 |
| 040 | `040_packaging_matrix.md` | package/import/runtime 계약 |
| 050 | `050_legacy_name_flip_timing.md` | legacy identity 제거 시점 |
| 060 | `060_ci_release_tracks.md` | CI와 release track |
| 070 | `070_decision_register.md` | 결정/열린 질문 |
| 080 | `080_bun_distribution_contract.md` | Bun 포함 배포 계약 |
| 090 | `090_blocker_free_readiness.md` | 실행 전 blocker 제거 체크 |
| 100 | `100_pre120_gap.md` | 110까지의 완료와 120 전 gap |
| 110 | `110_cli_jaw_merge_preconditions.md` | cli-jaw merge 전제 |
| 115 | `115_cli_jaw_integration_manifest.md` | cli-jaw repo 변경 manifest |
| 120 | `120_embedding_slice.md` | cli-jaw 내장 slice |
| 130 | `130_packaging_slice.md` | package `jawcode` slice |
| 140 | `140_independent_deploy_slice.md` | 독립 배포/CI 등록 |
| 150 | `150_legacy_name_flip_slice.md` | 양쪽 legacy identity 제거 |
| 160 | `160_cli_jaw_release_slice.md` | cli-jaw 통합 release |
| 180 | `180_validation_matrix.md` | 검증 행렬 |
| 190 | `190_risks.md` | 리스크/중단 조건 |
| 200 | `200_execution_order.md` | 실제 실행 순서 |
| 211 | `211_computer_use_mcp_default_restore_plan.md` | macOS-only MCP/Computer Use/CUA packaging restore |
| 220 | `220_pabcd_execution_plan.md` | 150까지 반복 PABCD 실행 계획 |
| 230 | `230_audit_round2_patch.md` | 감사 라운드 2 패치 |
| 240 | `240_publish_readiness_plan.md` | 게시 준비 (files 최적화 + CI 강화) |
| 250 | `250_remaining_160plus_cleanup.md` | 160+ 잔여 정리 실행 |
| 260 | `260_phase1_coordinator_rename.md` | gjc_coordinator → jwc_coordinator |
| 270 | `270_jwc_ui_cli_selector.md` | cli-jaw Manager selector + `/api/cli-registry` API contract for JWC visibility |
| 280 | `280_default_cli_switch_e2e.md` | cli-jaw default-switch + message/SSE/persistence API contract |
| 290 | `290_code_mode_acp_e2e.md` | cli-jaw Code REST ↔ AcpHost ↔ JWC ACP boundary |
| 300 | `300_code_mode_ui.md` | cli-jaw Manager native Code mode frontend contract |
| 301 | `301_manager_ui_code_jaw_design_interview.md` | Manager UI interview source: cwd-scoped Code mode + existing Jaw mode JWC native runtime attach |
| 302 | `302_p_documentation_plan.md` | PABCD documentation pass for API-level 270–310 crystallization |
| 305 | `305_jaw_mode_jwc_runtime_attach.md` | Existing Jaw mode `JWC` runtime selector/native attach contract |
| 310 | `310_parity_verification_matrix.md` | Cross-repo parity gate with API/frontend evidence rows |
| 320 | `320_post270_current_state_triage.md` | Consolidated post-270 cross-repo path map and follow-up decision |

## 이번 문서의 비범위

- 실제 cli-jaw/JWC 코드 구현은 하지 않는다. 다만 구현자가 바로 들어갈 수 있도록 file-level 계약과 검증 순서는 닫는다.
- `_legacy/` 내부 문서는 보존 기록이다. 새 실행 판단은 이 폴더의 000-320 문서를 우선한다.

## Active folder hygiene

The active range for this strategy is `000` through `320`. Completed ranges (000-260) are kept as historical evidence. The 270-310 range remains the active cross-repo cli-jaw porting queue.

`301`, `302`, and `305` are 300-band documentation/API crystallization artifacts, not separate product phases. PABCD receipts for this docs pass stay inside the same lexical neighborhood (`302.x_*`) rather than top-level append-only P/A/B/C/D bands.
