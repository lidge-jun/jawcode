# 03 — Jawcode agent-session.ts 삽입점 지도 (Sonnet 스캔)

> 파일: `packages/coding-agent/src/session/agent-session.ts` (9971줄)
> **핵심 발견: 모든 삽입점에서 jawcode 포크 코드(reformation 1638-1732)와 충돌 0.**

## Point 1 — `#promptWithMessage` (line 4879): #542 호출 삽입점

```
4913  if (lastAssistant && !options?.skipCompactionCheck) {
4914      await this.#checkCompaction(lastAssistant, false);
4915  }
→ INSERT HERE: await this.#checkEstimatedContextBeforePrompt();
4917  // Build messages array
```

삽입점 전후 5줄에 jawcode 전용 코드 없음. `#buildPabcdStageMessage`(4931)은 **하류**(삽입 후).

## Point 2 — `sendCustomMessage` (line 5348): #570 우회 수정 대상

**Call A (line 5383)**: `deliverAs === "nextTurn"` + `triggerTurn`
**Call B (line 5407)**: `triggerTurn` 단독

둘 다 `this.agent.prompt(appMessage)` → `this.#promptWithMessage(...)` 교체.
`promptCustomMessage`(4841)은 이미 `#promptWithMessage` 사용 — 정상.

## Point 3 — `#estimateContextTokens` (line 9706-9745): #570 분리 대상

현재: `#estimateMessagesTokens()`(native `estimateTokens`) → usage 기반 보정 → max.
#570: display용 `estimateMessageTokensHeuristic` vs compaction용 native로 분리.
`estimateMessageTokensHeuristic`는 **10.013으로 이미 export 있음** — import 추가만 필요(Point 7).

## Point 4 — `#checkCompaction` (line 6644): 기존 post-turn. #542 companion 삽입점 = Point 1

## Point 5 — jawcode 포크 코드: **충돌 0**

reformation 전부(getCodexTransportStatus/fallbackNotice/prewarm 타이머) = 1638-1732줄.
#542 수술 영역(4879-9745)과 **3100줄 떨어져** 있어 겹침 없음.

## Point 6 — `#didSessionMessagesChange` (line 7242-7247): #570 해시 캐시 대상

현재: `JSON.stringify(prev) !== JSON.stringify(next)`. 호출 1곳(9162).

## Point 7 — Import block (line 36-50)

현재 imports: `estimateTokens`, `shouldCompact`, `compact` 등.
추가 필요: `estimateMessageTokensHeuristic` (10.013에서 export 완비, import만 추가).
