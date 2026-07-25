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
  - `packages/coding-agent/src/modes/components/settings-selector.ts` does not contain upstream `StatusLineCustomEditor`; upstream custom-editor UX depends on a feature that JWC previously deferred under `10.058`.
  - `packages/tui/src/tui.ts` currently renders child and overlay components without the upstream `safeRenderComponent` isolation.

## Scope

IN:

1. Add component render isolation so one throwing component produces a visible fallback line and does not abort the entire frame.
2. Change base editor Ctrl+Enter and Ctrl+Shift+Enter variants from newline to submit, while keeping Shift+Enter as newline.
3. Add status-line usage display mode (`used` vs `remaining`) adapted to JWC's current usage data shape at the config/rendering layer.
4. Close `10.060` docs and move the card to `_fin/10` after verification.

OUT:

- No `10.041` Windows/psmux work.
- No `20.006 resetDisplay` work unless a new regression appears during focused testing.
- No welcome/banner/scroll visual simplification.
- No upstream status-line custom editor import or custom-editor UX polish from `0e537348`; JWC lacks `StatusLineCustomEditor`, and importing it would reopen the `10.058` deferred custom-editor surface.
- No `packages/tui/src/components/settings-list.ts` description-row changes, because the only identified consumer is the deferred custom status-line editor.
- No settings-selector UI for usage mode in this cycle; the mode remains configurable through existing `statusLine.segmentOptions` storage and is regression-tested at render level.

## Planned file changes

### MODIFY `packages/tui/src/tui.ts`

- Import `logger` from `@jawcode-dev/utils`.
- Add `safeRenderComponent(component, width, where)` near the `Container` implementation.
- Use it in:
  - `Container.render` child loop.
  - overlay compositing in `#compositeOverlays`.
- Do not add an `#expandViewportFill` wrapper in JWC: current JWC `#expandViewportFill` operates on pre-rendered `string[]` and has no component `render()` call.
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

### ADD/MODIFY tests

- `packages/coding-agent/test/status-line-usage.test.ts`: add a new focused usage-segment test file if no adjacent file exists, covering used and remaining display against JWC's current usage shape.
- Do not add `packages/coding-agent/test/modes/components/settings-selector-status-line-custom.test.ts` in this cycle because `StatusLineCustomEditor` is absent by design.
- Do not modify `packages/tui/test/settings-list.test.ts` unless render-isolation work reveals a direct settings-list regression.

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
bun test packages/tui/test/render-loop-resilience.test.ts packages/tui/test/editor.test.ts packages/coding-agent/test/status-line-usage.test.ts
```

Required broad gates:

```bash
bun run check:ts
git diff --check
```

Review:

- Dispatch a read-only Frontend/TUI audit in A phase to validate the plan paths, upstream mapping, tests, and TUI visual/scroll boundary.
- Dispatch a read-only verification after B if the implementation touches all planned paths.

## B implementation evidence (260701)

- Implemented `packages/tui/src/tui.ts` render isolation for container children and overlays with bounded logged fallback lines.
- Implemented `packages/tui/src/components/editor.ts` submit semantics for Ctrl+Enter and Ctrl+Shift+Enter while preserving Shift+Enter multiline input.
- Implemented `packages/coding-agent/src/modes/components/status-line.ts` and `status-line/segments.ts` usage mode rendering (`used` default, `remaining` optional).
- Added focused regression tests:
  - `packages/tui/test/render-loop-resilience.test.ts`
  - `packages/tui/test/editor.test.ts`
  - `packages/coding-agent/test/status-line-usage.test.ts`
- Focused verification: `bun test packages/tui/test/render-loop-resilience.test.ts packages/tui/test/editor.test.ts packages/coding-agent/test/status-line-usage.test.ts` → 122 pass / 0 fail.
- B verifier: Frontend read-only verifier PASS; no blockers, residual only deferred `StatusLineCustomEditor` UX.
- C gates: `bun run check:ts` → exit 0; `git diff --check` → exit 0.
- Closure docs: `struct_har/chase/_fin/10/10.060_gjc_chase_tui_render_resilience_editor_submit.md`, `struct_har/chase/10_gjc_chase_MOC.md`, `struct_har/chase/007_follow_index.md`, `struct_har/chase/10.001_gjc_chase_cycle.md`, `struct_har/chase/_fin/INDEX.md`.
