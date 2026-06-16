# 010_shell — 02 logic changes (jwc_patched)

> jwc_patched: fork **실제 로직**. git `upstream/main..HEAD` + [fork_logic_changelog.md](../../../structure/40_fork-delta.md).
> worktree @ `d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5`.

## 런타임·표면

- **단일 공개 진입**: npm 패키지 `jawcode`, bin **`jwc`** — `packages/jwc/bin/jwc.js`가 managed Bun으로 workspace/bundle CLI를 재실행한다.
- **레거시 제거**: `packages/gajae-code` → jawcode-compat wrapper; 사용자가 호출하는 CLI는 `jwc`만 남긴다.
- **앱 식별자**: `APP_NAME` 기본 `jwc` (`packages/coding-agent` main/help); 내부 `ENGINE_NAME`·`@jawcode-dev/*` 워크스페이스는 리베이스 비용 절감용으로 유지.
- **릴리스·가드**: `scripts/rebrand-inventory.ts --strict`, `packages/jwc` publish 번들이 공개 표면 게이트.

## upstream 대비

| 동작 | gjc | jwc |
|---|---|---|
| CLI bin | `gjc` | **`jwc` only** |
| npm 공개 패키지 | (legacy shell) | **`jawcode`** (`packages/jwc`) |
| SDK import | — | `jawcode/sdk` → coding-agent SDK 재수출 |

## 코드 앵커

| 항목 | path:line |
|------|-----------|
| package/bin | `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/package.json:2`, `:8` |
| launcher | `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/bin/jwc.js:1` |
| SDK boundary | `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/src/sdk.ts:1` |

## 커밋

`7d55513b`, `59d10c66`, `bb6571a0`, `6c9b3c53`

## 정본

- 횡단: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 앵커 경로: [02_code_facts.md](./02_code_facts.md)