# 10 — Phase 2: toolUses[].input must be a JSON object (root cause of REQUEST_BODY_INVALID)

> 상태: [P]→[A]→[B]→[C]→[D]
> Goal: aed2cc47-f1b
> 선행: 00_plan.md (Phase 1: history interleaving + id 정규화 + systemPrompt join)

## 발견 경위

Phase 1 수정(interleaving) 후 사용자가 라이브 스모크(`tool use 10개`, **fresh 단일 라운드**)를
돌렸으나 여전히 `Kiro HTTP 400 REQUEST_BODY_INVALID`.

확정 사실:
- `jwc`는 `/Users/jun/.local/bin/jwc` → `packages/jwc/bin/jwc.js` 심링크. `@jawcode-dev/ai`의
  `main`/`exports`가 `./src/index.ts`(dist 없음)이고 jwc.js 주석상 "workspace checkouts run
  live engine sources" → **jwc는 TS 소스를 라이브 실행**. 즉 Phase 1 수정이 적용된 상태에서도
  fresh 단일 라운드가 400. → Phase 1만으로는 부족, 다른 근본 원인 존재.

## 근본 원인 (1차 소스 확인)

kiro2api `types/codewhisperer.go` (commit 859a47c9):

```go
type ToolUseEntry struct {
    ToolUseId string         `json:"toolUseId"`
    Name      string         `json:"name"`
    Input     map[string]any `json:"input"`   // JSON object
}
type ToolResult struct {
    ToolUseId string             `json:"toolUseId"`
    Content   []map[string]any   `json:"content"`
    Status    string             `json:"status"`
    IsError   bool               `json:"isError,omitempty"`
}
```

→ `toolUses[].input`은 **JSON 객체**여야 한다. 그런데 jawcode `buildPayload`는
`input: JSON.stringify(tc.arguments ?? {})` 로 **문자열**을 전송 → CodeWhisperer가
"Improperly formed request"로 거부. tool 호출이 포함된 모든 요청에서 발생(과거 no-tool
"ㅎㅇㅎㅇ" 스모크만 통과했던 이유 = tool history 경로를 한 번도 실검증 안 했음).

교차 확인:
- `ToolResult.Content []map[string]any` ↔ jawcode `content:[{text}]` 일치 ✓
- history `userInputMessageContext.toolResults` ↔ Phase 1 interleaving 일치 ✓
- 출처(원문 fetch): https://github.com/caidaoli/kiro2api `types/codewhisperer.go@859a47c9`

## Diff 계획

### MODIFY `packages/ai/src/providers/kiro.ts`
1. `KiroToolUse.input` 타입: `string` → `Record<string, unknown>`.
2. buildPayload toolUses 매핑: `input: JSON.stringify(tc.arguments ?? {})`
   → `input: (tc.arguments ?? {}) as Record<string, unknown>`.

### MODIFY `packages/ai/src/providers/kiro-payload.test.ts`
- 단일/멀티라운드 케이스에 `input`이 **object**임을 단언하는 검사 추가
  (`typeof toolUses[i].input === "object"`, 직렬화 시 문자열 아님).

## 검증
- `bun test src/providers/kiro-payload.test.ts`
- `bun run check:types`
- 라이브 스모크(`tool use 10개`)는 사용자 — 이번엔 input-object 수정 포함 빌드로 재현.

## 비-목표
- agentTaskType/agentContinuationId(kiro2api는 포함, jawcode 생략)는 no-tool chat이
  통과했으므로 optional로 판단, 이번 범위 밖. 라이브가 또 실패하면 캡처 후 재평가.
