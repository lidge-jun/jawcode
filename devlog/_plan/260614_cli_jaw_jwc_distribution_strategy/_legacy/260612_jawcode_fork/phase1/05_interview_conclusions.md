# 05 — 인터뷰 결론: 확정 결정 전집 + 개념 phase 구조

> 260612 02:34–02:53 인터뷰(5라운드)의 최종 산출물. P 단계 계획의 입력.
> 근거 추적은 [04_interview_log.md](./04_interview_log.md).

## 확정 결정

| # | 결정 | 내용 |
|---|------|------|
| D1 | **2-제품 구조** | jwc 런타임 코어를 분리해 cli-jaw 서버가 직접 품는다(상주, spawn 없음). jaw chat이 그 위에서 돈다. jwc TUI는 같은 코어를 쓰는 독립 개발 도구. "분리됐지만 통합" |
| D2 | **우선순위: M1 → M2** | M1 = jwc 단독 완성(jaw 워크플로우 이식)이 cli-jaw 임베딩(M2)보다 선행 |
| D3 | **워크플로 매핑 병합** | deep-interview↔I, ralplan↔P+A, ultragoal↔goal, team↔dispatch (코드 검증: 개념 중복 ~80%). 양쪽 장점을 합쳐 jwc에 반영, 개선안은 devlog 기록 |
| D4 | **리네이밍 (a) 표면** | bin `jwc`, 브랜딩/문서/스킬명만 jaw. `.gjc/` 상태 경로·`@gajae-code/*` 패키지명 유지. 업스트림 리베이스 용이성 보존(실질 분기는 수용) |
| D5 | **스킬 정본 = `~/.cli-jaw/skills`** | 디스커버리 3계층: jwc 임베디드 + 프로젝트 루트 + `~/.cli-jaw/skills`, 충돌 시 `~/.cli-jaw/skills` 우선. 포크 직접 수정으로 구현 허용 |
| D6 | **세션 비공유** | TUI↔Web 세션 분리. 공유 대상은 스킬+OAuth뿐. 임베디드 런타임 세션 정본 = jaw.db, jwc 세션은 자체 SQLite(FTS 기보유) |
| D7 | **인증: 로컬 토큰 시딩** | 기존 로그인(Keychain `Claude Code-credentials`, `.credentials.json` — cli-jaw `src/routes/quota.ts:145` 패턴)을 jwc AuthStorage에 시딩해 즉시 사용. OAuth 플로우는 옵션 유지. 공유는 `createAgentSession({authStorage})` 주입(sdk.ts:409) |
| D8 | **호스팅: Node 포팅 상주** (기존 확정) | 사이드카 기각. M2에서 Bun.* 셰임 + 트랜스파일 (bun:sqlite→better-sqlite3 포함) |
| D9 | **검색 연동은 후순위** | jwc 세션은 현 federation에서 비가시(스키마 불일치). 목표 상태 = federation에 gjc `history` 스키마 어댑터(b안). M1/M2 done에 미포함. cli-jaw messages LIKE→FTS5 전환은 별도 프로젝트로 분리 |
| D10 | **명령어 체계 cli-jaw 통일** (260612 04:54, R14) | jwc의 사용자-가시 명령 표면(서브커맨드·슬래시커맨드)은 cli-jaw 어휘·시맨틱을 따른다: `jwc orchestrate I\|P\|A\|B\|C\|D`(PABCD), `jwc goal set/update/...`, `jwc memory search/save/...`. 엔진은 gjc 네이티브(ralplan/ultragoal/memories)를 재사용하되 표면은 cli-jaw와 1:1 — 사용자·스킬·에이전트가 두 도구 사이에서 하나의 명령 어휘만 학습. PABCD는 jwc 일상 사용의 핵심 (사용자: "평소에도 그걸 쓴다") |

## 마일스톤 / 개념 phase 구조

### M1 — jwc 단독 완성 (jaw 워크플로우 이식)

| 항목 | 내용 | 병합 소재 |
|------|------|----------|
| M1-1 | gjc→jaw 표면 리네이밍 | bin/브랜딩/문서/스킬명 |
| M1-2 | Interview 병합 | gjc에서: 수학적 ambiguity 스코어 표시, Round 0 topology gate, spec 핸드오프 파일, 1질문/턴 ←→ jaw에서: 4차원 트래커, negativity bias, known/unknown 누적 |
| M1-3 | Plan 병합 | gjc에서: Planner/Architect/Critic 합의 루프, pending-approval 아티팩트, receipt-only 응답, --deliberate 프리모템 ←→ jaw에서: P/A 분리 게이트, 사용자 승인 체크포인트 |
| M1-4 | 메모리 통합 | jwc memory 폴더 (확장 가능 규약, 세부는 P에서) |
| M1-5 | PABCD 범용 커맨드 | 일반 컨텍스트의 jwc에서 PABCD 진입 커맨드 설계 |

### M2 — cli-jaw 임베딩 (done 기준 3항목)

1. jaw chat이 jwc-runtime 위에서 spawn 없이 대화+도구 실행 (세션 jaw.db)
2. 기존 로컬 로그인 토큰 그대로 동작 (시딩 브리지)
3. `~/.cli-jaw/skills` 주입 동작

선행 기술 작업: Node 포팅(D8). 후순위: federation 검색 어댑터(D9), TUI↔서버 연동 없음(D6으로 기각).

## 03_roadmap_phases.md 와의 관계

03의 Phase 2(Node 포팅)~6은 M2 영역으로 밀림. M1이 그 앞에 삽입된다.
P 단계에서 03을 이 구조로 개정하거나 06_*로 대체 로드맵을 작성할 것.

## 미해결 (P 단계로 이월)

- M1 각 항목의 testable 완료 기준 세부화
- jwc memory 폴더 시맨틱 (미니 cli-jaw memory vs 규약만 예약)
- 도구 패리티 범위 (벤더 CLI 고유 기능 충당 범위)
- 업스트림 리베이스 주기/정책 (표면 리네이밍 유지 보수 규칙)
