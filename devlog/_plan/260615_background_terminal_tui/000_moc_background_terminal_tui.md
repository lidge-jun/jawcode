# 000 MOC — background terminal/task TUI research

> Supersession note (2026-06-15 A-stage): older slice notes in this MOC that mention `BackgroundJobsStrip`, Ctrl+B roster toggling, mount-above-status placement, chat/assistant completion prose, or generic `/jobs` overlay expansion are historical prior-art only. The active cycle-1 plan is `20_p_plan_revised.md` + `21_cycle1_footer_below_panel.md`: footer-below panel, `alt+x`, compact `bg 3sub 1sh 1cron` copy, structured TUI state only.

> 상태: 구현 전 조사/설계 메모. 사용자가 요청한 Codex-rs + Claude Code 비교와 Jawcode 적용 방향을 기록한다.
> 범위: background terminal/background task가 생겼을 때 채팅/컴포저 하단에 짧은 상태 줄을 유지하고, 상세/완료 알림은 별도 surface로 다루는 구현 준비.

## 결론

Jawcode에는 이미 `AsyncJobManager`, async bash, monitor, job tool, jobs overlay가 있으나 **Claude Code/Codex처럼 항상 보이는 background terminal/task row**는 없다.

현재 Jawcode 표시는 다음에 머문다.

- 일반 async bash: `StatusLineComponent` 우측에 `N jobs running` 카운트만 표시.
- monitor/cron: `JobsObserver`가 status-line jobs widget + jobs overlay에 표시.
- active tool preview: `liveToolContainer`에 표시되고 완료 시 `chatContainer`로 commit/fold.
- background stdin/attach/resize 같은 “terminal session” contract는 없음. async bash는 “deferred reporting”이며 timeout은 그대로 적용된다.

권장 구현은 Codex와 Claude 중간 형태다.

1. `AsyncJobManager`를 상태 source로 유지한다.
2. TUI에 `BackgroundJobsStrip` 같은 작은 component를 추가해 composer/status cluster 위에 표시한다.
3. 일반 async bash/monitor/subagent를 한 canonical summary model로 묶는다.
4. 상세는 기존 jobs overlay를 확장하거나 새 background task dialog로 연다.
5. 완료 알림은 chat notification으로 남기되 successful bash completion spam은 collapse한다.
6. “진짜 background terminal”까지 하려면 별도 process handle/stdin/write/terminate/resize contract가 필요하다.

## 외부 구현 조사

### Codex-rs

핵심 패턴: **process registry + bottom pane summary + `/ps` detail + `/stop` cleanup**.

Evidence:

- Process/session source
  - `/Users/jun/Developer/codex/openai-codex/codex-rs/core/src/state/service.rs`
    - `SessionServices.unified_exec_manager: UnifiedExecProcessManager`
  - `/Users/jun/Developer/codex/openai-codex/codex-rs/core/src/unified_exec/process_manager.rs`
    - `UnifiedExecProcessManager`, process store, `write_stdin`, terminate/cleanup.
  - `/Users/jun/Developer/codex/openai-codex/codex-rs/app-server-protocol/src/protocol/v2/command_exec.rs`
    - `CommandExecWriteParams.process_id`, terminate, resize, output delta.

- TUI event flow
  - `/Users/jun/Developer/codex/openai-codex/codex-rs/tui/src/chatwidget/protocol.rs`
    - `TerminalInteraction` → `on_terminal_interaction`.
    - `CommandExecutionOutputDelta` → `on_exec_command_output_delta`.
  - `/Users/jun/Developer/codex/openai-codex/codex-rs/tui/src/chatwidget/command_lifecycle.rs`
    - `track_unified_exec_process_begin/end` maintains `unified_exec_processes`.
    - `sync_unified_exec_footer()` copies command display list to bottom pane.
    - empty stdin/poll shows `Waiting for background terminal`; non-empty stdin creates interaction history rows.
  - `/Users/jun/Developer/codex/openai-codex/codex-rs/tui/src/bottom_pane/unified_exec_footer.rs`
    - canonical summary: `{count} background terminal(s) running · /ps to view · /stop to close`.
  - `/Users/jun/Developer/codex/openai-codex/codex-rs/tui/src/bottom_pane/mod.rs`
    - if status row exists, summary is inline; otherwise it renders as a dedicated footer row.

Lessons for Jawcode:

- Keep a UI-side registry keyed by stable job/session id; do not parse rendered tool text.
- Use one canonical summary string for footer/status/strip copy.
- Separate compact visible row from detail list (`/ps`) and explicit cleanup (`/stop`).
- Treat turn interrupt separately from background terminal cleanup.
- If supporting stdin/poll, model it as first-class events rather than shell output hacks.

### Claude Code

핵심 패턴: **AppState.tasks + `isBackgroundTask` filter + footer pill/inline roster + grouped dialog + XML/chat completion notification**.

Evidence:

- State source
  - `/Users/jun/Developer/codex/claude_code/orideop_src/src/Task.ts`
    - shared task base includes `outputFile`, `outputOffset`, `notified`.
  - `/Users/jun/Developer/codex/claude_code/orideop_src/src/tasks/types.ts`
    - `isBackgroundTask`: status running/pending and not `isBackgrounded === false`.
  - `/Users/jun/Developer/codex/claude_code/orideop_src/src/tasks/LocalShellTask/LocalShellTask.tsx`
    - `hasForegroundTasks`, `backgroundAll`, `backgroundExistingForegroundTask` flip foreground shell/agent tasks to background on Ctrl+B.

- Output/notification path
  - `/Users/jun/Developer/codex/claude_code/orideop_src/src/utils/task/diskOutput.ts`
    - per-task output file, byte-offset delta reads, tail/full output.
  - `/Users/jun/Developer/codex/claude_code/orideop_src/src/utils/task/framework.ts`
    - `pollTasks`, `generateTaskAttachments`, `enqueueTaskNotification` emit XML `<task_notification>` with `task_id`, `task_type`, `output_file`, `status`, `summary`.
  - `/Users/jun/Developer/codex/claude_code/orideop_src/src/utils/collapseBackgroundBashNotifications.ts`
    - consecutive successful background bash completions collapse to one synthetic notification.

- TUI surfaces
  - `/Users/jun/Developer/codex/claude_code/orideop_src/src/components/tasks/BackgroundTaskStatus.tsx`
    - footer pill from filtered running tasks; summary label + `↓ to view` CTA.
  - `/Users/jun/Developer/codex/claude_code/orideop_src/src/components/PromptInput/PromptInputFooterLeftSide.tsx`
    - embeds `BackgroundTaskStatus` as a `Box` sibling in prompt footer, not inside text.
  - `/Users/jun/Developer/codex/claude_code/orideop_src/src/components/tasks/BackgroundTasksDialog.tsx`
    - grouped task list + detail/kill/foreground interactions.
  - `/Users/jun/Developer/codex/claude_code/orideop_src/src/components/messages/UserAgentNotificationMessage.tsx`
    - renders terminal task notifications as chat bullets.

- Latest observed UI sample from user (Claude Code newer behavior)
  - Prompt: “background subagent 3개 파견해봐 아무 응답이나 해보라고”.
  - Claude first appends a chat summary: `3 background agents launched (↓ to manage)` with a tree of agent labels.
  - Composer/footer area then shows a selectable inline roster below the input/status separator:
    - `⏺ main` row with navigation hint `↑/↓ to select · Enter to view`.
    - one row per background agent: `◯ general-purpose  Background agent N - ...  2s / ↑ tokens`.
  - This is stronger than a compact pill: the footer can expand into a live task roster without opening a modal dialog.
  - Implementation implication for Jawcode: support both compact one-line strip and expanded roster mode; the roster should be keyboard-selectable and should not require opening the jobs overlay for basic visibility.

Lessons for Jawcode:

- Display state (`foreground/background`) should be separate from process state.
- Stable output files + byte offsets make detail views cheap and reliable.
- Running-state surface and completion notification surface should be separate.
- Footer/status pill must be tiny and always available; detail dialog can carry the heavy output, but the newer Claude UI also supports an inline expanded roster for running background agents.
- Ctrl+B priority should be: foreground bash/local agent first, then session backgrounding.
- Completion spam should collapse, but failed/stopped notifications should stay visible.

## Jawcode current structure

### TUI load/layout

`packages/coding-agent/src/modes/interactive-mode.ts` constructs the TUI directly:

1. `new TUI(new ProcessTerminal(), settings.get("showHardwareCursor"))`.
2. Creates containers:
   - `chatContainer`
   - `pendingMessagesContainer`
   - `liveToolContainer`
   - `statusContainer`
   - `todoContainer`
   - `btwContainer`
   - `editorContainer`
   - `hookWidgetContainerAbove/Below`
   - `statusLine`
   - `composerFooter`
3. Mount order:
   - `ViewportFill`
   - `chatContainer`
   - `pendingMessagesContainer`
   - `liveToolContainer`
   - `statusContainer`
   - `todoContainer`
   - `btwContainer`
   - spacer
   - `statusLine`
   - hooks above
   - editor
   - hooks below
   - `composerFooter`

`packages/tui/src/tui.ts` renders by flattening `Container.children` in order, expanding `ViewportFill` to pin later components to the terminal bottom, then diffing line arrays. Therefore a background strip can be a normal Component whose rendered line count changes; no renderer rewrite is needed.

### Existing job state

- `packages/coding-agent/src/async/job-manager.ts`
  - `AsyncJob` currently has `id`, `type`, `status`, `label`, `ownerId`, `metadata`, `resultText`, `errorText`.
  - `appendOutput()` stores sanitized process chunks by UTF-8 byte offsets.
  - `readOutputSince()` returns output slices.
  - `onChange()` notifies UI observers.

- `packages/coding-agent/src/tools/bash.ts`
  - `async: true`/auto-background register `type: "bash"` jobs.
  - `onRawChunk` calls `manager.appendOutput(jobId, chunk)`.
  - running/completed/failed state is also emitted in tool result details as `details.async.state`.
  - async bash does not detach timeout; docs explicitly say it only defers reporting.

- `packages/coding-agent/src/tools/monitor.ts`
  - starts background monitor jobs using the same substrate.
  - each stdout line is delivered as a task-notification-like event path.

- `packages/coding-agent/src/tools/job.ts`
  - discoverable background job control tool with `poll`, `cancel`, `list`.

### Existing UI exposure

- `packages/coding-agent/src/modes/jobs-observer.ts`
  - monitors `AsyncJobManager` + cron.
  - currently filters only `job.type === "bash" && job.metadata?.monitor === true` for monitor list.

- `packages/coding-agent/src/modes/components/status-line.ts`
  - generic async bash jobs are counted only as `N jobs running` on the right side.

- `packages/coding-agent/src/modes/components/jobs-overlay*.ts`
  - overlay is monitor/cron-oriented, not a generic background task list.

- `packages/coding-agent/src/modes/controllers/event-controller.ts`
  - active tools render in `liveToolContainer` and commit/fold to chat at completion.
  - async `running` tool calls remain pending/background internally, but there is no compact persistent task row.

## Recommended Jawcode implementation slices

### 100 — canonical background job view model

Add a generic UI view model separate from monitor-specific `JobsObserver`:

```ts
interface BackgroundJobView {
  id: string;
  type: "bash" | "task" | "monitor" | "cron";
  label: string;
  status: "running" | "completed" | "failed" | "cancelled" | "paused";
  startedAt: number;
  ownerId?: string;
  outputAvailable: boolean;
  canCancel: boolean;
  isMonitor: boolean;
  tokenUsage?: string;
  agentKind?: string;
}
```

Implementation target options:

- Extend `JobsObserver` into `BackgroundWorkObserver`, or
- Add a sibling `BackgroundJobsObserver` for generic async jobs and leave `JobsObserver` monitor/cron-specific until migrated.

Conservative route: add sibling first, then merge later.

### 110 — background strip component

Add `packages/coding-agent/src/modes/components/background-jobs-strip.ts`.

Render rules:

- No jobs → `[]`.
- One running job → dim one-line: `◌ 1 background job running · /jobs to view · job cancel <id> to stop`.
- Multiple running jobs → `◌ N background jobs running · /jobs to view`.
- Failed/cancelled unseen → warning-colored short row until overlay opened/acknowledged.
- Width bound with `truncateToWidth`, tabs sanitized with `replaceTabs`, paths shortened if displayed.
- Compact footer/right-slot copy should follow Codex wording: `N background jobs running · ctrl+b expand` (or `ctrl+b collapse` when expanded). When short enough, this background status should win the right side over the idle hint.
- Expanded mode → render a compact roster:
  - header/main row: `● main` plus `↑/↓ to select · Enter to view`.
  - task rows: `○ <kind>  <label>  <elapsed> · <tokens/output hint>`.
  - selected row should use existing selection/status colors, not a new visual system.
  - roster should be bounded by a small max row count and horizontally truncated.
  - `ctrl+b` toggles compact/expanded roster. Existing `alt+j` can still open the full overlay.
  - `Enter` on the selected roster row opens detail/overlay for that task.
  - `Esc` collapses roster before interrupting unrelated work.

Composer footer alignment target:

- Current `ComposerFooter` is one left-aligned text slot (`? for shortcuts · /help for commands`).
- Add left/right slots or a dedicated background-right slot.
- When background jobs exist, render idle hint on the left and `N background jobs running · ctrl+b expand` right-aligned.
- If both sides do not fit, preserve the background right slot first and truncate/drop the left idle hint.
- Transient warnings/errors still outrank both left and right content.
Mount location in `InteractiveMode.init()`:

```ts
this.ui.addChild(this.liveToolContainer);
this.ui.addChild(this.backgroundJobsContainer);
this.ui.addChild(this.statusContainer);
```

Rationale:

- Above current loader/status zone, below active tool previews.
- Does not disturb composer/footer model.
- Uses existing TUI diff append semantics.

### 120 — overlay/detail expansion

Expand `jobs-overlay-model.ts` and `jobs-overlay.ts` or add a new generic overlay.

Detail rows should include:

- status
- started/duration
- command/label
- last output line from `AsyncJobManager.readOutputSince(id, 0, filter)`
- cancel action for running jobs
- open artifact/output action only when current tool API supports it

Current overlay only shows monitor/cron. Generic async bash should appear too.

### 130 — completion notification + collapse

When background jobs complete:

- Existing delivery path sends final result back to the agent/model.
- Add a UI-visible notice/chat component only for user awareness if no foreground tool card exists.
- Collapse successful background bash completions into a synthetic summary after N consecutive completions.
- Preserve failed/cancelled individually.

Do not route all raw output into chat.

### 140 — real background terminal follow-up

This is separate from the strip.

To match Codex fully, Jawcode needs:

- managed process handle with stdin write
- optional PTY allocation
- resize
- terminate
- stable process id separate from tool call id
- model tool or user command to poll/write stdin
- cleanup command distinct from turn abort

This likely belongs after the visible strip lands. The strip can operate on current async jobs first.

## Risks / constraints

- Do not touch `packages/tui/src/tui.ts` scroll/fill behavior unless absolutely necessary; the strip can be a normal component.
- Do not overload `StatusLineComponent` with multi-line state. It is already dense and right-side segments truncate.
- Avoid displaying unsanitized command/output. Use `replaceTabs`, `truncateToWidth`, `shortenPath`, bounded previews.
- Owner scoping matters: a subagent should not show/cancel parent jobs incorrectly. Reuse `ownerId` filters.
- `async.enabled` and `bash.autoBackground.enabled` are disabled by default in settings today. UX work may require enabling policy or only surfacing when present.
- The current async bash timeout still applies. Do not call it a detached terminal until process handles/timeout semantics change.

## Suggested verification

Focused unit tests:

- `BackgroundJobsStrip` renders no row / one row / many jobs / failed latch and truncates by width.
- Observer filters owner-scoped jobs and excludes/labels monitor jobs correctly.
- Jobs overlay model includes generic async bash and preserves existing monitor/cron rows.
- Completion collapse keeps failed/cancelled visible.

Focused integration/smoke:

- Start an async bash job in an interactive-mode test harness and assert strip row appears.
- Complete job and assert row disappears or changes to completion notification.
- Cancel job from overlay/tool and assert status changes without killing unrelated owner jobs.

Manual QA:

- Long-running `sleep`/`yes` with `async: true`.
- Monitor job still appears in existing jobs overlay.
- Subagent-owned async job does not appear in parent strip unless intentionally unscoped.
- Terminal resize keeps strip and composer stable.

## Open decisions

1. Slash command name: keep existing `/jobs` as the implementation target; optionally add `/ps` alias later for Codex muscle memory.
2. Generic async bash, task subagents, monitor jobs, and cron should be shown through one generalized background-work overlay rather than separate dialogs in the first slice.
3. Auto-background remains opt-in for the first implementation slice; surface existing background work without changing execution policy.
4. Key policy is decided: `ctrl+x` backgrounds the current foreground shell/subagent when that foreground concept exists; `alt+x` expands/manages the background footer/overlay. Do not use Ctrl+B/CtrlE because they are editor cursor-left/line-end defaults.
5. Completion notifications follow Codex precedent by default: user-visible structured TUI/thread/overlay items, not assistant-text injection. Failures may be retained in the overlay/footer until viewed; model-visible context requires a separate explicit policy later.
6. Codex completion visibility finding: background/unified exec completion emits structured `ExecCommandEnd` → app-server `ItemCompleted`/thread history, but `core/src/session/turn.rs::realtime_text_for_event` excludes `ExecCommandEnd` from realtime assistant text. Treat this as TUI/thread-item visible, not assistant-text injection.

## I-stage interview backlog

These questions block a complete P-stage plan. Capture answers here before running `jwc orchestrate p`.

1. **Scope of visible jobs** — Answered: include all background work (`task` subagents, async bash, monitor jobs, cron).
2. **Foreground backgrounding key** — Answered: `ctrl+x` backgrounds the current foreground shell/subagent when such foreground execution exists.
3. **Footer/manage key** — Answered: `alt+x` expands/manages the compact background footer/overlay.
4. **Expanded roster placement** — Answered: choose Option C, compact right-footer status plus overlay/manage view, not an inline roster for the first implementation slice.
5. **Right footer priority** — Resolved default: while background work exists, the background footer right slot wins over idle help text on narrow widths; idle help remains when no background work exists.
6. **Completion notifications** — Resolved default: Codex-style structured user-visible TUI/thread/overlay completion, not assistant-text injection.
7. **Default enablement/detail action** — Resolved default: keep background execution policy opt-in for slice one; `alt+x` opens the generalized existing jobs overlay/manage view.

## I-stage answers captured

- `visible_scope`: all background work should be represented (subagents, async bash, monitor, cron), not subagents only.
- `key_policy`: `ctrl+x` backgrounds the current foreground shell/subagent; `alt+x` expands/manages the background footer/overlay. Ctrl+B and Ctrl+E stay with editor/readline navigation.
- `roster_placement`: Option C selected — compact right footer only plus overlay/manage view for the first slice.
- `completion_visibility`: Codex-style structured user-visible completion in TUI/thread/overlay, not assistant text streaming. Failures remain visible until viewed.

## Roster placement mockups

### Option A — Jawcode-safe live-zone roster (recommended first slice)

Renders above the existing status line/editor cluster, inside the bottom-pinned live zone. This avoids changing constant composer/footer geometry.

```text
[chat / assistant output]

◌ 4 background jobs running · alt+j manage · ctrl+shift+b expand
● main                                                     ↑/↓ select · Enter view
○ executor     Background agent 1 - hello                         12s · ↑ 350
○ bash         bun test packages/coding-agent/test/foo.test.ts      9s · output
○ monitor      tail app.log                                      2m14s · 3 lines
○ cron         nightly docs refresh                              next 11m

────────────────────────────────────────────────────────────────
status line segments...
┌ composer ─────────────────────────────────────────────────────┐
│ user input                                                     │
└────────────────────────────────────────────────────────────────┘
 ? for shortcuts · /help for commands        4 background jobs running · ctrl+shift+b collapse
```

Pros: fits current `InteractiveMode` mount order (`liveToolContainer` → new background container → `statusContainer`), low TUI risk.
Cons: not exactly the Claude screenshot because the roster is above status/editor, not below the composer.

### Option B — Claude-like below-composer roster

Renders below the composer/footer. Closest to the screenshot.

```text
────────────────────────────────────────────────────────────────
status line segments...
┌ composer ─────────────────────────────────────────────────────┐
│ user input                                                     │
└────────────────────────────────────────────────────────────────┘
 ? for shortcuts · /help for commands        4 background jobs running · ctrl+shift+b collapse

● main                                                     ↑/↓ select · Enter view
○ executor     Background agent 1 - hello                         12s · ↑ 350
○ bash         bun test packages/coding-agent/test/foo.test.ts      9s · output
○ monitor      tail app.log                                      2m14s · 3 lines
```

Pros: visually matches Claude's newer inline roster.
Cons: changes the “composer footer is last line” invariant in `InteractiveMode`; higher risk with ViewportFill, resize, IME hints, and footer notices.

### Option C — Compact right footer only + overlay

No inline roster. Footer only:

```text
 ? for shortcuts · /help for commands        4 background jobs running · alt+x manage
```

Pros: smallest implementation.
Cons: does not satisfy the requested Claude-like expanded roster experience.

## Ctrl-key availability notes

Current default keymaps already occupy many plain Ctrl chords:

- TUI/editor: `ctrl+a`, `ctrl+b`, `ctrl+c`, `ctrl+d`, `ctrl+e`, `ctrl+f`, `ctrl+k`, `ctrl+u`, `ctrl+w`, `ctrl+y`, `ctrl+-`, `ctrl+_`, `ctrl+left`, `ctrl+right`, `ctrl+backspace`, `ctrl+]`, `ctrl+alt+]`.
- App: `ctrl+c`, `ctrl+d`, `ctrl+z`, `ctrl+p`, `shift+ctrl+p`, `ctrl+l`, `ctrl+o`, `ctrl+t`, `ctrl+shift+up`, `ctrl+up`, `ctrl+g`, `ctrl+enter`, `ctrl+v`, `ctrl+s`, `ctrl+r`.
- Technically unused plain Ctrl letters in the current repo defaults include `ctrl+n`, `ctrl+q`, `ctrl+x`; `ctrl+h`, `ctrl+i`, `ctrl+j`, and `ctrl+m` are poor defaults because many terminals alias them to backspace/tab/enter; `ctrl+q` can conflict with terminal flow control on some setups.
- Final key decision: `ctrl+x` is reserved for “send current foreground shell/subagent to background”; `alt+x` expands/manages the compact background footer/overlay. Keep existing `alt+j` as a compatibility alias only if it does not complicate the first slice.

## I-stage requirements completion

Requirements are sufficient for P-stage planning:

- Implement Option C first: compact footer/right-slot background status plus a generalized manage overlay.
- Visible background scope: task subagents, async bash, monitor jobs, and cron.
- Keybindings: `ctrl+x` for foreground-to-background; `alt+x` for background footer/overlay manage/expand.
- Footer priority: background status wins while jobs exist, especially on narrow widths; idle help remains otherwise.
- Completion policy: Codex-style structured TUI/thread/overlay completion, not assistant-text injection.
- First slice should surface existing background work and retain opt-in background execution policy; real detached terminal semantics can be planned as a later phase.

## I-stage reopened answers — 2026-06-15 round 2

The prior Option C / overlay-first P-plan is superseded by a more Claude-like footer expansion requirement.

- `slice_size`: user wants this work managed as a goal that may cycle PABCD multiple times. Do not force real detached terminal semantics into the first loop; split UI/footer expansion first, then foreground/background mechanics and real terminal behavior in later loops as needed.
- `alt_x_surface`: `alt+x` should expand the footer itself into a Claude-like bottom panel under the footer, with roughly three visible rows. This is not merely the existing jobs overlay.
- `footer_copy`: compact footer should replace the left footer text when background work exists; initial user copy idea is `bg 3sub · ...`, with a need to name other background work kinds compactly.
- `terminal_rows`: successful completed rows should disappear automatically; failed/cancelled rows remain visible. After the user sends one subsequent message, those terminal rows should clear.
- Existing key decision remains: `ctrl+x` sends foreground work to background; `alt+x` expands/collapses the background footer panel.
- Completion policy changes from “all completed/failed/cancelled remain until overlay acknowledgement” to “success auto-disappears; failed/cancelled remain until the next user message after visibility.”

## Round 2 open interview items

1. **Footer taxonomy** — decide compact names/counts for subagents, bash/background commands, monitors, cron, and queued work.
2. **Expanded panel exact topology** — decide whether the three rows render below the footer as the last screen lines, or above the composer/footer while visually attached to the footer. Below-footer is closest to Claude but changes Jawcode's composer-footer-last invariant.
3. **Row actions** — decide whether expanded rows are read-only in first slice or support selection/Enter/cancel.
4. **Goal decomposition** — decide first goal boundary before re-running P: footer expansion only vs footer expansion + generalized observer/model.

## I-stage reopened answers — 2026-06-15 round 3

- `compact_taxonomy`: footer compact copy uses per-kind suffixes, e.g. `bg 3sub 1sh 1cron`.
  - Initial taxonomy: `sub` = subagent/task, `sh` = async shell/bash, `mon` = monitor job, `cron` = cron schedule, `q` = queued background item if it cannot be represented under its concrete kind.
- `expanded_topology`: `alt+x` renders a real footer-below panel at the screen bottom, three rows visible, closest to the Claude screenshot. This intentionally changes the prior composer-footer-last invariant and must be planned/tested explicitly.
- `row_actions`: expanded rows support selection and `Enter` detail in the first implementation loop. Destructive cancel/stop can remain a later loop unless needed for detail parity.
- `first_goal_boundary`: split devlog plan into phase documents, each sized as an achievable PABCD cycle. The next P-stage should not preserve the obsolete overlay-only Option C plan as the implementation path; it should replan around footer-below expansion and phase decomposition.

## Revised I-stage sufficient requirements

Requirements are sufficient for a new P-stage plan:

- Overall goal: Claude/Codex-like background work visibility for Jawcode.
- First planning output should be phase-split devlog docs, not one monolithic implementation.
- First implementation cycle should target footer-below expansion connected to real background work state:
  - compact footer copy: `bg 3sub 1sh 1cron` style,
  - `alt+x`: expand/collapse three-row footer-below panel,
  - panel row selection + `Enter` detail,
  - success rows auto-disappear,
  - failed/cancelled rows remain until the user sends one subsequent message after they became visible,
  - no assistant prose injection for completion.
- Later cycles may handle `ctrl+x` real foreground-to-background mechanics and real detached terminal/PTY behavior.
