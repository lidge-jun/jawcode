# 010_shell — 02 logic changes (jwc_patched)

> jwc_patched: fork **실제 로직**. git `upstream/main..HEAD` + [fork_logic_changelog.md](../../../structure/40_fork-delta.md).
> worktree @ `da23db8f217637412552c7a7b1e411a180c5ecc8`.

## 런타임·표면

- **단일 진입**: `packages/jwc` bin `jwc`; `packages/gajae-code` **제거**.
- `APP_NAME` 기본 `jwc`; `ENGINE_NAME` 내부 식별자 보존.
- 가드·릴리스: jwc 기준 `rebrand-inventory`, `packages/jwc` bundle publish.

## upstream 대비

| 동작 | gjc | jwc |
|---|---|---|
| CLI | `gjc` | **`jwc` only** |
| wrapper | `packages/gajae-code` | **삭제** |

## 커밋

`7d55513b`, `59d10c66`, `bb6571a0`, `6c9b3c53`
## 정본

- 횡단: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 파일 단위: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 앵커 경로: [02_code_facts.md](./02_code_facts.md)
