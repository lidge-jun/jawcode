# 59 Phase 4 plan — lifecycle command parser (superseded)

> Superseded by `110_phase11_lifecycle_command_parser_plan.md`.
> Backend and Docs audit found that this draft reused `59_` for audit/build/check artifacts, used a stale `index.ts` before/after anchor, allowed `:` in session ids contrary to JWC's existing safe id contract, and declared `unsupported_command_shape` without a mapping.
> Do not implement from this draft.

## Work-phase

Implement `10.033-A`: a JWC-native, pure Telegram lifecycle command parser.

This slice is intentionally inert. It parses a tiny command grammar into bounded intents and rejection reasons so future Telegram lifecycle work cannot invent command semantics at the runtime boundary.

## Source anchors

| Source | Evidence |
|---|---|
| Chase card | `struct_har/chase/10.033_gjc_chase_telegram_session_lifecycle.md` |
| Split doc | `devlog/_plan/260628_jwc_native_chase_implementation/41_phase4_telegram_lifecycle_split.md` |
| Existing notification exports | `packages/coding-agent/src/notifications/index.ts` |
| Existing pure helper style | `packages/coding-agent/src/notifications/remote-answer.ts`, `packages/coding-agent/src/notifications/threaded-surface.ts` |

## Allowed behavior

Parse only these command forms:

| Command | Parsed intent | Notes |
|---|---|---|
| `/sessions` | `list` | Optional trailing whitespace only. |
| `/new` | `new` | No args in this slice. |
| `/close` | `close_current` | Only current mapped session; no arbitrary id. |
| `/resume <session-id>` | `resume` | Safe session-id token only. |

## Rejection reasons

Parser returns bounded reason codes only:

- `empty_command`
- `unknown_command`
- `unexpected_arguments`
- `missing_session_id`
- `unsafe_session_id`
- `unsupported_command_shape`

## Explicit non-changes

- No Telegram Bot API calls.
- No daemon control, process spawn, process close, resume execution, shell command, cwd/profile/model/env handling, or file I/O.
- No read-only session list implementation.
- No audit ledger schema yet.
- No live inbound routing or chat authorization; those are runtime/security slices.
- No upstream GJC code copy; source anchors are behavioral evidence only.

## File plan

### NEW `packages/coding-agent/src/notifications/lifecycle-command-parser.ts`

Exports:

```ts
export type NotificationLifecycleCommandIntent =
	| { kind: "list" }
	| { kind: "new" }
	| { kind: "close_current" }
	| { kind: "resume"; sessionId: string };

export type NotificationLifecycleCommandRejectionReason =
	| "empty_command"
	| "unknown_command"
	| "unexpected_arguments"
	| "missing_session_id"
	| "unsafe_session_id"
	| "unsupported_command_shape";

export type ParseNotificationLifecycleCommandResult =
	| { ok: true; intent: NotificationLifecycleCommandIntent }
	| { ok: false; reason: NotificationLifecycleCommandRejectionReason };

export function parseNotificationLifecycleCommand(input: string): ParseNotificationLifecycleCommandResult;
```

Implementation rules:

1. Trim leading/trailing whitespace.
2. Reject empty input with `empty_command`.
3. Accept command names case-insensitively, but preserve `sessionId` exactly.
4. Reject commands without a leading `/` with `unknown_command`.
5. Reject `/sessions`, `/new`, and `/close` if extra args are present.
6. Reject `/resume` without an argument as `missing_session_id`.
7. Reject `/resume` with more than one argument as `unexpected_arguments`.
8. Accept session ids matching `/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/`.
9. Reject session ids containing slash, whitespace, shell metacharacters, leading dot, or more than 128 chars as `unsafe_session_id`.

### MODIFY `packages/coding-agent/src/notifications/index.ts`

Before:

```ts
export * from "./threaded-surface";
export * from "./transport-shell";
```

After:

```ts
export * from "./lifecycle-command-parser";
export * from "./threaded-surface";
export * from "./transport-shell";
```

### NEW `packages/coding-agent/test/notifications-lifecycle-command-parser.test.ts`

Coverage:

1. Parses `/sessions`, `/new`, `/close`, and `/resume safe-session_1`.
2. Trims whitespace and accepts case-insensitive command names.
3. Rejects empty input, missing slash, and unknown commands.
4. Rejects unexpected args on `/sessions`, `/new`, and `/close`.
5. Rejects missing or extra resume args.
6. Rejects unsafe resume ids with slash, whitespace, shell metacharacters, leading dot, and overlength.
7. Verifies parser result JSON contains no prompt/cwd/env/model fields.

### MODIFY `struct_har/chase/10.033_gjc_chase_telegram_session_lifecycle.md`

Append `JWC Phase 4A Parser Evidence — 2026-06-28`:

- cite this devlog plan/build/check;
- cite new parser/test files;
- record that parser closes only the command-grammar sub-slice and no remote lifecycle done gate;
- keep `10.033` active because paired-chat authorization, idempotency ledger, read-only listing, create/resume/close execution, and process ownership remain open.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/59_phase4_lifecycle_command_parser_audit.md`

Record Backend/Docs audit verdicts and any plan fixes.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/59_phase4_lifecycle_command_parser_build.md`

Record implementation summary, changed files, and verifier findings.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/59_phase4_lifecycle_command_parser_check.md`

Record final checks and commit evidence.

## Acceptance criteria

1. Parser is pure, deterministic, and has no side effects.
2. Parser never executes or authorizes lifecycle commands.
3. Grammar is narrow and bounded to four command forms.
4. Every invalid command maps to a bounded rejection reason.
5. Resume ids cannot encode paths, shell fragments, whitespace, or hidden-dot tokens.
6. Public export is available through `src/notifications/index.ts`.
7. `10.033` chase card clearly remains active with only parser evidence added.

## Verification plan

```sh
bun test packages/coding-agent/test/notifications-lifecycle-command-parser.test.ts
cd packages/coding-agent && bun run check:types
git diff --check -- \
  packages/coding-agent/src/notifications/lifecycle-command-parser.ts \
  packages/coding-agent/src/notifications/index.ts \
  packages/coding-agent/test/notifications-lifecycle-command-parser.test.ts \
  struct_har/chase/10.033_gjc_chase_telegram_session_lifecycle.md \
  devlog/_plan/260628_jwc_native_chase_implementation/59_phase4_lifecycle_command_parser_plan.md \
  devlog/_plan/260628_jwc_native_chase_implementation/59_phase4_lifecycle_command_parser_audit.md \
  devlog/_plan/260628_jwc_native_chase_implementation/59_phase4_lifecycle_command_parser_build.md \
  devlog/_plan/260628_jwc_native_chase_implementation/59_phase4_lifecycle_command_parser_check.md
```

Employee verification:

- Backend: parser safety and TypeScript contract.
- Docs: chase/devlog consistency and no overclaim of remote lifecycle support.

## Commit plan

Commit only the files listed in this plan:

```sh
git commit -m "feat(notifications): add lifecycle command parser"
```
