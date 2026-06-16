# 055 MOC — cli-jaw dev 스킬군 jwc 호환 (055–059 밴드)

> 상태: 🟢 설계 확정 (인터뷰 260612 01:36 — 열린 질문 0, 구현 착수 가능). 치환은 dev 군 우선·degraded 영어 고정 [확정], P10(워크플로 단계·role 스킬 주입)이 057 §6으로 정식 편입.
> 입력: 사용자 "dev 스킬들도 jwc와 호환 — 55부터 60 전까지" (260612 11:57).
> 전수 분석: Backend 직원 (260612 12:05, /Users/jun/.cli-jaw/skills/ 12종 + jwc 로딩 코드).
> 연계: [085.5](./085.5_plan_prompt_rebrand.md)는 02:04 개정으로 소스 하드 수정 — 런타임 치환(buildSkillPromptMessage 분기)은 jwc 비소유 `~/.cli-jaw/skills` 전용으로 본 밴드에만 잔존.

## 배경 — jwc는 cli-jaw 스킬을 이미 로드한다

jaw 브랜드에서 `~/.cli-jaw/skills/`가 native user root를 **대체**한다(`extensibility/skills.ts:124-145`, provider `cli-jaw` priority 110 — `discovery/cli-jaw.ts:21-35`). 단 native 충돌 2종(`memory`, `dev-pabcd`)은 고정 제외(`skills.ts:160-163`). 문제: 로드되는 스킬들이 **cli-jaw 서버 어휘**(orchestrate 대문자, dispatch, 직원, bgtask, worklog)를 본문에 담고 있어 jwc 단독 실행(서버·직원 없음)에서 에이전트를 오도한다.

## 전수 분석 결과 (12종)

| 분류 | 스킬 | 비고 |
|------|------|------|
| **그대로 호환 (9)** | dev-backend, dev-frontend, dev-testing, dev-architecture, dev-debugging, dev-security, dev-data, dev-uiux-design, dev-scaffolding | cli-jaw 참조 0건 — references/ 하위까지 스캔, "browser/memory" 매치는 전부 기술 용어(HTTP·힙) |
| **어휘 매핑 필요 (2)** | **dev** (핵심 — C5 `cli-jaw orchestrate I`, §0.3 task_tags, §0.4 모드, §3 bgtask, Boss/employee 어휘), dev-code-reviewer (경미 — Sub-Agent Review Mode) | [056](./056_map_cli_jaw_to_jwc.md) 치환 테이블 |
| **로드 제외 (2)** | dev-pabcd, memory | 제외 유지 [확정 — 아래] |

## 핵심 결정

1. **dev-pabcd 제외 유지** [확정] — jwc orchestrate(050)가 네이티브로 동일 역할 소유. 수용하려면 서버 전용 구간(`/api/orchestrate/dispatch`, bgtask, worklog Plan auto-inject, `--mutable`)이 치환 불가라 본문 fork가 필요 → 이중 진실. 050 stage 프롬프트가 dev-pabcd의 자리를 채운다. 단 **dev 스킬이 dev-pabcd를 참조**하므로 056 치환 테이블이 그 참조를 jwc 등가물로 돌려야 함.
2. **치환은 런타임 레이어** [확정] — 스킬 소스(`~/.cli-jaw/skills/`)는 cli-jaw 인스턴스 소유물이라 jwc가 수정하면 안 됨. 085.5의 `buildSkillPromptMessage()` 치환 지점(P1)에 **provider=`cli-jaw` 분기 + dev 어휘 맵**을 추가.
3. **서버 의존 기능은 명시적 degraded 안내** [확정] — bgtask·dispatch API·`--mutable`·task_tags는 치환 불가 → "[jwc: unavailable — …]" 형태로 본문 내 안내 치환 (조용한 삭제 금지, fail-fast 원칙).

## 문서 구성

| 문서 | 내용 |
|------|------|
| [056_map_cli_jaw_to_jwc.md](./056_map_cli_jaw_to_jwc.md) | 명령·어휘·시맨틱 매핑 전수 표 + dev/dev-code-reviewer 치환 테이블 + degraded 항목 |
| [057_plan_skill_compat_patch.md](./057_plan_skill_compat_patch.md) | 로딩 파이프라인 패치 지점(P1–P9)·구현 diff·테스트·게이트 |
| [058_schema_cli_jaw_workflow_runtime.md](./058_schema_cli_jaw_workflow_runtime.md) | cli-jaw 워크플로우 런타임 스키마 전수 — IPABCD 상태기계·worklog·dispatch plan 주입·task_tags/role 스킬 맵·주입 파이프라인. P10(태그/role 맵 이식) 후보 도출 |
| [059_schema_cli_jaw_runtime_contracts.md](./059_schema_cli_jaw_runtime_contracts.md) | 부속 계약 3종 — bgtask(degraded 확정)·C0-C5/DEV-ESCALATE-01(이식 후보 P11)·Interview 증거 5-튜플(041 정렬) |

## 완료 기준

- jwc 단독(jwc-only PATH)에서 `/skill:dev` 주입 본문에 `cli-jaw orchestrate I`·bgtask 지시가 **그대로 노출되지 않음** — jwc 등가물 또는 degraded 안내로 치환
- gjc 브랜드: cli-jaw 스킬 자체가 invisible(기존 보장, `skills-discovery-jaw.test.ts:79-89`) — 회귀 0
- cli-jaw 인스턴스에서 같은 스킬을 읽을 때(원래 용도) 소스 무변경 — 치환은 jwc 런타임에서만
- 056 치환 테이블 단위 테스트 + 057 통합 테스트 green
