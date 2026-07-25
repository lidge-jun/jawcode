# 010_gjc_C05_tui_command_palette

> Range: `4a80bac9..3ddf26079` (subset)
> Cluster: C05 — searchable command palette, double-Esc draft clear, palette composer ownership and draft preservation
> Sol priority: P2
> Model-related: no
> Card target: 10.095_tui_command_palette
> Worker: GW4

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `634939d76` | fix(tui): preserve palette composer ownership | `packages/coding-agent/src/modes/controllers/input-controller.ts`<br>`packages/coding-agent/src/modes/interactive-mode.ts` |
| 2 | `da0e9c016` | fix(palette): preserve drafts by refusing slash commands | `packages/coding-agent/src/modes/components/custom-editor.ts`<br>`packages/coding-agent/src/modes/controllers/input-controller.ts` |
| 3 | `6be00edcf` | fix(tui): preserve palette draft ownership | `packages/coding-agent/src/modes/components/command-palette.ts`<br>`packages/coding-agent/src/modes/components/custom-editor.ts` |
| 4 | `08a9af8df` | fix(tui): preserve newer palette composer state | `packages/coding-agent/src/modes/controllers/input-controller.ts`<br>`packages/coding-agent/src/modes/controllers/selector-controller.ts` |
| 5 | `28d692a65` | fix(tui): await palette slash command cleanup | `packages/coding-agent/src/modes/components/command-palette.ts`<br>`packages/coding-agent/src/modes/controllers/input-controller.ts` |
| 6 | `1347b0661` | fix(tui): dispatch command palette actions directly | `packages/coding-agent/src/modes/components/command-palette.ts`<br>`packages/coding-agent/src/modes/controllers/input-controller.ts` |
| 7 | `b033cd834` | feat(tui): add searchable command palette | `packages/coding-agent/src/modes/components/command-palette.ts`<br>`packages/coding-agent/src/modes/controllers/input-controller.ts` |
| 8 | `df4b59b14` | feat(tui): double-Esc draft clear with self-invalidating gesture state (#2330) | `packages/coding-agent/src/modes/controllers/input-controller.ts`<br>`packages/coding-agent/test/input-controller-escape.test.ts` |

## 주제 분석

이 묶음은 slash command 탐색을 검색 가능한 command palette로 확장한다. palette action은 텍스트를 억지로 composer에 주입하지 않고 직접 dispatch하며, 열기 전 draft와 composer owner를 명시적으로 보존한다. 비동기 slash cleanup이 끝난 뒤에도 사용자가 더 새롭게 편집한 상태를 덮어쓰지 않도록 세대와 소유권을 확인한다.

double-Esc는 draft가 있을 때 먼저 초안을 지우고, 비어 있는 상태에서만 다음 안전 동작으로 넘어가도록 gesture state를 스스로 무효화한다. JWC의 기존 double-Esc 종료 안전망과 결합할 때 입력 손실과 accidental exit 회귀를 집중 검증해야 한다.

## Worktree 대조

JWC는 이미 `packages/coding-agent/src/modes/controllers/input-controller.ts`에서 입력이 있는 Esc의 draft clear를 처리하고, `packages/coding-agent/src/modes/components/custom-editor.ts`에 double-Escape 안전망을 둔다. `packages/tui/src/components/editor.ts`에는 slash command autocomplete가 있다. 그러나 searchable command palette와 palette draft/composer ownership 식별자는 검색되지 않아 palette 자체는 미반영으로 보인다.

