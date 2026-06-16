# 043 — elicitation 질문 스키마 계약 (jwc ask ↔ cli-jaw 펜스)

> 상태: ✅ 040 밴드 산출물 (D040-8). 소비자: M2 130 밴드(cli-jaw 측 주입)에서
> jaw-interview ↔ `orchestrate I` 텍스트/렌더 동기화 시 이 계약이 입력이다.
> jwc 측 정본: `packages/coding-agent/src/tools/ask.ts` (zod `QuestionItem`/`QuestionMeta`)
> cli-jaw 측 정본: `public/js/features/elicitation-state.ts` (`NormalizedQuestion`)

## 1. 질문 필드 매핑

| 개념 | jwc ask 도구 (`QuestionItem`) | cli-jaw elicitation 펜스 | 호환 규칙 |
|------|------------------------------|--------------------------|----------|
| 질문 ID | `id: string` | `id` (fallback: `question_N`) | 동일 의미, 그대로 전달 |
| 질문 텍스트 | `question: string` (헤더 금지, 평문) | `question` \| `title` \| `prompt` | jwc→펜스 직렬화 시 `question` 키 사용 |
| 선택지 | `options: [{ label, description? }]` | `options: [{ id?, value?, label, description?, submitText? }]` | `label` 필수 공통. jwc `description` ↔ 펜스 `description` 1:1. 펜스 `value` 부재 시 `label`이 값 |
| 다중 선택 | `multi?: boolean` | `type: "multi_select"` (alias: `multi`/`checkbox`) | `multi: true` ↔ `type: multi_select`, false/부재 ↔ `single_select` |
| 추천 옵션 | `recommended?: number` (인덱스) | 없음 (라벨에 "(Recommended)" 표기 관행) | 펜스 직렬화 시 해당 옵션 라벨에 ` (Recommended)` 접미사 부여 |
| 조건 표시 | 없음 (TUI는 라운드당 일괄 표시) | `visibleWhen: { <priorId>: [<value>...] }` | jwc→펜스: 생성 안 함. 펜스→jwc: visibleWhen은 클라이언트 평가라 무시 가능 |
| 순위 선택 | 없음 | `type: "rank_priorities"` | jwc 미지원 — M2에서 펜스 수신 시 multi로 강등 |
| 자유 입력 | 항상 "Other (type your own)" 자동 노출 | UI "Other" 상당 (구현체 의존) | 의미 동일, 직렬화 불필요 |

## 2. 라운드 메타 (`QuestionMeta`) — jwc 고유, 펜스로는 표시 텍스트화

jaw-interview의 라운드 헤더는 텍스트 프로토콜이 아니라 ask `meta` 구조 필드다 (042 D041-A):

```ts
meta?: {
  kind?: "round" | "topology" | "progress";
  round?: number;          // 라운드 번호 (0 = topology gate)
  component?: string;      // 타겟 컴포넌트
  targeting?: string;      // 최약 차원
  whyNow?: string;         // 타겟팅 근거 1문장
  ambiguity?: number;      // 최근 외부 감사 점수 (0-1)
  mode?: string;           // 챌린지 모드 (contrarian/simplifier/ontologist)
}
```

- TUI: `src/jaw-interview/structured-renderer.ts`가 meta에서 헤더 렌더 (언어 앵커 없음)
- unattended/RPC: `jaw-interview-gate.ts` `questionToGate`가 meta를 `stage_state`로 패스스루,
  meta 부재 시에만 레거시 텍스트 정규식 폴백
- cli-jaw 펜스 직렬화 시: meta는 펜스 JSON 밖의 **응답 본문 텍스트**(헤더 문장)로 풀어쓴다 —
  cli-jaw 펜스 스키마에 meta 필드를 추가하지 않는다 (스키마 드리프트 방지, R4)

## 3. 답변 회수 매핑

| 채널 | 형식 |
|------|------|
| jwc TUI | ask 도구 결과 (`QuestionResult{ selectedOptions, customInput? }`) 동기 반환 |
| jwc unattended | workflow_gate answer `{ selected: string[], other?: boolean, custom?: string }` (`JawInterviewGateAnswer`) |
| cli-jaw 웹 | `구조화 질문 응답:` 접두 텍스트 메시지 — `- <질문>: <라벨> (값: <value>)` 라인 목록 |

M2 130 어댑터는 cli-jaw 응답 텍스트를 `JawInterviewGateAnswer`로 변환한다:
선택 라벨 → `selected[]`, "Other"/자유입력 → `other: true` + `custom`.

## 4. 버전·드리프트 가드

- 본 계약 위반은 jwc 측 `test/jaw-interview-workflow-gates.test.ts`(meta passthrough)와
  `test/tools/ask.test.ts`(meta 계약 블록)가 잡는다.
- cli-jaw 측 스키마 변경 시 이 문서를 갱신하고 M2 130 어댑터 테스트를 추가한다.
- 펜스는 final-answer-only — 스트리밍 중 inert 코드블록 (cli-jaw 계약 유지).
