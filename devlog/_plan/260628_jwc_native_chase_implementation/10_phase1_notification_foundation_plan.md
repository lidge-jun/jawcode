# 10 Phase 1 plan — notification foundation

## Scope

Implement the first JWC-native notification foundation slice for cards `10.028` and `10.029`.

This phase does not implement Telegram Bot API runtime, inbound Telegram updates, remote ask/reply resolution, session lifecycle control, media/file transfer, or threaded rendering.

## Source anchors

| Card | Source fact | JWC posture |
|---|---|---|
| `10.028` | GJC has protocol types, loopback discovery, token-authenticated local clients, ask/reply lifecycle. | Adapt only protocol/config/discovery scaffolding now; defer ask/reply and runtime server wiring. |
| `10.029` | GJC has `notify setup/status`, typed settings, schema, masked token output, private-chat pairing. | Adapt non-interactive config/status foundation; defer live Telegram validation and interactive pairing. |

Mandatory naming contract: `struct_har/chase/008_gjc_jwc_naming_contract.md`.

## Risk class

C4 security-adjacent foundation because this phase introduces token-bearing settings and a discovery-file contract.

Required reviewers:

- Backend: owner-file integration and CLI/settings correctness.
- Docs: chase/devlog/card evidence and JWC naming.
- Security-focused review: token masking, discovery-file permissions, and connect-time token rejection design.

## Exact JWC owner files

### New files

| File | Purpose |
|---|---|
| `packages/coding-agent/src/notifications/config.ts` | Typed notification settings resolver, env precedence, token masking helper, validation helpers. |
| `packages/coding-agent/src/notifications/discovery.ts` | `.jwc/state/notifications/<sessionId>.json` path/content helpers and atomic `0600` write/remove helpers. |
| `packages/coding-agent/src/notifications/protocol.ts` | Minimal JWC-native notification protocol frame types anchored to GJC `crates/gjc-notifications/src/protocol.rs`; lifecycle/control frames are deferred. |
| `packages/coding-agent/src/notifications/index.ts` | Public internal barrel for notification foundation helpers. |
| `packages/coding-agent/src/cli/notify-cli.ts` | `notify status` and non-interactive `notify setup` command handler. |
| `packages/coding-agent/src/commands/notify.ts` | Lazy CLI command wrapper. |
| `packages/coding-agent/test/notifications-config.test.ts` | Config/env precedence, masking, redaction/verbosity defaults. |
| `packages/coding-agent/test/notifications-discovery.test.ts` | Discovery path, atomic write, mode `0600`, no raw token in public display helpers. |
| `packages/coding-agent/test/notify-cli.test.ts` | `notify status/setup` with masked output and no raw token. |

### Modified files

| File | Planned change |
|---|---|
| `packages/coding-agent/src/cli.ts` | Register lazy `notify` command in `baseCommands`, after `config` and before `mcp-serve`, matching the existing non-workflow utility command surface. |
| `packages/coding-agent/src/config/settings-schema.ts` | Add `notifications.*` typed settings with JWC names and defaults. |
| `schemas/config.schema.json` | Regenerate generated settings JSON schema after adding typed settings. |
| `packages/coding-agent/test/cli-command-surface.test.ts` | Assert `notify` command is registered/help-loadable without launching TUI. |
| `struct_har/chase/10.028_gjc_chase_notifications_sdk.md` | Mark Phase 1 sub-slices completed/deferred after verification. |
| `struct_har/chase/10.029_gjc_chase_notify_config_cli.md` | Mark config/status foundation completed/deferred after verification. |
| `struct_har/chase/10_gjc_chase_MOC.md` | Update status note only if card movement is justified by evidence; otherwise leave active with partial evidence note. |

## TS/Rust boundary decision

Phase 1 is TypeScript-only.

Reasons:

1. The current phase explicitly excludes a loopback WebSocket server and N-API runtime surface.
2. Discovery path/content, config resolution, and CLI masking can be proven without a Rust crate.
3. `10.028` full done gate still requires future Rust/N-API or equivalent server work; that is deferred and must not be marked done by this phase.

Rust verification is not required unless implementation expands beyond this plan. If Rust files are touched, reroute to a new plan and include `bun run check:rs`.

## Settings keys

Add these schema keys:

| Key | Type | Default | Notes |
|---|---|---|---|
| `notifications.enabled` | boolean | `false` | Global notification switch. |
| `notifications.telegram.botToken` | string | `undefined` | Secret; never print raw. |
| `notifications.telegram.chatId` | string | `undefined` | Telegram chat identifier; setup accepts string. |
| `notifications.redact` | boolean | `true` | Suppress sensitive stream/context payloads in future runtime. |
| `notifications.verbosity` | enum `lean`/`verbose` | `lean` | Future mirror verbosity; implement as JWC `type: "enum"` with `values: ["lean", "verbose"] as const`, not upstream string+validate. |
| `notifications.daemon.idleTimeoutMs` | number | `300000` | Future daemon default; validate positive. |

Environment resolver contract:

Export helpers from `notifications/config.ts`:

- `resolveNotificationEnv`
- `isNotificationConfigured`
- `isNotificationEnabled`
- `maskToken`
- `maskChatId`

Precedence:

1. Use `$resolveEnv("GJC_NOTIFICATIONS")`, `$resolveEnv("GJC_NOTIFICATIONS_TOKEN")`, and `$resolveEnv("GJC_NOTIFICATIONS_CHAT_ID")` so `JWC_*` wins while legacy `GJC_*` can still be read internally.
2. `JWC_NOTIFICATIONS=0` or legacy fallback `GJC_NOTIFICATIONS=0` means hard disabled.
3. In-process override/session-off can be added later; not in Phase 1.
4. `JWC_NOTIFICATIONS=1` or legacy fallback `GJC_NOTIFICATIONS=1` requests enablement, but Phase 1 JWC hardens this to enabled only when resolved token and chat id are both present.
5. `JWC_NOTIFICATIONS_TOKEN` and `JWC_NOTIFICATIONS_CHAT_ID` override settings fields for config resolution, but token alone does not enable an incomplete config in Phase 1.
6. Complete settings enable when `notifications.enabled` is true.
7. `GJC_NOTIFICATIONS*` are not public JWC docs/help behavior in Phase 1, except as source/compatibility notes.

Test matrix must follow this JWC-hardening contract, not upstream tests that treat `GJC_NOTIFICATIONS=1` or token-only env as enabled on incomplete config.

## CLI contract

Add `jwc notify` subcommands:

| Command | Behavior |
|---|---|
| `jwc notify status` | Print enabled/configured state with masked token and chat id. No raw token. |
| `jwc notify status --json` | Emit JSON with booleans, masked token, chat id, redact, verbosity, idle timeout. |
| `jwc notify setup --token <token> --chat-id <id> [--redact true|false] [--verbosity lean|verbose]` | Persist settings and print masked summary. No live Telegram call. |

Out of scope:

- Interactive BotFather prompt.
- Private DM live validation.
- Topic/thread capability check.
- Telegram daemon start/stop.
- Remote answer buttons or free text.

Command-surface limits:

1. `ACTIONS = ["setup", "status"]` only.
2. No `daemon-internal` action in Phase 1.
3. No `fetch` to `api.telegram.org` or any live Telegram endpoint.
4. No `@jawcode-dev/natives` import.
5. `--redact` must use an explicit boolean value or an `allowNo` boolean flag; `--verbosity` must validate `lean|verbose`.

Masking contract:

1. `maskToken()` adapts GJC semantics: first 4 characters plus total length, with no raw token in status/setup text or JSON.
2. `maskChatId()` must not print the full chat id; use `(set)` or a partial mask and test the chosen format.
3. Tests must assert raw token and full chat id are absent from CLI output.

Status JSON shape:

```json
{
  "enabled": false,
  "configured": false,
  "botTokenMasked": null,
  "chatIdMasked": null,
  "redact": true,
  "verbosity": "lean",
  "idleTimeoutMs": 300000
}
```

`configured` means resolved token and resolved chat id are both present. `enabled` means resolver output after hard opt-out and completeness checks.

## Discovery contract

Add helper-only support for future `.jwc/state/notifications/<sessionId>.json`.

Minimum discovery content:

```json
{
  "version": 1,
  "sessionId": "example",
  "url": "ws://127.0.0.1:0",
  "host": "127.0.0.1",
  "port": 0,
  "token": "<secret>",
  "startedAt": 1782586800000,
  "updatedAt": 1782586800000,
  "pid": 123,
  "stale": false
}
```

Guards:

1. Session id must reuse or share the existing `SESSION_ID_RE` / `assertSafeSessionId()` pattern from `packages/coding-agent/src/harness-control-plane/storage.ts`, not a weaker ad hoc path check.
2. Discovery writes are atomic via temp file then rename.
3. Discovery directory `.jwc/state/notifications/` must be created/maintained with mode `0700` on Unix where supported.
4. Discovery file mode is `0600`.
5. Display/log helpers must use masked token.
6. Connect-time token rejection is represented as protocol/config helper tests only; no server exists in this phase.
7. Optional future lifecycle fields such as `stoppedAt` must be tolerated when reading records, but writers only need the minimal `EndpointRecord` fields above.

## Protocol subset

Phase 1 `protocol.ts` is limited to the minimal SDK wire discriminators from GJC `crates/gjc-notifications/src/protocol.rs`:

- server-to-client: `action_needed`, `action_resolved`, `reply_rejected`, `hello`, `pong`
- client-to-server: `reply`, `hello`, `ping`

Deferred protocol families:

- `identity_header`
- `context_update`
- `turn_stream`
- `image_attachment`
- `file_attachment`
- `activity`
- `inbound_ack`
- `session_ready`
- `session_closed`
- `config_update`
- lifecycle/control frames from GJC `notifications/index.ts`

## Deferred sub-slices

| Deferred work | Future card/phase |
|---|---|
| Loopback WebSocket server | Later `10.028` server slice |
| Remote ask/reply race semantics | `10.032` or `10.028` follow-up |
| Session startup/shutdown wiring | `10.030` transport shell |
| Inbound Telegram updates | `10.030`/`10.032` |
| Threaded rendering | `10.031` split |
| Session lifecycle control | `10.033` split |
| Media/file transfer | `10.034` split |

## Verification plan

Focused tests:

```sh
bun test packages/coding-agent/test/notifications-config.test.ts packages/coding-agent/test/notifications-discovery.test.ts packages/coding-agent/test/notify-cli.test.ts packages/coding-agent/test/cli-command-surface.test.ts
```

Hygiene:

```sh
git diff --check
bun run generate-schemas
bun run check:schemas
bun run check:tools
bun run check:ts
```

If `bun run check:ts`, `bun run check:schemas`, or `bun run check:tools` fails due to unrelated existing errors, record exact output in the check artifact and keep focused tests authoritative for this slice.

User-facing docs such as `docs/telegram-onboarding.md` and a `telegram-onboarding-docs.test.ts` equivalent are out of scope for Phase 1 and deferred to `10.035`.

## Evidence artifacts

This PABCD loop must produce:

| Artifact | Required content |
|---|---|
| `devlog/_plan/260628_jwc_native_chase_implementation/10_phase1_notification_foundation_audit.md` | Backend, Docs, and security-focused audit verdicts plus plan fixes. |
| `devlog/_plan/260628_jwc_native_chase_implementation/10_phase1_notification_foundation_build.md` | Changed source/test/chase paths, implementation decisions, and deferred sub-slices. |
| `devlog/_plan/260628_jwc_native_chase_implementation/10_phase1_notification_foundation_check.md` | Fresh command output, reviewer verdict, known unrelated failures, and commit hash. |

## Chase close policy

This phase cannot close `10.028` because the full SDK done gate requires server and ask/reply behavior.

This phase must add partial evidence notes to `10.028` and keep it active.

`10.029` done-gate mapping:

| Done-gate item | Phase 1 status |
|---|---|
| `jwc notify status` prints enabled/masked token/chat/redact without secrets | In scope. |
| `jwc notify setup --token --chat-id` writes JWC settings and masks output | In scope. |
| Interactive setup rejects group/supergroup/channel pairing | Deferred; needs live/mock Telegram pairing slice. |
| Threaded Mode capability is labeled `verified`/`unverified`/`unknown` | Deferred; needs live Telegram capability check or explicit mock slice. |
| `JWC_NOTIFICATIONS=0` hard opt-out beats global config | In scope via resolver tests. |
| Docs explain private-chat-only pairing and BotFather Threaded Mode fallback | Deferred to `10.035`. |

Default conservative posture: keep both `10.028` and `10.029` active with Phase 1 evidence. Do not move either card to `_fin` in this phase.
