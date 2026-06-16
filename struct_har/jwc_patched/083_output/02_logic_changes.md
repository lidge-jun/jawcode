# 083_output — 02 logic changes (jwc_patched)

> jwc_patched: fork **실제 로직**. git `upstream/main..HEAD` + [fork_logic_changelog.md](../../../structure/40_fork-delta.md).
> worktree @ `d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5`.

## 런타임·표면

- auto-minimize; 1줄 spacing; segment split interleave; alt+t overlay; /effort.

## gjc 대비 (출력·스크롤)

| 동작 | gjc 기본 | jwc 기본 |
|------|----------|----------|
| 도구 완료 | verbose preview → 사후 접힘 | commit: `liveToolContainer` → minimized 1줄 커밋 |
| 히스토리 레인 | 가상(diff)만 | 커밋 레인 기본 ON + 턴 경계 `commitFinalizedBacklog` |

## worktree 앵커

- `packages/coding-agent/src/modes/controllers/event-controller.ts:116-119` — `tool.renderMode` / `isJawBrand`
- `packages/coding-agent/src/modes/utils/ui-helpers.ts:52-55` — `commitLaneEnabled`
- `packages/coding-agent/src/modes/components/` — assistant·tool 셀·overlay
- 정본: [structure/31_scroll.md](../../../structure/31_scroll.md) §4·§6

## 커밋

`3a858246`, `a590aea9`, `b06d48c7`

## 정본

- 횡단: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 파일 단위: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 앵커 경로: [02_code_facts.md](./02_code_facts.md)