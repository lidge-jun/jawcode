# Jaw Interview Final Spec — Agent-facing background work contract

Date: 2026-06-15
Slug: `agent-background-contract`
Parent context: cycle 1 footer-below background work UI landed in commit `5b8f2580 Add background footer task panel`.

## Problem

Cycle 1 made background work visible and manageable in the TUI footer/panel, but the agent still lacks a clear action contract for using that infrastructure. The next phase must make background work agent-usable: the model should know when work is in the background, how to inspect it, how to follow output, and how to cancel it, without inventing commands or relying on hidden UI-only affordances.

## Goal

Add an agent-facing background work management contract that reuses existing launch paths (`task`, async `bash`, existing background-capable runtimes) while introducing a clear management/read surface for background work.

## Scope

### Launch semantics

- Keep existing launch tools as the start path:
  - `task` / subagent launch remains the subagent background path.
  - async/background-capable `bash` remains the shell/process launch path.
- Do not introduce a second competing launch API in this cycle.
- Update prompt/tool guidance so the agent understands when existing launch paths create background rows and how to report them briefly to the user.

### Management surface

Implement a management-oriented background tool or equivalent tool namespace for:

- `list`: enumerate current background work rows using the same canonical row model as the footer panel.
- `detail`: inspect one background item, including kind, label, status, description, start/next timing, result/error/output preview, and artifact/output references when available.
- `cancel`: cancel/stop a cancellable background item through existing owner-scoped manager APIs.
- `follow`: read incremental or retained output for background work so the agent can summarize progress without relying on the TUI panel.

The preferred shape is hybrid:

- Existing tools launch background work.
- A new/central background management tool handles list/detail/cancel/follow.

### Prompt and settings

- Add system/tool guidance explaining:
  - when the agent should launch long-running work in background,
  - how much progress commentary is appropriate,
  - how to use `list/detail/follow/cancel`,
  - how user-facing TUI footer rows relate to tool-visible background rows.
- Provide read-only discovery for relevant background settings/keybindings.
  - Example: discover `alt+x` footer panel binding and any bg footer/retention settings that already exist.
  - Do not mutate settings in this cycle.

## Non-goals

- Do not implement stdin/steer for detached terminals in this cycle.
- Do not replace existing `task` or `bash` launch APIs.
- Do not turn every tool into a backgroundable process abstraction.
- Do not add broad settings mutation for bg behavior.
- Do not regress cycle 1 footer/panel UI or terminal-row acknowledgement semantics.

## Acceptance criteria

1. The agent has a documented and tested background management surface for `list`, `detail`, `cancel`, and `follow`.
2. The management surface uses the same canonical background row identity/kind/status model as `JobsObserver` / footer panel.
3. `list` output is bounded and sanitized for tool display.
4. `detail` exposes enough information for the agent to explain what the job is and whether attention is required.
5. `follow` can read output from supported background work without requiring the TUI overlay.
6. `cancel` is owner-scoped and refuses unsupported or cross-owner cancellation safely.
7. Prompt/tool docs teach the model to use background management instead of fabricating status.
8. Read-only settings/keybinding discovery exposes relevant bg controls without allowing mutation.
9. Existing cycle 1 tests remain green, and new tests cover list/detail/cancel/follow plus prompt/tool documentation rendering.

## Open risks to address in planning

- Output cursor semantics for `follow` need a concrete API: absolute offset, since-last-call token, or tail-only mode.
- Subagent output and bash output have different storage/artifact models; planning must decide what `follow` supports for each in v1.
- Cancel semantics differ for running, queued, paused, failed, cancelled, cron, and monitor rows.
- Tool result rendering must remain bounded and sanitized to avoid TUI corruption or huge context injections.

## Recommended next stage

Proceed to P-stage planning for a concrete file-level implementation plan. The likely implementation surface is `packages/coding-agent/src/tools` or the existing tool registry, `JobsObserver`/`AsyncJobManager` adapters, tool docs/prompts, and focused tests under `packages/coding-agent/test`.
