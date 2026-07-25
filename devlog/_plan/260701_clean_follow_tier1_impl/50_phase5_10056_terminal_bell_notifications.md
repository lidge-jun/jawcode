# 50 Phase 5 — 10.056 terminal bell notifications + completion hook

## Part 1 — outcome

Close chase card `10.056` by adapting the GJC terminal-bell and completion-notify hook into JWC's current notification path. This is an opt-in local UX feature: completion notifications can ring the terminal bell, ask/approval UI can ring the bell, and a user-level completion command can run after a successful turn. The hook is deliberately read from user/global settings only, not project/runtime overrides, so a repository cannot silently activate an arbitrary local command.

## Current evidence

| area | current JWC fact | source |
|---|---|---|
| desktop notification exists | `EventController.sendCompletionNotification()` sends `TERMINAL.sendNotification()` only when backgrounded and `completion.notify` is on. | `packages/coding-agent/src/modes/controllers/event-controller.ts` |
| abort guard exists | Existing tests cover no completion notification for `stopReason === "aborted"` / `"error"`. | `packages/coding-agent/test/modes/controllers/event-controller-abort-guard.test.ts` |
| bell settings absent | `settings-schema.ts` has `completion.notify` but no `notifications.terminalBell` / per-event bell settings and no `completion.notifyCommand`. | `packages/coding-agent/src/config/settings-schema.ts` |
| global-only read absent | `Settings` has merged `get`, persisted `set`, and runtime `override`, but no API to read only user/global config. | `packages/coding-agent/src/config/settings.ts` |
| bell utility absent | No JWC `terminal-bell.ts` utility exists. | `packages/coding-agent/src/modes/utils/` |
| schema generated | Config schema is generated from `SETTINGS_SCHEMA`; settings changes require `schemas/config.schema.json` regeneration. | `scripts/generate-json-schemas.ts` |

## Source decisions

| upstream anchor | decision | JWC adaptation |
|---|---|---|
| `06dca0e2` terminal bell notifications | ADAPT | Add opt-in `notifications.terminalBell` plus per-event booleans; ring on successful completion and hook selector ask/approval prompts. Keep the terminal bell best-effort and non-throwing. |
| `4842c5cb` guard settings access | IMPORT (adapted) | Bell utility catches missing/uninitialized settings and returns disabled so component-level tests or early UI paths never throw. |
| `2bdb0858` completion notify command | ADAPT | Add `completion.notifyCommand`, but expose JWC-authored `JWC_NOTIFICATION_*` env variables. Read it from user/global config only via a new `Settings.getGlobal()` helper; project/runtime overrides cannot activate commands. |
| upstream README/docs additions | REJECT for product docs in this card | Existing JWC docs do not document `completion.notify`; update schema and chase docs only. Public docs can be added later if the setting surface gets a settings-guide page. |

## Implementation plan

### New file

`packages/coding-agent/src/modes/utils/terminal-bell.ts`

- Export `TerminalBellEvent = "complete" | "approval" | "ask"`.
- Export `ringTerminalBell(event, output = process.stdout)`:
  - read `notifications.terminalBell` and the relevant per-event setting with a guarded helper;
  - write BEL (`"\x07"`) only when enabled;
  - catch write/settings errors because bells are best-effort local notifications.
- Export `classifyHookSelectorBellEvent(title)`:
  - approval-like titles (`approval`, `approve`, `plan ready`) map to `"approval"`;
  - all other selector prompts map to `"ask"`.

### Modified source

`packages/coding-agent/src/config/settings-schema.ts`

- Add interaction settings:
  - `notifications.terminalBell` boolean default `false`;
  - `notifications.bellOnComplete` boolean default `true`;
  - `notifications.bellOnApproval` boolean default `true`;
  - `notifications.bellOnAsk` boolean default `true`;
  - `completion.notifyCommand` string default `""`.
- User-facing description must name `JWC_NOTIFICATION_*`, not upstream `GJC_NOTIFICATION_*`.

`packages/coding-agent/src/config/settings.ts`

- Add `getGlobal<P extends SettingPath>(path: P): SettingValue<P> | undefined`.
- It reads `#global` only and does not fall back to defaults, project settings, or runtime overrides.
- This is the security boundary for local command hooks.

`packages/coding-agent/src/modes/controllers/event-controller.ts`

- Import `logger` from `@jawcode-dev/utils` and `ringTerminalBell` from `../utils/terminal-bell`.
- Add small local helpers:
  - completion command timeout constant (`10_000ms`);
  - `CompletionNotifyPayload`;
  - platform shell wrapper (`cmd.exe /d /s /c` on Windows, `/bin/sh -c` otherwise);
  - null-byte-stripping/truncation for env values;
  - payload env builder using `JWC_NOTIFICATION_*`;
  - text summary extraction from assistant text content.
- Change `sendCompletionNotification()`:
  - keep `completion.notify=off` and aborted/error guards;
  - split foreground behavior: desktop terminal notification remains background-only, but user command hook may still run on successful completion;
  - ring terminal bell on successful completion when enabled;
  - run the global-only completion notify command with payload env, detached/unref'd, timeout-killed, and logged failures.

`packages/coding-agent/src/modes/controllers/extension-ui-controller.ts`

- Import `classifyHookSelectorBellEvent` and `ringTerminalBell`.
- Call `ringTerminalBell(classifyHookSelectorBellEvent(title))` before presenting a `HookSelectorComponent`.
- Keep ask/approval bell purely local; no remote notification path changes.

`schemas/config.schema.json`

- Regenerate from `SETTINGS_SCHEMA` after implementation.

### Modified tests

`packages/coding-agent/test/terminal-bell.test.ts` (new)

- Verify terminal bell is opt-in by default.
- Verify ask/approval events ring when enabled.
- Verify per-event toggles are honored.
- Verify missing/uninitialized settings do not throw and do not ring.
- Verify approval-like titles classify separately from generic ask prompts.

`packages/coding-agent/test/modes/controllers/event-controller-abort-guard.test.ts`

- Extend the fake session manager with `getCwd()` and `getSessionId()`.
- Add completion bell tests:
  - successful completion rings when global bell settings are enabled;
  - completion bell does not ring when disabled.
- Add completion command tests:
  - global `settings.set("completion.notifyCommand", "...")` spawns once with `JWC_NOTIFICATION_*` env;
  - foreground successful completion skips desktop notification but still runs the user command;
  - runtime/project override via `settings.override("completion.notifyCommand", "...")` does not run a command.

## Documentation closure plan

After code verification:

- Move `struct_har/chase/10.056_gjc_chase_terminal_bell_notifications.md` to `struct_har/chase/_fin/10/10.056_gjc_chase_terminal_bell_notifications.md`.
- Update:
  - `struct_har/chase/10_gjc_chase_MOC.md`;
  - `struct_har/chase/007_follow_index.md`;
  - `struct_har/chase/002_gap_inventory.md`;
  - `struct_har/chase/10.001_gjc_chase_cycle.md`;
  - `struct_har/chase/_fin/INDEX.md`.
- Record ADAPT/IMPORT decisions, JWC env naming, global-only command safety, and verification evidence in the moved card.

## Verification plan

Focused commands:

```sh
bun test packages/coding-agent/test/terminal-bell.test.ts
bun test packages/coding-agent/test/modes/controllers/event-controller-abort-guard.test.ts
bun scripts/generate-json-schemas.ts --check
```

Broad gates:

```sh
bun run check:ts
git diff --check
```

Review gate:

- Dispatch Backend as the read-only A-phase plan auditor.
- Dispatch Backend again after implementation for integration/security-boundary verification before C.

## Residual exclusions

- Do not implement Telegram/remote notification changes; 10.028-10.035 already own that stack.
- Do not add public README/docs unless an existing JWC settings-guide owner is found.
- Do not expose upstream `GJC_NOTIFICATION_*` for this new public hook surface.
- Do not change `completion.notify` default or desktop notification foreground behavior.
