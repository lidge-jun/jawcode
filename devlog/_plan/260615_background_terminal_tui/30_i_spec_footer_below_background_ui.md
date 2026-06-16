# Jaw Interview Final Spec — footer-below background UI cycle 1

Slug: `footer-below-background-ui-cycle1`
Date: 2026-06-15

## Objective

Implement and verify cycle 1 of the footer-below background work UI for Jawcode:

- compact background footer copy,
- `alt+x` three-row footer-below panel,
- row selection and read-only detail,
- correct failed/cancelled terminal-row lifecycle,
- focused tests and package check,
- PABCD audit/build/check completion.

## Locked user requirements

1. Compact footer copy uses per-kind suffixes: `bg 3sub 1sh 1cron · alt+x`.
2. `alt+x` expands/collapses a real panel below the composer footer at the terminal bottom.
3. Expanded panel shows three visible rows and supports row selection plus `Enter` detail.
4. Successful completed rows disappear automatically.
5. Failed/cancelled rows remain visible after they become visible; they clear only after a later real user-agent prompt.
6. Slash/local commands, bash/python commands, empty continuations, and extension-handled inputs must not clear failed/cancelled rows.
7. Completion is structured TUI state only; no assistant prose injection.
8. Cycle 1 must not implement real detached PTY/terminal semantics or `ctrl+x` foreground backgrounding; those require later PABCD cycles.

## Audit-derived constraints that must be in the plan

### Snapshot compatibility

- Keep existing `JobsSnapshot` legacy fields through cycle 1 so existing `/jobs` overlay and status-line code keep compiling:
  - `monitors`, `crons`, `activeMonitorCount`, `activeCronCount`, `worstState`, `failedUnacknowledged`.
- Add a new canonical `backgroundRows` iterator for footer/panel.
- `backgroundCounts` must be derived from `backgroundRows`; model compact text must compute from `backgroundRows`, never from a divergent counts map.

### Status-line ownership

- Composer footer/panel owns all-background generic async/subagent counts.
- Suppress/remove existing non-monitor async `N jobs running` status-line block when footer background text is active.
- Keep legacy monitor/cron status-line behavior compatible; do not duplicate all-background footer counts in status line.

### Panel input routing

- Do not rely on unfocused TUI component `handleInput()` returning boolean.
- `BackgroundFooterPanel` should expose state methods (`moveSelection`, `openSelected`, `collapse`) rather than a boolean `Component.handleInput` contract.
- Up/down/Enter handlers must be installed/active only while the panel is expanded and removed/disabled on collapse.
- Esc must route through `editor.onInterruptPriority` or an `onEscape` guard because CustomEditor handles escape before custom key handlers.

### Prompt acknowledgement lifecycle

- Add a shared real-user-agent-prompt pre-submit helper in `InteractiveMode`.
- The helper increments `#userAgentMessageSeq`, calls `JobsObserver.acknowledgeTerminalAfterUserMessage(seq)`, and refreshes footer/panel.
- Call the helper from `withLocalSubmission` and any direct prompt path that counts as a real user-agent submission, including compaction/queued direct prompt paths if they bypass `withLocalSubmission`.
- Do not call it for slash/local/bash/python/extension/empty continuation paths.

### Visibility and retained terminal rows

- `BackgroundRowView` includes `visibleSinceUserMessageSeq?: number`.
- `JobsObserver.markTerminalRowsVisible(seq)` stamps currently latched failed/cancelled rows once they are rendered in compact footer or panel.
- `JobsObserver` owns an id-keyed retained latched-row map populated on failed/cancelled terminal transition.
- Retained rows merge into `backgroundRows` even after `AsyncJobManager` evicts the original job.
- `acknowledgeTerminalAfterUserMessage(seq)` prunes retained rows only when `visibleSinceUserMessageSeq` is defined and lower than `seq`.

### Detail surface

- `Enter` opens a read-only detail surface hosted via selector/editorContainer overlay pattern.
- Minimum detail fields: kind, label/description, status, age/schedule, last output/result/error preview when present.
- Esc/back closes detail and restores editor focus without clearing terminal latches.
- No destructive cancel/delete/stop actions in cycle 1.

## Required focused verification

- background footer model tests,
- background footer panel tests,
- jobs observer tests,
- composer footer tests,
- input-controller/keybinding tests,
- keybinding display/conflict tests,
- jobs segment/status-line compatibility tests,
- jobs overlay model compatibility tests,
- `bun --cwd=packages/coding-agent run check`.

## Non-goals

- No real detached terminal/PTY semantics in cycle 1.
- No `ctrl+x` foreground backgrounding in cycle 1.
- No migration of `/jobs` overlay to all background kinds in cycle 1 unless required for compatibility.
- No assistant text/prose injection for background completion.
