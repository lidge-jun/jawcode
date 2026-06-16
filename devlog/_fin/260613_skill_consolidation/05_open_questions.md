# 미결정 사항 + 확정 결정 로그

> 260613 유저 인터뷰 기반

## 확정된 결정

| # | 결정 | 출처 |
|---|---|---|
| D1 | ultragoal → goal (사용자 대면), 엔진 내부도 파일/타입 리네임 | 유저 |
| D2 | ralplan → orchestrate p (스킬 표면 제거), CLI+런타임 유지 | 유저 |
| D3 | I/P 진입은 유저가 판단. I는 유저 인터랙티브. goal은 I 안 탐 | 유저 |
| D4 | P→A: plan 문서화 + 유저에게 설명 후 유저 확인 | 유저 |
| D5 | B = self-verify (구현+자체검증), C = cross-verify (교차검증) | 유저 |
| D6 | D→IDLE: standalone PABCD는 여기서 끝 | 유저 |
| D7 | goal = PABCD를 여러 사이클 돌릴 수 있게 하는 래퍼 | 유저 |
| D8 | goal→PABCD는 프로그래밍적 디스패처 아님. 에이전트가 IDLE에서 goal 보고 P 재진입 판단 | 유저 |
| D9 | standalone PABCD = HITL, goal-wrapped = HOTL. goal이 게이트를 자동 통과 | 유저 |
| D10 | goal 모드에서 프롬프트가 "HOTL이므로 너가 알아서 pabcd 넘겨라" 지시 | 유저 |
| D11 | /interview, /goal, /goalplan 슬래시 커맨드 우선순위 | 유저 |
| D12 | goal HOTL: 모든 게이트 건너뜀, 프롬프트 가이드로 자동 진행 (이미 jawcode에 구현) | 유저 |
| D13 | A=계획검증, C=구현검증(의도대로 패치? 사이드이펙트?), 서브에이전트는 에이전트 동적 판단 | 유저 |
| D14 | /goal=인간이 목표 설정, /goalplan=에이전트가 맥락에서 목표 파악+자율 실행 | 유저 |
| D15 | ask tool JSON vs elicitation fence: 별도 트랙 (현재 플랜 밖) | 유저 |
| D16 | /goalplan 맥락: hint→goals.json→continuation prompt→에이전트가 대화+hint+repo로 goal 설정 | 리서치+유저 |
| D17 | goal HOTL 중 모호함: best effort P 진행. 불가능→pause. 방향전환→I 아닌 유저에게 직접 질문 | 유저 |
| D18 | goal 안에서 I 절대 진입 안 함. 방향성 문제면 pause 후 유저에게 물어봄 | 유저 |

## 인터뷰 ask 포맷 (D12 후보)

현재 jawcode: 에이전트가 `ask` tool에 full JSON 구성 (heavy)
cli-jaw: 에이전트가 자연어 + ` ```elicitation` 펜스 (light)

유저 의견: "cli-jaw 방식이 ask 형식에 더 적합할 것 같다"
→ **jawcode interview를 elicitation fence 방식으로 전환?**

변경 시 영향:
- `ask` tool 제거 or 축소
- jaw-interview-gate.ts (gate mapping) 수정
- structured-renderer.ts 수정
- SKILL.md의 ask JSON 예시 전부 교체
- TUI selector가 elicitation fence 파싱하도록

## 미결정 질문

### Q1. 인터뷰 ask 포맷 — ✅ 확정: ask tool + meta 유지
meta가 3개 소비자 (TUI 렌더러, 무인 게이트 브로커, 인터뷰 상태머신)에 타입 안전한 데이터 전달.
AskUserQuestion은 텍스트만 — round/ambiguity/topology/challenge_mode 운반 불가.
meta 제거 시 영어 regex 파싱으로 후퇴 (언어 안전성 파괴).
→ **현행 유지. 전환 불필요.**

## 확정된 질문

### Q2. goal HOTL 자동 진행 범위 — ✅ 확정
**모든 게이트** 건너뜀 (P/A/B 전부). goal checkpoint로 대체.
구현: 이미 jawcode에 있음 (dev-pabcd Rule 4 + `#scheduleGoalContinuation()`).

### Q3. A-phase / C-phase 서브에이전트 — ✅ 확정
**에이전트가 동적으로 판단** — 프롬프트 주입으로. 고정 구성 아님.
- A = **계획 검증**. 이 계획이 좋은가?
- C = **구현 검증**. 계획대로 구현됐는가? 의도대로 패치됐는가? 사이드 이펙트 없는가?
  goal objective를 기준으로 재검증.
이것도 cli-jaw에 이미 있음.

### Q4. (Q3에 통합)

### Q5. goal done / 계속 진행 — ✅ 확정
goal이 설정되면 **"계속 진행하라"는 가이드가 주입** → 그 시점부터 HOTL.
에이전트가 goal objective 대비 현재 상태를 보고 판단.
D→IDLE 시 goal active면 → 아직 할 게 남았으면 P 재진입 (에이전트 판단).

### Q6. /goal vs /goalplan — ✅ 확정
| 커맨드 | 누가 목표 설정 | 흐름 |
|---|---|---|
| `/goal <objective>` | **인간** | 인간이 목표 명시 → HOTL 시작 |
| `/goalplan` | **에이전트** | 인간이 프롬프팅 안 함 → 에이전트가 대화 맥락에서 목표 파악 → `/goal refine` → HOTL 시작 |

`/goalplan`이 존재하는 이유: `/goal`로 박으면 인간이 직접 objective를 써야 함.
하지만 인간이 "알아서 해줘" 하고 싶을 때 → `/goalplan` → 에이전트가 맥락 분석해서 목표 설정 → 자율 실행.
