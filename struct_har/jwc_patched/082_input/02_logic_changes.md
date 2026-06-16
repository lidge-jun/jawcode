# 082_input — 02 logic changes (jwc_patched)

> jwc_patched: fork **실제 로직**. git `upstream/main..HEAD` + [fork_logic_changelog.md](../../../structure/40_fork-delta.md).
> worktree @ `d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5`.

## 런타임·표면

- Ctrl-chord 한글 힌트; 첫 글자 캐럿; ESC 2연타.

## gjc 대비 (입력·스크롤 연동)

- gjc: composer pin 없음 → 프레임 수축·셀렉터 복구가 upstream `packages/tui/src/components/editor.ts` 경로만.
- jwc: B2-lite 핀 on 시 수축 델타는 **상단 ViewportFill**이 흡수 ([31_scroll.md](../../../structure/31_scroll.md) §2–3).
- 압축 타이밍: **다음 프롬프트 제출** (`packages/coding-agent/src/modes/controllers/input-controller.ts:457-460`); agent_end에서는 미발화 (`event-controller.ts:775-777`).

## worktree 앵커

- `packages/tui/src/components/editor.ts` — caret·IME fork diff
- `packages/coding-agent/src/modes/interactive-mode.ts:555-556` — pin 게이트

## 커밋

`cc61d506`, `d14ed4e2`

## 정본

- 횡단: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 파일 단위: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 앵커 경로: [02_code_facts.md](./02_code_facts.md)
- 스크롤: [structure/31_scroll.md](../../../structure/31_scroll.md)