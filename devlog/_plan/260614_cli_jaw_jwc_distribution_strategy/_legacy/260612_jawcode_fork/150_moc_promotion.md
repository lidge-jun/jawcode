# 150 MOC — 메인 런타임 승격 (기본 cli = jwc)

> 상태: ⬜. M2 마지막 밴드. 구 03 Phase 6 승계.
> **260613 플립 기준 재구체화 (gjc→jwc flip 반영)** — 승격은 이제 "외부 표면의 플립 연기
> 명단"과 한 몸이다: 승격 전에 연기 항목 중 사용자-가시 계약(bins·CI artifact·MCP 이름)을
> 정리해야 일관된 jwc 아이덴티티로 메인이 된다.

## 스코프 (구체화)

| 단계 | 내용 | 앵커/근거 | AC |
|---|---|---|---|
| P1 | **도구 패리티 갭 표** 작성: 벤더 CLI 고유 기능(웹검색, computer-use, vision) vs jwc tools + cli-jaw `lib/mcp` 충당 범위. **browser 통합 확정 (260613)**: `cli-jaw browser` CDP → jwc `browser` tool 라우팅, browse skill 정본. search/web-ai도 jwc hidden skill 포팅. | jwc tools 인벤토리 `packages/coding-agent/src/tools/` · MLB 20-80 등급 표 (하우스 규칙) | 갭 표 승인, "차단급 갭 0건" 판정 |
| P2 | 기본값 전환: 신규 세션 기본 cli=`jwc`, 벤더 CLI(claude/codex/gemini)는 fallback 체인 강등 | cli-jaw `resolveMainCli()` (main-session.ts:36 — 110 §코드 사실) | 신규 세션 기본 jwc |
| P3 | 마이그레이션: 기존 인스턴스 settings.json의 cli 값 — [기본값] 기존 값 존중, 신규만 jwc | cli-jaw settings | 기존 인스턴스 무회귀 |
| P4 | 회귀 스위트: AGY/spawn 계열 + 110–130 e2e를 승격 게이트로 | 110 §완료 기준 · 130 done 3항목 | 전 게이트 green |
| P5 | OAuth ToS 그레이존 재평가 ([phase1/090_moc_auth_release_gate.md](./phase1/090_moc_auth_release_gate.md) 이월) — 메인 승격으로 노출 증가 리스크 문서화 | 090 | 리스크 문서 갱신 |
| P6 | **플립 연기 명단 정리 (승격 전제, 260613 신설)** — 하단 표 | [260613_gjc_flip/05](../../_fin/260613_gjc_flip/05_plan_flip.md) §연기 | 외부 표면 jwc 일관성 |

## P6 — 플립 연기 항목의 승격 게이트 매핑 (260613 신설)

| 연기 항목 | 승격 시 처리 | 난이도 |
|---|---|---|
| bins `gjc`/`gjc-stats` (`packages/coding-agent/package.json:31`) | 승격 릴리스에서 제거 또는 deprecation 경고 셸 — `rebrand-inventory.ts` `expectedCliBins` 동시 갱신 | 소 |
| CI release artifact `gjc-<os>-<arch>` + job `gjc-state-gates` | artifact명 `jwc-*` 전환 + 브랜치 보호 required status 갱신 (GitHub 설정 동반) | 소~중 (외부 설정) |
| coordinator MCP `gjc_coordinator_*`·hermes managed-by | `migrateHermesSetupOnce()` 설계 (03_analysis_persistence §6) 구현 후 전환 | 중 |
| ENGINE_NAME="gjc"/이중 브랜드 | 승격과 독립 — 브랜드 은퇴는 별도 제품 결정 (유지해도 승격 무방) | — |
| hindsight 뱅크 "gjc" | 데이터 이전 도구 제공 전 유지 — 승격 비차단 | — |
| GJC_* env 문자열 | `$resolveEnv` 미러로 JWC_* 이미 수용 — 승격 비차단, spawn 사이트 양측 설정은 후속 | — |

## [기본값] 결정

- 승격 조건: 130 done 3항목 + 140 검색 어댑터 + 패리티 갭 표 "차단급 갭 0건" + **P6 소·중 항목 완료**
- 롤백 스위치: settings 한 줄로 기존 spawn 경로 복귀 가능하게 유지 (한 릴리스 동안)

## 완료 기준

- 신규 세션이 기본 jwc로 생성, Web/Telegram/Discord 전 채널 스모크
- 회귀 스위트 통과 + 패리티 갭 표 승인 + P6 표 소·중 항목 처리
- 롤백 스위치 동작 검증

## 열린 질문 [확정 대기]

- 벤더 CLI fallback의 유지 기한 (영구 공존 vs 단계적 제거)
- heartbeat/goal/orchestrate 등 모든 서버 경로의 jwc 라우팅 전수 검사 범위
- P6의 CI artifact 전환 시점: 승격 릴리스 동시 vs 선행 릴리스에서 이중 artifact (gjc+jwc 병행 배포)

## 세부 실행 문서 (260613 구체화)

- [150.1_parity_gap_matrix.md](./150.1_parity_gap_matrix.md) — 도구 35종·커맨드 20종 전수 기반 갭 표 골격 + P-2 전환·P-3 deferred 처리
- [150.2_plan_namespace_rename.md](./150.2_plan_namespace_rename.md) — @gajae-code→@jawcode + gjc 흔적 제거 (063.1 전략-A 연기분 실행, 명시 위치 포함)
- [../260614_deploy_fork_packaging_bridge/README.md](../260614_deploy_fork_packaging_bridge/README.md) — GitHub deploy · fork promotion · packaging 교차 블로커 분석. 특히 npm package target, postinstall, `gjc-state-gates`/artifact naming을 승격 전제와 연결.
