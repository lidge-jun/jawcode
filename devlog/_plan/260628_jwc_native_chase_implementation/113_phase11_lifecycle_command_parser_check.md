# 113 Phase 11 check — lifecycle command parser

## Local checks

Focused tests:

```text
bun test packages/coding-agent/test/notifications-lifecycle-command-parser.test.ts
7 pass
0 fail
28 expect() calls
```

Typecheck:

```text
cd packages/coding-agent && bun run check:types
$ tsgo -p tsconfig.json --noEmit
exit 0
```

Diff check:

```text
git diff --check -- packages/coding-agent/src/notifications/lifecycle-command-parser.ts packages/coding-agent/src/notifications/index.ts packages/coding-agent/test/notifications-lifecycle-command-parser.test.ts struct_har/chase/10.033_gjc_chase_telegram_session_lifecycle.md devlog/_plan/260628_jwc_native_chase_implementation/59_phase4_lifecycle_command_parser_plan.md devlog/_plan/260628_jwc_native_chase_implementation/110_phase11_lifecycle_command_parser_plan.md devlog/_plan/260628_jwc_native_chase_implementation/111_phase11_lifecycle_command_parser_audit.md devlog/_plan/260628_jwc_native_chase_implementation/112_phase11_lifecycle_command_parser_build.md devlog/_plan/260628_jwc_native_chase_implementation/113_phase11_lifecycle_command_parser_check.md
exit 0
```

## Employee verification

- Backend: DONE. Verified pure parser, safe session-id contract, additive export, focused tests, typecheck, and diff check.
- Docs: DONE. Verified 59 superseded, 110-113 canonical sequence, parser-only chase evidence, active card status, naming preservation, and no lifecycle overclaim.

## Commit

Staged files:

```text
devlog/_plan/260628_jwc_native_chase_implementation/110_phase11_lifecycle_command_parser_plan.md
devlog/_plan/260628_jwc_native_chase_implementation/111_phase11_lifecycle_command_parser_audit.md
devlog/_plan/260628_jwc_native_chase_implementation/112_phase11_lifecycle_command_parser_build.md
devlog/_plan/260628_jwc_native_chase_implementation/113_phase11_lifecycle_command_parser_check.md
devlog/_plan/260628_jwc_native_chase_implementation/59_phase4_lifecycle_command_parser_plan.md
packages/coding-agent/src/notifications/index.ts
packages/coding-agent/src/notifications/lifecycle-command-parser.ts
packages/coding-agent/test/notifications-lifecycle-command-parser.test.ts
struct_har/chase/10.033_gjc_chase_telegram_session_lifecycle.md
```

Commit:

```text
78df89f feat(notifications): add lifecycle command parser
```
