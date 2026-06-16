# 080_tui — 02 logic changes (jwc_patched)

> jwc_patched: fork **실제 로직**. git `upstream/main..HEAD` + [fork_logic_changelog.md](../../../structure/40_fork-delta.md).
> worktree @ `d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5`.

## 런타임·표면

- abyss-bite / abyss-bite-light 기본 테마 (`packages/coding-agent/src/modes/theme/theme.ts:1800-1802` — branded shell만; gjc는 red-claw/blue-crab).
- welcome/banner Jawcode (`packages/coding-agent/src/modes/components/welcome.ts:394-397` — `BRANDED = APP_NAME !== ENGINE_NAME`).
- /quota, /effort; provider 탭; workflow HUD (일부 WIP).

## gjc 대비 (TUI)

| 영역 | gjc (`devlog/_upstream_gjc` @ 269387ba) | jwc (worktree @ d60b7822) |
|------|----------------------------------------|---------------------------|
| 기본 테마 | red-claw / blue-crab | abyss-bite / abyss-bite-light |
| 배너 | RED_CLAW / Gajae forge | JAW_FIN / Jawcode |
| ViewportFill·B2-lite | 없음 | `packages/tui/src/components/viewport-fill.ts`, `insert-history.ts` 신규; chat **위** fill + `liveToolContainer` |
| composerPin / composerFooter | 미설정 시 off | 미설정 시 `isJawBrand()` → on (`interactive-mode.ts:555-575`) |
| tool.renderMode 기본 | verbose | commit (`event-controller.ts:116-119`) |
| 커밋 레인 | 없음 | `JWC_COMMIT_LANE` 기본 ON (`ui-helpers.ts:52-55`) |

스크롤 정본: [structure/31_scroll.md](../../../structure/31_scroll.md).

## 커밋

`3bc79781`, `89800b67`, `7259a7c6`, `33fbee4d`

## 정본

- 횡단: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 파일 단위: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 앵커 경로: [02_code_facts.md](./02_code_facts.md)