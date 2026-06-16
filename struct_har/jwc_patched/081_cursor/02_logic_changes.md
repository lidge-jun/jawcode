# 081_cursor — 02 logic changes (jwc_patched)

> jwc_patched: fork **실제 로직**. git `upstream/main..HEAD` + [fork_logic_changelog.md](../../../structure/40_fork-delta.md).
> worktree @ `d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5`.

## 런타임·표면

- host model pin; tool-call render+execute; autocompact estimate 폴백.

## gjc 대비

- cursor RPC·`packages/coding-agent/src/cursor.ts` — fork에서 pin/timeout/tool 경로 수정 (upstream 269387ba 대조).

## worktree 앵커

- `packages/ai/src/providers/cursor.ts` — host override·discipline 주입
- `packages/coding-agent/src/cursor.ts` — shell timeout 등 exec 변환
- `packages/coding-agent/src/session/agent-session.ts:6758-6763` — usage under-report 시 `Math.max(promptTokens, #estimateMessagesTokens())` (cursor 등)
- **Tokenizer routing (컴팩션 native count)**: `packages/ai/src/utils/tokenizer-routing.ts:29-85` → `packages/coding-agent/src/utils/tokenizer-encoding.ts:27-28` (`resolveModelEncoding`); 소비 `agent-session.ts:6334`, `9893`

## 커밋

`e12e03d4`, `02b50ad9`, `16ce10d7`

## 정본

- 횡단: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 파일 단위: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 앵커 경로: [02_code_facts.md](./02_code_facts.md)
- provider·tokenizer: [structure/30_providers.md](../../../structure/30_providers.md) §2b