# 22_cycle2_foreground_backgrounding — Later cycle outline

Parent roadmap: `20_p_plan_revised.md`

> Non-executable outline only. Do not implement from this file without a fresh I/P plan after cycle 1 lands and produces a concrete foreground handle inventory.
Depends on: `21_cycle1_footer_below_panel.md`

## Goal

Make `ctrl+x` send currently foreground work to background without backgrounding the whole Jawcode interactive app.

## Scope

Potential targets after cycle 1 is complete:

- Foreground bash execution state in `AgentSession` / bash tool execution path.
- Foreground subagent/task execution handles if exposed by `AsyncJobManager` or task runtime.
- UI transition from foreground live tool block to background footer panel row.

## Non-goals

- Do not implement real PTY/stdin/follow semantics here unless cycle 3 is merged into this loop by explicit approval.
- Do not reuse existing `InputController.handleBackgroundCommand()` blindly; it backgrounds the interactive app/session UI.

## Acceptance sketch

- `ctrl+x` on a supported foreground bash/subagent moves it into background tracking and leaves the editor usable.
- Unsupported foreground states show a clear transient notice.
- Background footer panel immediately shows the moved row.
- Esc/cancel semantics remain correct for foreground work not moved to background.

## Required before implementation

Run a fresh PABCD I/P loop for exact foreground execution handles after cycle 1 lands.
