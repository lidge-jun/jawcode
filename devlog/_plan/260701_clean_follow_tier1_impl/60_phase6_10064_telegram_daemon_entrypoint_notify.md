# 60_phase6_10064_telegram_daemon_entrypoint_notify

## PABCD phase

- Card: `10.064_gjc_chase_telegram_daemon_entrypoint_notify`
- Classification: C3 product-runtime/release packaging slice, clean-follow ADAPT.
- Source anchors: GJC `d00cbe2c` compiled Telegram daemon entrypoint startup; GJC `308d4a20` Windows Terminal bell workaround docs.
- JWC posture: do not expose a public `jwc daemon` surface in this slice. Add a hidden `jwc notify daemon-internal` adapter for the already-shipped JWC `runManagedDaemon` runtime, and document Windows Terminal BEL limitations through existing JWC notification settings.

## Part 1: user-level change

JWC already has the managed Telegram daemon logic from 10.030, but it lacks a compiled-binary command path that can start or smoke-check that runtime. This slice adds a hidden `jwc notify daemon-internal` entrypoint that loads `.jwc` settings, refuses to leak Telegram secrets, and can be smoke-tested without network access. It also updates terminal bell help/docs so Windows Terminal users are directed to a `completion.notifyCommand` PowerShell beep workaround when BEL is silent. No public daemon-management command is introduced.

## Part 2: diff-level plan

### NEW: `packages/coding-agent/src/notifications/daemon-cli.ts`

Purpose: hidden adapter for `jwc notify daemon-internal`.

Planned exports:

```ts
export interface NotifyDaemonInternalOptions {
  argv: string[];
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  pidAlive?: (pid: number) => boolean;
}

export function parseDaemonInternalArgs(argv: string[]): ParsedDaemonInternalArgs;
export async function runDaemonInternal(options: NotifyDaemonInternalOptions): Promise<void>;
export async function runDaemonSmoke(options?: { agentDir?: string }): Promise<void>;
```

Planned behavior:

- Supported flags: `--smoke`, `--agent-dir <dir>`, `--owner-id <id>`, `--max-ticks <n>`.
- `--smoke` creates the JWC transport directory through `transportPaths(agentDir)`, creates and removes a private temporary `.smoke` file, then exits without reading tokens or calling network.
- Non-smoke mode:
  - requires `--owner-id`;
  - initializes settings unconditionally with `Settings.init(agentDir ? { agentDir } : {})`, so omitted `--agent-dir` falls back to the normal JWC agent dir instead of reading the singleton before init;
  - parses a process id from owner IDs shaped like `<pid>` or `<pid>-...` and exits before daemon startup when that owner process is already dead;
  - resolves notification config through `getNotificationConfig(settings)`;
  - returns quietly when notifications are not configured/enabled;
  - calls `runManagedDaemon({ agentDir: settings.getAgentDir(), token: config.botToken, chatId: config.chatId, ownerId, pid: process.pid, maxTicks })` after `config.botToken` and `config.chatId` are proven present;
  - never prints raw bot tokens or chat IDs.
- This file is the compiled daemon entrypoint listed in both build scripts.
- Imports inside this file use sibling module paths (`./config`, `./daemon-runtime`, `./transport-state`) rather than redundant `../notifications/*` paths.

### MODIFY: `packages/coding-agent/src/cli/notify-cli.ts`

Before:

```ts
export type NotifyAction = "status" | "setup" | "verify";
```

After:

```ts
export type NotifyAction = "status" | "setup" | "verify" | "daemon-internal";
```

Add a `daemon-internal` branch in `runNotifyCommand` that delegates to `runDaemonInternal`. Use a top-level import from `../notifications/daemon-cli` to comply with the repo-local no-inline-import rule. Keep setup/status/verify behavior unchanged.

Also extend the command shape:

```ts
export interface NotifyCommandArgs {
  action: NotifyAction;
  rawArgs?: string[];
  ...
}
```

The daemon branch reads only `cmd.rawArgs ?? []`.

### MODIFY: `packages/coding-agent/src/commands/notify.ts`

Before:

```ts
const ACTIONS: NotifyAction[] = ["status", "setup", "verify"];
```

After:

```ts
const ACTIONS: NotifyAction[] = ["status", "setup", "verify"];
```

The public action list remains unchanged. Add an early raw-argv branch:

```ts
if (this.argv[0] === "daemon-internal") {
  await runNotifyCommand({ action: "daemon-internal", rawArgs: this.argv.slice(1), flags: {} });
  return;
}
```

This preserves a hidden internal command without advertising it in normal `notify` help.

### MODIFY: `packages/coding-agent/scripts/build-binary.ts`

Add the package-relative daemon CLI compile entrypoint beside existing worker entries:

```ts
"./src/notifications/daemon-cli.ts",
```

### MODIFY: `scripts/ci-release-build-binaries.ts`

Add the repo-root-relative daemon CLI compile entrypoint:

```ts
"./packages/coding-agent/src/notifications/daemon-cli.ts",
```

### NEW: `packages/coding-agent/test/notifications-compiled-daemon-smoke.test.ts`

Coverage:

1. `bun run packages/coding-agent/src/cli.ts notify daemon-internal --smoke --agent-dir <tmp>` exits 0, creates the JWC Telegram transport dir, and leaves no `.smoke` temp files.
2. stdout/stderr do not include a provided secret environment value.
3. build scripts include the daemon CLI compile entrypoint in package-relative and repo-root-relative forms.
4. optional unit-level smoke for `parseDaemonInternalArgs`/`--max-ticks 0` if needed to avoid a slow compiled binary build in focused tests.

### MODIFY: `packages/coding-agent/src/config/settings-schema.ts`

Extend existing UI descriptions only:

- `notifications.terminalBell`: mention Windows Terminal can keep BEL silent depending on profile/system sound settings.
- `completion.notifyCommand`: mention PowerShell `[Console]::Beep` as the JWC workaround and preserve `JWC_NOTIFICATION_*` env wording.

No new setting key.

### MODIFY: `packages/coding-agent/test/terminal-bell.test.ts`

Import `SETTINGS_SCHEMA` and assert:

- `notifications.terminalBell` description mentions Windows Terminal and `completion.notifyCommand`.
- `completion.notifyCommand` description mentions PowerShell `[Console]::Beep`.
- `completion.notifyCommand` description still mentions `JWC_NOTIFICATION_*` and not new `GJC_NOTIFICATION_*`.

### MODIFY: `packages/coding-agent/README.md`

Add a short "Local completion notifications" section:

- user-level `completion.notifyCommand` receives `JWC_NOTIFICATION_*`;
- Windows Terminal BEL may stay silent;
- PowerShell beep workaround example uses `jwc config set completion.notifyCommand ...`;
- no raw token/channel examples.

### GENERATED: `schemas/config.schema.json`

Regenerate with:

```sh
bun scripts/generate-json-schemas.ts
```

### CHASE CLOSURE DOCS

At B/D close:

- move `struct_har/chase/10.064_gjc_chase_telegram_daemon_entrypoint_notify.md` to `struct_har/chase/_fin/10/10.064_gjc_chase_telegram_daemon_entrypoint_notify.md`;
- update `struct_har/chase/10_gjc_chase_MOC.md`;
- update `struct_har/chase/007_follow_index.md`;
- update `struct_har/chase/009_follow_tiers.md`;
- update `struct_har/chase/002_gap_inventory.md` if it contains the row;
- update `struct_har/chase/10.001_gjc_chase_cycle.md`;
- update `struct_har/chase/_fin/INDEX.md`.

## Verification plan

Focused:

```sh
bun test packages/coding-agent/test/notifications-compiled-daemon-smoke.test.ts
bun test packages/coding-agent/test/terminal-bell.test.ts
bun test packages/coding-agent/test/notify-cli.test.ts
bun scripts/generate-json-schemas.ts --check
```

Global gate:

```sh
bun run check:ts
git diff --check
```

Security/naming checks:

```sh
rg -n "GJC_NOTIFICATION|gjc notify daemon|\\.gjc/state/notifications" packages/coding-agent/src/notifications packages/coding-agent/src/cli packages/coding-agent/src/commands packages/coding-agent/README.md
```

Expected: no new public `gjc` command wording and no new `GJC_NOTIFICATION_*` namespace for the hook.

## Acceptance criteria

- Hidden `jwc notify daemon-internal --smoke --agent-dir <tmp>` works from source CLI with no Telegram token and no network.
- Build scripts preserve the hidden daemon CLI entrypoint for compiled binaries.
- Windows Terminal bell limitation is documented through settings schema, generated schema, package README, and terminal-bell regression test.
- JWC naming is preserved (`jwc`, `.jwc`, `JWC_NOTIFICATION_*`).
- The card is moved to `_fin/10` and all chase indexes/changelog rows point to the `_fin` card.
