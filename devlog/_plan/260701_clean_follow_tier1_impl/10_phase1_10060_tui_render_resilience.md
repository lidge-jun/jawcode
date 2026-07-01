# 10 Phase 1 — 10.060 TUI render resilience, Ctrl+Enter submit, status-line UX

## Classification

Class: C3. This is a cross-package TUI/product slice spanning `packages/tui`, `packages/coding-agent`, focused tests, and chase closure docs. It needs full PABCD, Frontend/TUI review, focused tests, `bun run check:ts`, and `git diff --check`.

## Source facts checked

- Chase card: `struct_har/chase/10.060_gjc_chase_tui_render_resilience_editor_submit.md`.
- Upstream read-only commits from `devlog/_gjc_chase/gajae-code`:
  - `eb346860` render-loop per-component isolation.
  - `0455d408` Ctrl+Enter composer submission.
  - `8bf665af` status-line usage display mode.
  - `0e537348` status-line custom editor UX.
- Current JWC inspection:
  - `packages/tui/src/components/editor.ts` still treats Ctrl+Enter variants as newline in the base editor.
  - `packages/coding-agent/src/modes/components/hook-editor.ts` already submits Ctrl+Enter in hook mode.
  - `packages/coding-agent/src/modes/components/status-line/segments.ts` already has a usage segment, but no used/remaining mode option.
  - `packages/tui/src/components/settings-list.ts` lacks the fixed description-row support from upstream.
  - `packages/tui/src/tui.ts` currently renders child and overlay components without the upstream `safeRenderComponent` isolation.

## Scope

IN:

1. Add component render isolation so one throwing component produces a visible fallback line and does not abort the entire frame.
2. Change base editor Ctrl+Enter and Ctrl+Shift+Enter variants from newline to submit, while keeping Shift+Enter as newline.
3. Add status-line usage display mode (`used` vs `remaining`) adapted to JWC's current usage data shape.
4. Improve status-line custom editor UX by keeping the parent preview current and stabilizing the settings-list description area.
5. Close `10.060` docs and move the card to `_fin/10` after verification.

OUT:

- No `10.041` Windows/psmux work.
- No `20.006 resetDisplay` work unless a new regression appears during focused testing.
- No welcome/banner/scroll visual simplification.
- No broad status-line preset redesign beyond the usage option.

## Planned file changes

### MODIFY `packages/tui/src/tui.ts`

- Import `logger` from `@jawcode-dev/utils`.
- Add `safeRenderComponent(component, width, where)` near the `Container` implementation.
- Use it in:
  - `Container.render` child loop.
  - overlay compositing in `#compositeOverlays`.
  - bottom-pinned measurement in `#expandViewportFill`.
- Fallback line format: `[render error: <ComponentName>]`.
- Log each unique component/where/error combination once, with a bounded cache.

### ADD `packages/tui/test/render-loop-resilience.test.ts`

- Test top-level throwing child does not throw and siblings still render.
- Test nested throwing child does not throw and nested sibling still renders.
- Assert fallback line contains `render error`.

### MODIFY `packages/tui/src/components/editor.ts`

- Remove Ctrl+Enter and Ctrl+Shift+Enter from the newline branch.
- Keep Shift+Enter legacy/Kitty variants in the newline branch.
- Add Ctrl+Enter and Ctrl+Shift+Enter to the submit branch before `kb.matches("tui.input.submit")`.
- Preserve `disableSubmit`, slash-completion, and backslash-enter behavior.

### MODIFY `packages/tui/test/editor.test.ts`

- Replace the existing Ctrl+Enter newline regression with submit expectations.
- Add Ctrl+Shift+Enter submit vs Shift+Enter newline expectations.
- Keep existing keypad/NumLock coverage.

### MODIFY `packages/coding-agent/src/modes/components/status-line.ts`

- Extend `StatusLineSegmentOptions` with `usage?: { mode?: "used" | "remaining" }`.

### MODIFY `packages/coding-agent/src/modes/components/status-line/segments.ts`

- Adapt usage color and display percent calculation:
  - `used`: current behavior.
  - `remaining`: display `100 - used` and invert warning/error thresholds.
- Keep JWC's current `fiveHour`/`sevenDay` usage data shape; do not copy upstream's window-array type.

### MODIFY `packages/coding-agent/src/modes/components/settings-selector.ts`

- Add usage mode select options.
- Add a `Usage: mode` row when editing the `usage` segment.
- Thread `usage.mode` into `segmentOptions`.
- Refresh the parent status-line preview while editing/cancelling the custom editor.
- Do not reintroduce inline current/narrow preview rows inside the custom editor.

### MODIFY `packages/tui/src/components/settings-list.ts`

- Add optional `onSelectionChange` callback and optional fixed `descriptionRows`.
- Invoke selection callback on init, item replacement, navigation, and submenu close.
- When `descriptionRows > 0`, reserve that many description rows even when the selected item has no description.

### MODIFY tests

- `packages/coding-agent/test/status-line-usage.test.ts`: add remaining quota display case.
- `packages/coding-agent/test/modes/components/settings-selector-status-line-custom.test.ts`: add usage-mode placement, parent preview refresh, and stable description height checks.
- `packages/tui/test/settings-list.test.ts`: add fixed description-row behavior if adjacent coverage is not already sufficient.

### MOVE/MODIFY chase docs after code verification

- Move `struct_har/chase/10.060_gjc_chase_tui_render_resilience_editor_submit.md` to `struct_har/chase/_fin/10/10.060_gjc_chase_tui_render_resilience_editor_submit.md`.
- Update:
  - `struct_har/chase/10_gjc_chase_MOC.md`
  - `struct_har/chase/007_follow_index.md`
  - `struct_har/chase/002_gap_inventory.md` if status text references the open card.
  - `struct_har/chase/10.001_gjc_chase_cycle.md`
  - `_fin` index/readme files if required by local convention.
- Record source commits, JWC commit placeholder/evidence, focused tests, `bun run check:ts`, and `git diff --check`.

## Verification plan

Focused tests:

```bash
bun test packages/tui/test/render-loop-resilience.test.ts packages/tui/test/editor.test.ts packages/tui/test/settings-list.test.ts packages/coding-agent/test/status-line-usage.test.ts packages/coding-agent/test/modes/components/settings-selector-status-line-custom.test.ts
```

Required broad gates:

```bash
bun run check:ts
git diff --check
```

Review:

- Dispatch a read-only Frontend/TUI audit in A phase to validate the plan paths, upstream mapping, tests, and TUI visual/scroll boundary.
- Dispatch a read-only verification after B if the implementation touches all planned paths.
