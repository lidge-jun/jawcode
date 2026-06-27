# 10 Phase 1 build — notification foundation

## Implemented

This phase implemented the JWC-native notification foundation for `10.028` and `10.029`.

## Source paths changed

| Path | Change |
|---|---|
| `packages/coding-agent/src/notifications/config.ts` | Added typed resolver, JWC/GJC env dual-read, token/chat masking, status JSON conversion. |
| `packages/coding-agent/src/notifications/discovery.ts` | Added `.jwc/state/notifications` discovery helpers with safe session IDs, `0700` directory, `0600` atomic file writes, masked display shape. |
| `packages/coding-agent/src/notifications/protocol.ts` | Added minimal notification protocol frame types. |
| `packages/coding-agent/src/notifications/index.ts` | Added notification module barrel. |
| `packages/coding-agent/src/cli/notify-cli.ts` | Added `status` and non-interactive `setup` handlers without live Telegram calls. |
| `packages/coding-agent/src/commands/notify.ts` | Added lazy CLI command wrapper. |
| `packages/coding-agent/src/cli.ts` | Registered `notify` in `baseCommands`. |
| `packages/coding-agent/src/config/settings-schema.ts` | Added `notifications.*` settings. |
| `schemas/config.schema.json` | Regenerated settings schema. |
| `packages/coding-agent/test/notifications-config.test.ts` | Added resolver/masking tests. |
| `packages/coding-agent/test/notifications-discovery.test.ts` | Added discovery shape/path/permission tests. |
| `packages/coding-agent/test/notify-cli.test.ts` | Added notify setup/status masking tests. |
| `packages/coding-agent/test/cli-command-surface.test.ts` | Added `notify` to expected base command list. |

## Explicitly deferred

- Loopback WebSocket server.
- Remote ask/reply race semantics.
- Session startup/shutdown wiring.
- Telegram Bot API daemon and inbound updates.
- Threaded rendering.
- Session lifecycle control.
- Media/file transfer.
- User-facing Telegram onboarding docs.

## Current verification

Passing:

```sh
bun test packages/coding-agent/test/notifications-config.test.ts packages/coding-agent/test/notifications-discovery.test.ts packages/coding-agent/test/notify-cli.test.ts
bun run check:schemas
bun run check:types   # from packages/coding-agent
```

Known unrelated failures:

- Full `bun run check:tools` still fails on pre-existing formatter issues in unrelated files such as `packages/coding-agent/src/jwc-runtime/goal-engine.ts`, `packages/coding-agent/src/jwc-runtime/team-runtime.ts`, `packages/coding-agent/src/jwc-runtime/tmux-sessions.ts`, `packages/coding-agent/src/tools/ast-edit.ts`, and older tests. The notification files no longer appear in that failure list after targeted Biome formatting.
- `cli-command-surface.test.ts` subprocess help cases fail under the current local Bun `1.3.11` because the CLI requires Bun `>=1.3.14`. The new notification tests do not depend on those subprocess help cases.
