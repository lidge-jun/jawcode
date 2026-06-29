# 20 Phase 2 check — Telegram transport shell

## Local verification

```sh
bun test packages/coding-agent/test/notifications-transport-state.test.ts packages/coding-agent/test/notifications-transport-shell.test.ts
# 8 pass, 0 fail, 28 expect() calls
```

```sh
bun test packages/coding-agent/test/notifications-config.test.ts packages/coding-agent/test/notifications-discovery.test.ts packages/coding-agent/test/notify-cli.test.ts
# 13 pass, 0 fail, 39 expect() calls
```

```sh
bun run check:schemas
# pass
```

```sh
cd packages/coding-agent && bun run check:types
# pass
```

```sh
git diff --check
# pass
```

```sh
bunx biome check packages/coding-agent/src/notifications/transport-state.ts packages/coding-agent/src/notifications/transport-shell.ts packages/coding-agent/src/notifications/index.ts packages/coding-agent/test/notifications-transport-state.test.ts packages/coding-agent/test/notifications-transport-shell.test.ts --write
# Checked 5 files. No fixes applied.
```

## Employee verification

| Reviewer | Verdict | Notes |
|---|---|---|
| Backend | DONE | Confirmed agentDir versus `.jwc/state` split, no `idleTimeoutMs` heartbeat mapping, safe-read/fail-closed scanner, no raw token/chat leak, no network poller/public daemon CLI/compiled entrypoint, tests cover planned behavior. |
| Docs | DONE | Confirmed audit/build/chase artifacts are accurate, `10.030` stays active, done gates remain unchecked, and JWC naming boundary is preserved. |

## Known unrelated state

- `devlog/.gitignore` was already modified before this phase.
- `devlog/_tmp/` was already untracked before this phase.

## Commit

Pending C-stage atomic commit for Phase 2 files only.
