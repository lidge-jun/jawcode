# 112 Phase 11 build — lifecycle command parser

## Files changed

| File | Change |
|---|---|
| `packages/coding-agent/src/notifications/lifecycle-command-parser.ts` | Added pure parser and bounded intent/rejection types. |
| `packages/coding-agent/src/notifications/index.ts` | Added additive barrel export. |
| `packages/coding-agent/test/notifications-lifecycle-command-parser.test.ts` | Added focused parser tests. |
| `struct_har/chase/10.033_gjc_chase_telegram_session_lifecycle.md` | Added parser-only evidence and kept card active. |
| `devlog/_plan/260628_jwc_native_chase_implementation/59_phase4_lifecycle_command_parser_plan.md` | Marked superseded. |
| `devlog/_plan/260628_jwc_native_chase_implementation/110_phase11_lifecycle_command_parser_plan.md` | Added corrected plan. |
| `devlog/_plan/260628_jwc_native_chase_implementation/111_phase11_lifecycle_command_parser_audit.md` | Recorded audit results. |
| `devlog/_plan/260628_jwc_native_chase_implementation/112_phase11_lifecycle_command_parser_build.md` | This build record. |

## Parser API

`parseNotificationLifecycleCommand(input: string)` returns:

- `{ ok: true, intent: { kind: "list" } }`
- `{ ok: true, intent: { kind: "new" } }`
- `{ ok: true, intent: { kind: "close_current" } }`
- `{ ok: true, intent: { kind: "resume", sessionId } }`
- `{ ok: false, reason }` for bounded rejection reasons.

## Tests

Focused test file:

- `packages/coding-agent/test/notifications-lifecycle-command-parser.test.ts`

Named cases:

1. Supported intents.
2. Whitespace trim and case-insensitive commands.
3. Empty, missing slash, bare slash, bot suffix, and unknown commands.
4. Unexpected args on non-argument commands.
5. Missing/extra resume args.
6. Unsafe resume session ids.
7. No prompt/cwd/env/model fields in parser result JSON.

Expected focused pass count: 7.

## Inert proof

The implementation imports no Node runtime modules, performs no file/network/process I/O, and only returns data. It does not authorize, execute, list, create, close, or resume sessions.
