# 041 — jaw-interview 병합 플랜 (간략 P)

> 상태: 🟡 인터뷰 확정 → 간략 플랜 (정식 P/A 전). 근거: [040 MOC](./040_moc_interview_merge.md),
> 7라운드 인터뷰 (260612 08:09–08:37, cli-jaw orchestrate I).
> 표기: D040-N = 이번 인터뷰 확정 결정.

## 인터뷰 확정 결정 (D040-1 ~ 10)

| # | 결정 | 내용 |
|---|------|------|
| D040-1 | 등록 방식 | deep-interview **직접 개조(rename)** → jaw-interview. 번들 가드는 이름 교체, 번들 4종 수 유지 |
| D040-2 | 질문 수 | 라운드당 **1–3개 허용**. Execution_Policy "Ask ONE question at a time -- never batch" 문구 개정 |
| D040-3 | TUI 전달 구조 | **elicitation JSON 펜스를 공용 질문 모델**로 TUI 렌더러 신규 작성. 영어 정규식 텍스트 프로토콜(render-middleware) 폐기 |
| D040-4 | 감사 구조 | **이중 감사** — 내부 감사(jaw 4차원 트래커 + negativity bias, 매 라운드 자기평가)가 라운드 운영, 외부 감사(gjc 수식 스코어링 호출)가 게이트 판정 |
| D040-5 | ontology 배치 | **내부 감사 표시 전용** — 기존 stability_ratio를 ontology 점수로 매핑 표기. 외부 감사 수식·게이트는 3차원(goal/constraints/criteria+brownfield context) 유지. R8 Ontologist 챌린지 안전망 유지 |
| D040-6 | 외부 감사 빈도 | **체크포인트만** — 내부 감사가 게이트 근접 판단 시 + Phase 4 spec 결정화 직전. 매 라운드 호출 폐지 (포크 스냅샷 재인제스트 비용·지연 회피) |
| D040-7 | 임계값 | **0.05 유지 + R1부터 명시 스킵 허용** — 기존 R3+ 조기탈출(enough/let's go)을 R1+로 완화, `BELOW_THRESHOLD_EARLY_EXIT` spec 상태 재사용 |
| D040-8 | cli-jaw 호환 | **펜스 스키마 계약 고정만 040에서** — elicitation 펜스·트래커 블록 포맷을 cli-jaw 웹 스키마와 호환으로 고정 + 계약 문서화. 런타임 연결(헤드리스 게이트, orchestrate I 동기화)은 M2 130 위임 |
| D040-9 | spec 경로 | `.gjc/specs/jaw-interview-{slug}.md`로 rename 정합. SKILL.md Phase 1의 `.gjc/specs/deep-*.md` glob 동반 수정 |
| D040-10 | 트래커 표기 | 0~1 원점수 + low~max 5단계 양자화 병기 |

배경 결정(인터뷰 중 코드 확인으로 정착):

- gjc=외부 감사 / jaw=내부 감사 프레이밍 (사용자 제시, 코드 검증)
- 컨텍스트 포크는 캐시 인지 설계 존재: StablePrefix export/import(시스템+툴 바이트 동결),
  `cacheIdentity`→자식 providerSessionId, append-only log. 한계: 메시지 시드는 새니타이즈
  사본이라 포크 시점 스냅샷 재인제스트 1회 발생 → D040-6의 근거
- 사용자 실사용 페인: 선택지 elicitation 실패(영어 정규식 앵커 × 한국어 추종 충돌, 비대화형
  ask 차단) + 라운드 지연(매 라운드 스코어링 × 임계값 0.05 × 1질문) → D040-2/3/6/7의 근거

## 성공 기준 (testable)

1. 모호 요청 → 게이트 통과 전 실행 거부 + 차원 점수 라운드별 표시 (MOC ①)
2. spec 핸드오프 파일이 050 플랜 입력으로 소비되는 e2e (MOC ②)
3. 헤징 답변("아마/maybe") 시 해당 차원 점수 강등 테스트 (MOC ③)
4. 한국어 세션 TUI에서 선택지가 elicitation 렌더러로 선택 가능 (신규)
5. R1 명시 스킵 → `BELOW_THRESHOLD_EARLY_EXIT` spec 산출 (신규)
6. 외부 감사 호출이 체크포인트 시점에만 발생 (신규)

## 간략 플랜 — 수정 표면 (diff 레벨은 정식 P에서)

| 표면 | 작업 |
|------|------|
| `packages/coding-agent/src/defaults/gjc/skills/deep-interview/` | → `jaw-interview/`로 rename. SKILL.md 개정: D040-2(1–3질문), D040-4/5(이중 감사·ontology 매핑), D040-6(체크포인트 스코어링), D040-7(R1+ 스킵), D040-9(spec 경로+glob), D040-10(병기 표기), 질문 출력을 elicitation 펜스로 |
| `packages/coding-agent/src/commands/deep-interview.ts` | rename + 표면 어휘 jaw화 |
| `packages/coding-agent/src/gjc-runtime/deep-interview-runtime.ts` | rename + 상태 키/경로 정합 |
| `packages/coding-agent/src/deep-interview/render-middleware.ts` | 정규식 파서 폐기 → elicitation 펜스 TUI 렌더러로 대체 (신규 모듈) |
| `packages/coding-agent/src/tools/ask.ts` | deep-interview 전용 훅 3개(`formatDeepInterviewSelectorPrompt` 등) 처리 — 미결 D041-A에 종속 |
| `scripts/rebrand-inventory.ts` | `expectedBundledWorkflowSkills`: `deep-interview` → `jaw-interview` |
| `packages/coding-agent/test/deep-interview-*.test.ts` 3종 + `test/gjc-runtime/deep-interview-runtime.test.ts` + `test/modes/components/deep-interview-render-middleware.test.ts` | rename + 성공 기준 4/5/6 신규 테스트 추가 |
| 계약 문서 (신규) | elicitation 펜스 스키마 계약 — cli-jaw `public/js/features/elicitation-state.ts` 스키마와 필드 호환 명세 (M2 130 입력) |

### 감사 발견 누락 표면 (260612 08:42 서브에이전트 독립 감사, VERDICT: NEEDS_FIX → 반영)

rename(D040-1)이 닿는 추가 파일 — 정식 P의 diff 목록에 필수 포함:

| 파일 | 역할 | 결합도 |
|------|------|--------|
| `packages/coding-agent/src/modes/shared/agent-wire/deep-interview-gate.ts` | ask 질문→machine-addressable workflow_gate 이벤트 변환 (unattended/RPC 경로, issue #316) | **중** — 미동기 시 비대화형 인터뷰 파손 |
| `packages/coding-agent/src/skill-state/deep-interview-mutation-guard.ts` | 인터뷰 phase 중 mutation 도구 차단 + 하드코딩 차단 메시지 | 중 |
| `packages/coding-agent/src/config/settings-schema.ts:378` | `gjc.deepInterview.ambiguityThreshold` 설정 키 (기본 0.05의 실제 정의처) | 저 — 키 어휘 미결(D041-D) |
| `packages/coding-agent/src/defaults/gjc-defaults.ts` | 스킬+fragment 번들 등록(DEFAULT_GJC_DEFINITION_NAMES) | 저 |
| `packages/coding-agent/src/gjc-runtime/state-schema.ts:17` | CANONICAL_GJC_WORKFLOW_SKILLS에 "deep-interview" 포함 | 저 |
| `packages/coding-agent/src/hooks/skill-state.ts:362,459` | phase 게이트의 스킬 활성화 체크 | 저 |
| `packages/coding-agent/src/modes/shared/agent-wire/protocol.ts` | wire 프로토콜의 deep-interview 참조 | 저 |
| `packages/coding-agent/src/gjc-runtime/workflow-manifest.ts` | 워크플로 매니페스트 등록 | 저 |
| `packages/coding-agent/test/fixtures/gjc-state/v1,v2/deep-interview-*.json` | 상태 스키마 픽스처 — D040-4/5로 state 확장 시 재생성 필요 | 중 |

## 리스크

- **R1 (ask 관계 미결)**: ask는 범용 도구 — deep-interview 훅만 걷어내고 범용 selector는
  보존해야 다른 스킬이 안 깨짐. 펜스 렌더러가 ask를 대체하는지/ask가 펜스를 소비하는지 미결(D041-A)
- **R2 (리베이스 충돌)**: rename은 업스트림 diff 면적 최대 옵션 — 수용 결정됨. 충돌 면적을
  본 문서에 기록하며 추적 (횡단 원칙 1)
- **R3 (게이트 신뢰성)**: 외부 감사가 체크포인트로 줄면, 내부 감사 자기점수 인플레 시 게이트
  호출 자체가 누락될 위험 → "스킵/결정화 직전 외부 감사 강제" 규칙 필요(성공 기준 6과 연동)
- **R4 (스키마 드리프트)**: cli-jaw 쪽 펜스 스키마 변경 시 계약 파손 → 계약 문서 + 스냅샷
  테스트로 고정
- **R5 (언어 충돌, 해소됨)**: JSON 펜스는 언어 무관 — 기존 영어 정규식 앵커 문제 원천 제거
- **R6 (감사 추가, 高)**: `deep-interview-gate.ts`의 unattended/RPC 게이트가 ask 도구에 결합 —
  D041-A에서 ask를 우회하면 게이트 경로 재작성 필요. ask 유지 쪽이 게이트 무손상
- **R7 (감사 추가)**: 펜스 파서가 jawcode에 부재 — D040-3은 기존 정규식 "대체"가 아니라
  **신규 파서 작성** + 기존 경로 제거의 2단계 작업 (난이도 불변, 프레이밍 정정)

## 세부 결정 (D041-A ~ D, 260612 08:48 확정)

- **D041-A [확정]**: **ask 유지 + 입력 스키마를 elicitation 스키마로 통일** — ask 도구 입력을
  elicitation 스키마(id/type/options/visibleWhen)로 확장하고 TUI 렌더러가 이를 그림.
  unattended/RPC 게이트(`deep-interview-gate.ts`) 경로 무손상(R6 해소). 펜스는 비대화형·웹
  출력용 동일 스키마
- **D041-B [확정]**: 체크포인트 스코어링 호출 간 **cacheIdentity 고정** — 시드가 append-only로
  자라는 동안 프리픽스 캐시 연쇄 적중
- **D041-C [확정]**: negativity bias의 Execution_Policy 삽입 문구는 **정식 P에서 초안 제시 후 확인**
- **D041-D [확정]**: settings 키 = **`jwc.interview.ambiguityThreshold`**, 사용자 진입 명령 =
  **`/interview`**, 기존 `/deepinterview`(`/skill:deep-interview`) 계열은 **호환 alias 유지**.
  설정 우선순위(프로젝트>유저>기본)는 그대로, 구 키 `gjc.deepInterview.*`는 읽기 fallback 검토(P)

> 인터뷰 상태: ✅ 완결 (7라운드 + 감사 1회 + 세부결정 라운드). 다음 = 정식 P
> (`cli-jaw orchestrate P`)에서 본 문서를 diff 레벨로 확장.
