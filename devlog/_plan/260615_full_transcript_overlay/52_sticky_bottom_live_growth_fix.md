# 52 Reopen — Ctrl+T sticky bottom while transcript grows

## Trigger

After the bottom-tail expansion fix, the user opened Ctrl+T and showed the overlay header at a non-tail range such as `Full transcript (..., 39872–39909/39967)`. The overlay was open, but newly appended streaming/live lines were below the visible viewport, so the user still saw older collapsed/current-turn-looking rows.

## Root cause

`FullTranscriptOverlayComponent` pinned to `maxScroll` only on the first render. Later renders only clamped the existing `#scroll` with `Math.min(this.#scroll, maxScroll)`. When the source component kept growing while the overlay was open, `maxScroll` increased but `#scroll` stayed at the old value. The overlay therefore drifted off the bottom even though the user had not intentionally scrolled upward.

This is separate from top-start vs bottom-start: bottom-start remains correct, but bottom-start also needs sticky-bottom behavior while the transcript grows.

## Patch

- `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`
  - Track whether the overlay is pinned to the bottom.
  - Initial render and `G` pin to bottom.
  - `up`, `pageUp`, and `g` unpin unless there is no scrollable overflow.
  - While pinned, each render updates `#scroll` to the latest `maxScroll`, so growing streaming/live transcript content stays visible.
- `packages/coding-agent/test/full-transcript-overlay.test.ts`
  - Added growth regression tests:
    - pinned bottom follows source growth;
    - user-scrolled top does not follow source growth;
    - `G` re-pins and follows later growth.

## Verification

- Focused suites:
  - `bun test packages/coding-agent/test/full-transcript-overlay.test.ts packages/coding-agent/test/input-controller-keybindings.test.ts packages/coding-agent/test/session-transcript-replay.test.ts`
  - Result: 61 pass, 0 fail, 256 expect calls.
- Changed-file check:
  - `bunx biome check packages/coding-agent/src/modes/components/full-transcript-overlay.ts packages/coding-agent/test/full-transcript-overlay.test.ts`
  - Result: OK.
- Package check:
  - `bun --cwd=packages/coding-agent run check`
  - Result: Biome checked 1659 files; `tsgo -p tsconfig.json --noEmit` passed.

## Expected behavior

Ctrl+T still opens at the latest/bottom. If the current assistant/tool output continues growing after the overlay opens, the viewport remains stuck to the newest tail. If the user scrolls up (`g`, PgUp, Up), the overlay respects that manual position until the user jumps back with `G`.
