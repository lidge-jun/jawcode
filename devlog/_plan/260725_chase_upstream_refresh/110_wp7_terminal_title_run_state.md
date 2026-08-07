# 110 — wp7 P: 20.102 terminal title run state

wp6's audit found 8 of the 15 roadmap bucket-A cards closed and 7 still active. wp7 takes the smallest and
most self-contained of the seven, `20.102` (OMP: error notifications + terminal run-state title), one card per
PABCD cycle per LOOP-UNIT-CHAIN-01.

> **Revised after A-audit (Helmholtz, FAIL → 6 MAJOR + 2 MINOR).** The first draft of this plan is corrected
> below rather than defended. The retracted claim is kept visible because it was the plan's central scoping
> error.

## Retracted claim: "the notification half is already satisfied"

The first draft asserted that the error-notification half of the card needed no work because
`event-controller.ts` gates its error toast behind `if (!event.success)` at `auto_retry_end`. That conflated
two different surfaces. An in-TUI `showError(...)` toast is not a **terminal notification**, and the audit
proved the gap with tree evidence:

| upstream behavior | JWC today | verdict |
|---|---|---|
| `2a328207d` error notifications opt-in | no `error.notify` key exists; only `completion.notify` (`settings-schema.ts:1208`) | **gap** |
| `90527a5ae` settled turn read from `agent_end` | no `sendErrorNotification` anywhere in `packages/coding-agent/src` | **gap** |
| `2a3b6856f` / `2c56d23e4` retry-toast suppression | `event-controller.ts:1032` toasts only on `!event.success` | satisfied for the **toast**, not for a notification |
| `f9e481baa` final retry error preserved | retry lifecycle closes at `agent-session.ts:2303` (success) / `2449` (terminal failure) | lifecycle present, notification absent |

Terminal notifications in JWC exist only for completion (`event-controller.ts:1164`) and ask
(`tools/ask.ts:524`). Absence of a feature is not parity.

## Scope decision: split the card, do not silently drop half

This cycle implements the **title run-state** half. The **error-notification** half is a genuinely separate
behavior (a new user-facing `error.notify` setting plus a notification send path), and folding it into the
same cycle would break one-card-one-unit discipline in the other direction — two unrelated product surfaces
in one B step.

So `20.102` does **not** close clean at the end of this cycle. It closes as `ADAPT — partial implementation,
tracked residual`, with the notification half recorded as an explicit residual and queued as its own cycle.
That is the honest disposition and it is what the repo's own closure-integrity gate requires of partial cards.

## Adapt, not import

Upstream's settled form is `8490654df`, which supersedes `997f2c5e8`'s prefix-glyph layout: the *separator*
between brand and label carries the state. That is the version to adapt, and it lands cleanly in JWC because
JWC's brand differs (`🦈`, not `π`) while the separator slot is brand-independent.

JWC-native decisions:

- Keep JWC's `DEFAULT_TERMINAL_TITLE = "🦈"`. No OMP vocabulary enters the tree.
- Setting key `tui.titleState`, default `true`, appearance/Display group — matching JWC's existing
  `tui.hyperlinks` neighborhood in `settings-schema.ts`.
- Spinner frames stay local to `title-generator.ts`: importing the theme's symbol set would create a
  `utils → modes` cycle.
- `timer.unref()` so a cosmetic animation never holds the event loop open.
- Dedup via `lastEmitted` so 80ms ticks do not spam OSC writes when nothing changed.

### Extension-override interaction (fork-specific)

JWC's `extension-ui-controller.ts:58` exposes `setTitle: title => setTerminalTitle(title)`. With a spinner
running, a raw `setTerminalTitle` would be clobbered by the next tick. Upstream solved this with an
`extensionOverride` slot that owns the title verbatim until the app next sets an authoritative session title.
JWC needs the same slot, wired to its own extension controller.

### Settings shape (audit MINOR 1, corrected)

The draft copied upstream's `group: "Display"` metadata. JWC's `UiBase` (`settings-schema.ts:108`) supports
only `tab`, `label`, `description`, `condition` — `group:` appears **zero times** in the file. The key must be
flat, matching its `tui.hyperlinks` neighbour:

```ts
"tui.titleState": {
    type: "boolean",
    default: true,
    ui: { tab: "appearance", label: "…", description: "…" },
}
```

## Owner paths

- `packages/coding-agent/src/utils/title-generator.ts` — state machine, composition, spinner, dedup, override
- `packages/coding-agent/src/config/settings-schema.ts` — `tui.titleState`
- `packages/coding-agent/src/modes/controllers/event-controller.ts` — attention ownership + transitions
- `packages/coding-agent/src/modes/interactive-mode.ts` — enable from settings, disposal ordering
- `packages/coding-agent/src/modes/controllers/extension-ui-controller.ts` — override + session-change resync
- `packages/coding-agent/test/terminal-title-state.test.ts` — new focused runtime test
- `packages/coding-agent/CHANGELOG.md` — `## [Unreleased]` entry

## Attention ownership (audit MAJOR 2 + 3)

The draft's "ask end → working" transition reintroduces exactly the bug upstream fixed in `e1e5e0b53`. JWC
runs shared tools concurrently — `agent-loop.ts:1217` collects `sharedTasks` and awaits `Promise.allSettled`
— so two `ask` calls can be outstanding at once, and the first to resolve would clear attention while the
second still blocks the user.

Required: a `#titleAttentionToolCallIds: Set<string>` on the EventController (`#private` per AGENTS.md).

| event | action |
|---|---|
| `agent_start` | clear the set, state `working` |
| `tool_execution_start`, `toolName === "ask"` | add `toolCallId`; state `attention` |
| `tool_execution_end`, `toolName === "ask"` | delete `toolCallId`; return to `working` **only when the set is empty** |
| `agent_end` when `!session.isStreaming` | clear the set, state `idle` |

Plan approval is JWC-native and arrives differently: `resolve` with `sourceToolName === "plan_approval"`
(`event-controller.ts:842`) hands off to a blocking selector (`interactive-mode.ts:2021`). Upstream's
`tools.approvalMode` API does not exist in JWC, so its approval code is **non-applicable**, not omitted. JWC's
own approval path gets attention through the same set, keyed by the resolve tool call id, so nested prompts
compose instead of racing.

## Teardown (audit MAJOR 4)

`shutdown()` currently runs `popTerminalTitle()` *then* `this.stop()` (`interactive-mode.ts:2143`, `2144`).
So placing disposal only inside `stop()` would fire **after** the shell was handed back — the exact leak the
draft claimed to prevent. Disposal must be:

1. explicit in `shutdown()` immediately **before** `popTerminalTitle()`;
2. also in `stop()` (`interactive-mode.ts:2079`) so direct-stop paths cannot leave a timer running;
3. idempotent, so the double call is harmless.

`timer.unref()` keeps the process from being held open but does not cancel a pending tick during async crash
cleanup, so idempotent disposal is the actual guard.

## Extension override and session changes (audit MAJOR 5)

`extension-ui-controller.ts:58` routes `setTitle` to a raw `setTerminalTitle`, which a spinner tick would
clobber. The override slot fixes that, but the draft's clearing inventory was incomplete: the extension
command-action `newSession` (`extension-ui-controller.ts:394`) and `switchSession` (`:474`) paths do not
refresh the title today, so an override could survive into a different session. Both get an authoritative
`setSessionTerminalTitle` on success, which clears the override and resyncs the label.

## Verification (audit MAJOR 6)

Pure composition tests alone prove nothing about the runtime, so the focused test covers both layers:

- **Pure**: `buildTerminalTitleWithState` → idle `🦈 > label`, working `🦈 ⠋ label` advancing with frame,
  attention `🦈 ! label`, disabled `🦈: label`, labelless `🦈 >`.
- **Runtime**: force `process.stdout.isTTY`, spy on `stdout.write`, fake timers — assert dedup suppresses
  unchanged ticks, the spinner advances while `working`, `disposeTerminalTitleState()` stops further writes,
  an extension override survives a tick, and an authoritative session title clears it.
- **Attention ownership**: two concurrent `ask` ids — the first end must NOT restore `working`; the last one must.

Then `check:ts`, the existing `title-generator.test.ts` (which does not assert terminal formatting, so it
should stay green — verified, not assumed), and the four required gates.

## Not in scope

`packages/tui/src/tui.ts` and `modes/components/welcome.ts` are user-curated and untouched. The terminal title
is an OSC escape to the host terminal, not JWC's rendered visual identity.

The auditor independently confirmed this distinction is legitimate against `AGENTS.md:144` — the protected
list names the welcome banner, the scroll model, and tool-folding defaults, none of which this cycle touches.

## Residual carried out of this cycle

- `20.102` closes **ADAPT — partial**: opt-in terminal error notifications (`error.notify` + a settled
  `agent_end` send path with retry suppression) remain open and get their own cycle.
