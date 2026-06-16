# 060 MOC — 워크플로 병합 ③: Goal

> 📐 상세 설계: [051_design_command_port.md](./051_design_command_port.md) §2 — cli-jaw goal 동사 셋 → ultragoal goal 도구/레저 매핑.

> 상태: 🟢 **구현 완료 (M1-M3·M5-M7, 커밋 0207d326 260612 15:3x)** — `jwc goal` 10동사+별칭 동작, 테스트 10 pass + 엔진 79 무회귀. 잔여: M4(TUI slash 별칭 — interactive-mode.ts 병렬 작업 종료 후) — [061_design_goal_merge.md](./061_design_goal_merge.md) (ultragoal 실사 + 어휘 매핑 + M 모듈, 260612 11:40·갱신 13:38)
> + [062_schema_cli_jaw_goal.md](./062_schema_cli_jaw_goal.md) (cli-jaw goal 워크플로우 전수 — GoalState/evidence 번들 3종/2-tap 게이트/continuation 프롬프트 8섹션/goal-run, 260612 13:10·갱신 13:38).
> 결정 근거: D3 [확정] ultragoal ↔ jaw goal 매핑 + 인터뷰 260612 01:36 전항 확정.

## 코드 사실 (조사 완료)

- gjc ultragoal: `.gjc/ultragoal/{brief.md, goals.json, ledger.jsonl}` — repo-native 멀티골,
  통합 `goal` 도구(op: get/create/complete/resume/drop), G001/G002 스토리 레저, 체크포인트+steering 감사 이벤트
- `prompts/goals/goal-continuation.md` + `goal-mode-active.md` — **jaw의 [goal-continuation] 매턴 주입과 동일 패턴이 이미 존재**
- jaw goal: `jwc goal set/refine/plan/status/update/done/cancel/pause/resume/history` — cli-jaw goal 명령과 동형 어휘·시맨틱 (evidence 의무, pause --agent --audit 게이트 포함)

## 스코프

1. 어휘/계약 매핑 표 작성: ultragoal brief↔objective, goals.json↔checkpoint 목록, ledger↔goal history
2. jaw 강점 이식: [확정] ① checkpoint에 evidence 의무화 ② AI 자발 정지 시 독립 감사(pause --agent --audit 상당)
   ③ done은 명시 완료 감사 후에만 — ledger 이벤트 타입으로 추가
3. gjc 강점 유지: repo-native 아티팩트(레저 감사 추적), 통합 goal 도구 1개로 조작
4. goal-continuation 프롬프트에 jaw 규칙(자율 진행/권한/증거 번들) 어휘 통일 (020 연계)

## [확정 D10] 명령 표면 — cli-jaw 통일 (R14, 인터뷰 260612 01:36)

- 엔진은 gjc goal 도구+레저 유지, **사용자 표면은 `jwc goal set/refine/plan/status/update/done/cancel/pause/resume/history`**
- 별칭: `show`→`status`, `drop`→`cancel` — TUI `/goal` slash(`builtin-registry.ts:287-307`)와 CLI가 **단일 엔진(`gjc-runtime/goal-runtime.ts`) 공유**, 별칭으로 양쪽 어휘 모두 호환 (061 §2·§7)
- evidence 의무, pause `--agent --audit` 2-tap 게이트, done 완료 감사 순서 포함

## [확정] 멀티골·세션 분리 (인터뷰 260612 01:36)

- 멀티골 유지, `goal status`는 active 1개 기본 뷰 — `clear`/`reset` 미노출
- 단독 jwc goal과 cli-jaw 인스턴스 goal은 **별개** (D6 세션 비공유) — M2에서도 통합하지 않음

## [확정] M1 스코프 제외 (인터뷰 260612 01:36)

- `goal-run`/연속 시도 컨트롤러는 M1 제외 — `budget{maxTurns,maxMinutes}` 필드만 GoalState에 forward-compat 보존 (`maxDispatches` 제외)

## 완료 기준

- `jwc goal set → checkpoint(evidence) → done` 사이클이 jwc 단독에서 동작, ledger에 감사 이벤트 기록
- evidence 없는 checkpoint 거부 테스트
- AI 자발 정지 시 감사 요약 없으면 거부 테스트
- `bun run check:ts` 및 기존 가드 테스트 green (`goal-tool.test.ts:229-254` 등)
