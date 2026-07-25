# 040 — WP4: TUI/UX

4 cards: 10.091, 10.092, 10.094, 20.057

## 10.091 — command palette
- NEW: `packages/tui/src/components/command-palette.ts` (searchable overlay)
- MODIFY: `packages/tui/src/tui.ts` (palette mount/unmount)
- MODIFY: `packages/coding-agent/src/modes/` (Ctrl+Shift+P or equivalent binding)
- MODIFY: composer ownership (generation-checked guards)
- VERIFY: palette open/search/execute test

## 10.092 — Kitty/tmux terminal fixes
- MODIFY: `packages/tui/src/` (Kitty anchored-prose, Korean wrapping)
- MODIFY: `packages/tui/src/` (sixel probe-not-assume under tmux)
- MODIFY: `packages/coding-agent/src/` (tmux owner-scope isolation)
- VERIFY: tmux/Kitty rendering regression test

## 10.094 — Telegram adapt
- MODIFY: `packages/notifications/src/telegram/` (stale-daemon reload)
- MODIFY: `packages/notifications/src/telegram/` (per-client ask capability gating)
- MODIFY: `packages/coding-agent/src/` (child-session notification suppression)
- VERIFY: daemon lifecycle test, capability gating test

## 20.057 — Ask behavioral gaps
- MODIFY: `packages/coding-agent/src/tools/ask.ts` (input-reset countdown)
- MODIFY: `packages/coding-agent/src/tools/ask-bridge.ts` (bounded title/viewport)
- NEW: chat-redirect result type
- VERIFY: countdown reset test, viewport bounds test
