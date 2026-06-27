# 110 Phase 11 plan — lifecycle command parser

## Work-phase

Implement `10.033-A`: a JWC-native, pure Telegram lifecycle command parser.

This slice is intentionally inert. It parses a tiny command grammar into bounded intents and rejection reasons so future Telegram lifecycle work cannot invent command semantics at the runtime boundary.

## Source anchors

| Source | Evidence |
|---|---|
| Chase card | `struct_har/chase/10.033_gjc_chase_telegram_session_lifecycle.md` |
| Naming contract | `struct_har/chase/008_gjc_jwc_naming_contract.md` |
| Split doc | `devlog/_plan/260628_jwc_native_chase_implementation/41_phase4_telegram_lifecycle_split.md` |
| Prior superseded draft | `devlog/_plan/260628_jwc_native_chase_implementation/59_phase4_lifecycle_command_parser_plan.md` |
| Existing notification exports | `packages/coding-agent/src/notifications/index.ts` |
| Existing pure helper style | `packages/coding-agent/src/notifications/remote-answer.ts`, `packages/coding-agent/src/notifications/threaded-surface.ts`, `packages/coding-agent/src/notifications/workspace-path-confinement.ts` |
| Existing JWC safe session-id contract | `packages/coding-agent/src/harness-control-plane/storage.ts` (`SESSION_ID_RE`: `/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/`) |

## Allowed behavior

Parse only these command forms:

| Command | Parsed intent | Notes |
|---|---|---|
| `/sessions` | `list` | Optional surrounding whitespace only. |
| `/new` | `new` | No args in this slice. |
| `/close` | `close_current` | Only current mapped session; no arbitrary id. |
| `/resume <session-id>` | `resume` | Safe JWC session-id token only. |

Command names are case-insensitive. Bot suffixes such as `/sessions@BotName` are not supported in this slice and must be rejected.

## Rejection reasons

| Reason | Mapping |
|---|---|
| `empty_command` | Trimmed input is empty. |
| `unknown_command` | Command token does not start with `/`, command name is not one of the four supported commands, command has a bot suffix, or command token is only `/`. |
| `unexpected_arguments` | `/sessions`, `/new`, or `/close` has any argument; `/resume` has more than one argument. |
| `missing_session_id` | `/resume` has no argument. |
| `unsafe_session_id` | `/resume` argument fails the JWC safe session-id contract. |

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
	| "unsafe_session_id";

export type ParseNotificationLifecycleCommandResult =
	| { ok: true; intent: NotificationLifecycleCommandIntent }
	| { ok: false; reason: NotificationLifecycleCommandRejectionReason };

export function parseNotificationLifecycleCommand(input: string): ParseNotificationLifecycleCommandResult;
```

Implementation rules:

1. Trim leading/trailing whitespace.
2. Reject empty input with `empty_command`.
3. Split on one-or-more whitespace characters.
4. Accept command names case-insensitively.
5. Preserve accepted `sessionId` exactly.
6. Reject commands without a leading `/` with `unknown_command`.
7. Reject command tokens with `@` suffixes with `unknown_command`.
8. Reject `/sessions`, `/new`, and `/close` if extra args are present.
9. Reject `/resume` without an argument as `missing_session_id`.
10. Reject `/resume` with more than one argument as `unexpected_arguments`.
11. Accept session ids matching the existing JWC safe contract: `/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/`.
12. Reject session ids containing colon, slash, whitespace, shell metacharacters, leading dot, or more than 128 chars as `unsafe_session_id`.

### MODIFY `packages/coding-agent/src/notifications/index.ts`

Add one export line without deleting or reordering existing exports:

```ts
export * from "./lifecycle-command-parser";
```

The current file has exports for config, discovery, protocol, remote-answer, session-registry, threaded-surface, transport-shell, transport-state, and workspace-path-confinement. All must remain exported.

### NEW `packages/coding-agent/test/notifications-lifecycle-command-parser.test.ts`

Named test cases:

1. Parses `/sessions`, `/new`, `/close`, and `/resume safe-session_1`.
2. Trims whitespace and accepts case-insensitive command names.
3. Rejects empty input, missing slash, bare slash, bot suffix, and unknown commands with bounded reasons.
4. Rejects unexpected args on `/sessions`, `/new`, and `/close`.
5. Rejects missing or extra resume args.
6. Rejects unsafe resume ids with colon, slash, whitespace, shell metacharacters, leading dot, and overlength.
7. Verifies parser result JSON contains no prompt/cwd/env/model fields.

Expected focused pass count: 7 tests.

### MODIFY `struct_har/chase/10.033_gjc_chase_telegram_session_lifecycle.md`

Append `JWC Phase 11 Parser Evidence — 2026-06-28`:

- cite this devlog plan/build/check;
- cite new parser/test files;
- record that parser closes only the command-grammar sub-slice and no remote lifecycle done gate;
- keep `10.033` active because paired-chat authorization, idempotency ledger, read-only listing, create/resume/close execution, and process ownership remain open.

Prose template:

```md
## JWC Phase 11 Parser Evidence — 2026-06-28

Implemented only `10.033-A`: a pure parser for Telegram lifecycle command text into inert JWC intents and bounded rejection reasons.

Evidence:

- `devlog/_plan/260628_jwc_native_chase_implementation/110_phase11_lifecycle_command_parser_plan.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/111_phase11_lifecycle_command_parser_audit.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/112_phase11_lifecycle_command_parser_build.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/113_phase11_lifecycle_command_parser_check.md`
- `packages/coding-agent/src/notifications/lifecycle-command-parser.ts`
- `packages/coding-agent/test/notifications-lifecycle-command-parser.test.ts`

Status: still active. This does not implement Telegram daemon control, process create/close/resume, read-only listing, paired-chat authorization, idempotency ledger, or audit logging.
```

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/111_phase11_lifecycle_command_parser_audit.md`

Record:

- initial Backend FAIL and fixes applied;
- initial Docs FAIL and fixes applied;
- final Backend/Docs/Security-or-Architecture verdicts;
- exact remaining non-changes.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/112_phase11_lifecycle_command_parser_build.md`

Record:

- implementation files;
- parser API;
- named test cases and pass count;
- verifier findings;
- no runtime/Telegram/process/file I/O proof.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/113_phase11_lifecycle_command_parser_check.md`

Record:

- focused test output;
- `check:types` output;
- `git diff --check` output;
- staged file list;
- commit hash/message.

## Acceptance criteria

1. Parser is pure, deterministic, and has no side effects.
2. Parser never executes or authorizes lifecycle commands.
3. Grammar is narrow and bounded to four command forms.
4. Every invalid command maps to a bounded rejection reason.
5. Resume ids match JWC's safe session-id contract and cannot encode paths, shell fragments, colons, whitespace, or hidden-dot tokens.
6. Public export is available through `src/notifications/index.ts` without removing existing exports.
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
  devlog/_plan/260628_jwc_native_chase_implementation/110_phase11_lifecycle_command_parser_plan.md \
  devlog/_plan/260628_jwc_native_chase_implementation/111_phase11_lifecycle_command_parser_audit.md \
  devlog/_plan/260628_jwc_native_chase_implementation/112_phase11_lifecycle_command_parser_build.md \
  devlog/_plan/260628_jwc_native_chase_implementation/113_phase11_lifecycle_command_parser_check.md
```

Employee verification:

- Backend: parser safety, TypeScript contract, export integrity.
- Docs: chase/devlog consistency and no overclaim of remote lifecycle support.
- Security/Architecture: confirm this C4 lifecycle surface remains inert and does not create a runtime authorization gap.

## Commit plan

Commit only the files listed in this plan:

```sh
git commit -m "feat(notifications): add lifecycle command parser"
```
