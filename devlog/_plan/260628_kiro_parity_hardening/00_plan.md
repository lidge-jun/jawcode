# 00 — Plan: Kiro provider wire-contract hardening

> 상태: [P] 작성 → [A] 감사 → [B] 구현 → [C] 검증 → [D] 완료
> Goal: aed2cc47-f1b — "pabcd로 제대로 kiro 도입 + 한바퀴 하드닝"
> Class: C3 (provider 공유 동작 / CodeWhisperer 와이어 계약). 단일 파일 표면이지만 wire contract라 PABCD 1 cycle.

## Part 1 — 쉬운 설명

Kiro(`kiro-streaming`) 프로바이더로 "tool use 10개 병렬"을 시키면
`Kiro HTTP 400 REQUEST_BODY_INVALID ("Improperly formed request")` 가 난다.

원인은 모델/서버가 아니라 **jawcode가 대화 history를 CodeWhisperer
`GenerateAssistantResponse` 와이어 포맷으로 변환하는 방식**이다.
CodeWhisperer는 (1) history가 user/assistant 엄격 교대여야 하고,
(2) 각 tool 결과(`toolResults`)는 그 결과를 만든 assistant 턴 바로 다음의
`userInputMessage`에 실려야 한다. 현재 `buildPayload`는 모든 tool 결과를 하나로
모아 마지막 메시지에 몰아넣고 assistant 연속 시 빈 `"(continue)"`를 끼워넣어
이 계약을 깬다. 긴 세션/병렬 호출에서 확실히 터진다.

이 작업은 `buildPayload`를 계약에 맞게 재작성하고, 부수적 결함(tool id 불일치,
system prompt 배열 join)도 함께 하드닝한 뒤, 와이어 불변식을 단위 테스트로
고정한다. 끝나면 사용자는 라이브 스모크(`tool use 10개`)만 돌리면 된다.

### 근거 (교차 확인)
- jawcode devlog `091_plan_provider_kiro.md` §② — "history는 user/assistant 엄격 교대,
  도구는 `userInputMessageContext.tools[].toolSpecification`" (kiro-gateway
  `converters_core.py` + kiro2api 교차검증).
- codex `003_tool-runtime/03_ki_tool.md` — Kiro CLI는 `task_executor.rs`로 tool 호출을
  네이티브 병렬 실행하고 한 응답에 여러 tool_use를 허용 → 서버는 병렬을 거부하지 않음.
  문제는 전적으로 요청 재구성 쪽.

## Part 2 — Diff 수준 계획

### MODIFY `packages/ai/src/providers/kiro.ts`

1. `KiroHistoryEntry.userInputMessage` 타입 확장 — `userInputMessageContext?`
   (`tools?`, `toolResults?`)를 history 항목에도 허용. (신규 `KiroUserInputMessage`,
   `KiroUserInputMessageContext` 인터페이스)

2. `buildPayload` 재작성:
   - tool 결과를 `pending` 버퍼에 모았다가, **그 결과를 낸 assistant 턴 다음의
     userInputMessage**에 실어 history에 끼워넣음 (다음 assistant 턴 전이면 전용 user
     턴으로 먼저 flush). 평탄 누적 + `"(continue)"` 빈 메시지 삽입 제거.
   - `toolUses[].toolUseId` 를 `normalizeToolCallId(tc.id)` 로 정규화 →
     `toolResults[].toolUseId` 와 항상 일치 (기존 raw id ↔ normalized id 불일치 수정).
   - currentMessage 선택: 끝이 tool 결과면 placeholder user 턴 + 결과, 아니면 마지막
     user 턴 pop, 그 외 `"(continue)"`. tools는 currentMessage context에 부착.

3. systemPrompt 하드닝: `context.systemPrompt`는 `string[]`. 현재 template-string으로
   콤마 join됨 → `if (context.systemPrompt?.length) systemPrefix =
   \`${context.systemPrompt.join("\n\n")}\n\n\`` 로 수정.

4. `buildPayload` 를 `export` (단위 테스트용; 기존 export 삭제 없음).

### NEW `packages/ai/src/providers/kiro-payload.test.ts`
와이어 불변식 잠금:
- 단일 라운드 10개 병렬: 결과가 currentMessage에 적재, history=[user, assistant(10 toolUses)]
- 멀티라운드(2개→텍스트→10개 병렬): 모든 assistantResponseMessage.toolUses 가
  바로 다음 turn의 toolResults 와 id 집합 일치 + 엄격 교대
- 특수문자 id 정규화 일치
- 일반 user 턴: history 비고 current 단일

## 검증 게이트
- `bun test src/providers/kiro-payload.test.ts` (4 케이스)
- `bun run check:types` (tsgo, 에러 0)
- biome 포맷
- 라이브 스모크(`tool use 10개`)는 사용자 몫 — 여기선 검증 불가(명시).

## 비-목표 / 후속
- 요청 size 한도(대용량 toolResults)는 다른 실패(413류)라 이번 범위 밖.
- transformMessages 공유 유틸로의 재배선은 더 큰 리팩터 — 별건.
