# 081_cursor — 02 logic changes (jwc_patched)

> jwc_patched: fork **실제 로직**. git `upstream/main..HEAD` + [fork_logic_changelog.md](../../../structure/40_fork-delta.md).
> worktree @ `da23db8f217637412552c7a7b1e411a180c5ecc8`.

## 런타임·표면

- host model pin; tool-call render+execute; autocompact estimate 폴백.

## worktree 앵커

- cursor.ts (ai+coding-agent); agent-session.ts:6758-6763; tokenizer-routing.ts + tokenizer-encoding.ts
- [30_providers.md](../../../structure/30_providers.md) §2b

## 커밋

`e12e03d4`, `02b50ad9`, `16ce10d7`
## 정본

- 횡단: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 파일 단위: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 앵커 경로: [02_code_facts.md](./02_code_facts.md)
