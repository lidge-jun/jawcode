# 02 — #570 Hunk Map + 의존 체크리스트 (Sonnet 조사)

> upstream: gjc dev `8e8e784` (#570, follow-up to #542)
> 총 23 hunk: CLEAN 12 / OFFSET 1 / CONFLICT 10

## 의존 체크리스트 (구현 전 해결 필수)

| 의존 | jwc 상태 | 해결 |
|---|---|---|
| `estimateMessageTokensHeuristic` | ✅ **10.013에서 export** | import 추가만 |
| `estimateTokens` alias | ✅ 10.013 | — |
| `truncateTail` (streaming-output) | ✅ 존재(L376) | — |
| `Bun.hash.xxHash64` | ✅ Bun 내장 | — |
| `cloneJsonValueForForkSeed` | ⬜ | 인라인 추가(1함수) |
| `buildNamedToolChoiceResult` | ⬜ | **blocker**: `tool-choice.ts` 리라이트 필요 |
| `resolveToolChoice` / `ResolveToolChoiceResult` | ⬜ | **blocker**: `packages/ai/src/utils/tool-choice-capability.ts` (220줄) 이식 필요 |
| `#checkEstimatedContextBeforePrompt` | ⬜ | **#542 선행** |

## 핵심 발견 — tool-choice-capability blocker

#570은 `#createEagerTodoPrelude`에서 `buildNamedToolChoiceResult`를 쓰는데, 이건 upstream ai
패키지의 **`tool-choice-capability.ts`(220줄 신규 파일)**에 의존해요. jawcode에 이 파일이 통째로
없음. 이걸 먼저 이식해야 `tool-choice.ts` 리라이트가 가능하고, 그래야 #570이 컴파일돼요.

**단, 이 blocker는 #542(Phase 1)에는 해당 없음** — #542는 tool-choice를 안 건드려요.

## Phase 분리 확정

- **Phase 1 (#542)**: tool-choice 무관, 삽입점 충돌 0 → **지금 바로 구현 가능**
- **Phase 2 (#570)**: tool-choice-capability 이식(Step 1-2) 선행 후 → 10-step 순차

## Phase 2 적용 순서 (10 step)

1. `packages/ai` tool-choice-capability.ts 이식 (220줄)
2. `tool-choice.ts` 리라이트 (`buildNamedToolChoiceResult` + `buildNamedToolChoice` thin wrapper)
3. `agent-session.ts` import에 `estimateMessageTokensHeuristic` 추가
4. 인라인 헬퍼/필드 추가 (`cloneJsonValueForForkSeed`, `ProviderReplaySourceCacheEntry`, 3개 필드, 2개 accessor)
5. estimation 메서드 그룹 포팅 (`#estimateContextTokensWith` 등 5개)
6. `#checkEstimatedContextBeforePrompt` / `Once` 포팅 + `#promptWithMessage` 호출점 갱신
7. `#createEagerTodoPrelude` 리턴타입 + `buildNamedToolChoiceResult` 교체
8. `structuredClone` → `cloneJsonValueForForkSeed` (2곳)
9. `#didSessionMessagesChange` 해시 캐시 리라이트
10. `monitor.ts` 변경 (독립, 언제든)
