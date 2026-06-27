# 10 Phase 1 check — notification foundation

## Fresh verification

Focused notification tests:

```sh
bun test packages/coding-agent/test/notifications-config.test.ts packages/coding-agent/test/notifications-discovery.test.ts packages/coding-agent/test/notify-cli.test.ts
```

Result:

```text
13 pass
0 fail
39 expect() calls
```

Schema check:

```sh
bun run check:schemas
```

Result: pass.

Package type check:

```sh
cd packages/coding-agent && bun run check:types
```

Result: pass.

Whitespace check:

```sh
git diff --check
```

Result: pass.

## Known unrelated failures

`bun run check:tools` still fails on pre-existing formatter issues outside this slice:

- `packages/coding-agent/src/jwc-runtime/goal-engine.ts`
- `packages/coding-agent/src/jwc-runtime/team-runtime.ts`
- `packages/coding-agent/src/jwc-runtime/tmux-sessions.ts`
- `packages/coding-agent/src/tools/ast-edit.ts`
- older tests such as `agent-session-auto-compaction-queue.test.ts`, `agent-session-queued-steer-delivery.test.ts`, and `assistant-message-cache.test.ts`

The new notification files no longer appear in the `check:tools` failure list after targeted Biome formatting.

`packages/coding-agent/test/cli-command-surface.test.ts` subprocess help tests fail on this host because local Bun is `1.3.11` while the CLI requires `>=1.3.14`. The static `baseCommands` assertion for `notify` passes, and the notification-specific tests do not depend on subprocess help.

## Reviewer result

Docs verification returned DONE for chase/devlog accuracy.

Backend first verification returned NEEDS_FIX for missing connect-time token rejection helper/tests. Fixed by adding:

- `isNotificationConnectTokenAccepted()` in `packages/coding-agent/src/notifications/config.ts`
- token accept/reject tests in `packages/coding-agent/test/notifications-config.test.ts`

Final Backend re-verification pending.
