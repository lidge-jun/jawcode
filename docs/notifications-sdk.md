# JWC Notifications SDK

JWC notifications are a JWC-native, transport-agnostic session-endpoint layer. The supported transport
today is **Telegram**. The logic below is implemented and unit-tested with an injected `fetch`/clock;
**live operation requires an operator-supplied bot token and a running managed daemon** — the SDK does
not deploy or run a production bot for you.

## Shipped vs deferred

| Capability | Status |
|---|---|
| `jwc notify status` / `setup` / `verify` (masked output) | shipped |
| notification settings under `notifications.*` | shipped |
| discovery files under `.jwc/state/notifications/*.json` | shipped |
| private-chat-only pairing + Threaded Mode capability probe | shipped |
| managed singleton daemon (engine / loop / runtime, owner-guarded) | shipped — logic, unit-tested with injected fetch |
| threaded per-session topics, render, fail-closed inbound routing | shipped |
| reply-bridge: in-topic free text injected only into the mapped session | shipped |
| session lifecycle commands from chat (start / stop / resume / list) | shipped — parser + control runtime |
| ask inline keyboard + callback remote answers (authorize / idempotency / race) | shipped — pure decision helpers |
| connection-gated `telegram_send` tool (workspace-confined media egress) | shipped — token-safe, gated on an active authorized transport |
| Discord adapter | **deferred** — not shipped; rejected until a user requests it |
| Slack adapter | **deferred** — not shipped; rejected until a user requests it |
| live production bot deployment | operator runtime, not a code gap — requires a real token + running daemon |

Nothing in this SDK promises Discord or Slack delivery, and nothing here claims a production bot is
running on your behalf. The managed daemon, threaded surface, reply-bridge, and `telegram_send` egress
are exercised by unit tests that inject `fetch`; bringing them online is an operator step.

## Remote answers

Remote answer helpers are side-effect-free. They decide whether a Telegram-origin answer should be
accepted, rejected, or dropped (authorization, idempotency, race resolution, payload normalization),
but they do not mutate an agent session or send network traffic. The caller is responsible for
atomically storing the returned context patch before applying an accepted answer.

## `telegram_send` media egress

The `telegram_send` tool is **connection-gated**: it is only exposed to the model when an active
authorized Telegram transport is mapped to the current session. It is workspace-confined and token-safe:

- the selected file is realpath-confined to the active workspace before any bytes are read;
- an active authorized Telegram sink must be mapped to the current session;
- MIME and size policy are enforced before reading or sending bytes;
- logs never include raw file contents, bot tokens, chat ids, or full Telegram response bodies.

When the gate is not satisfied the tool is not offered, and the egress path never calls `fetch`.

## Secrets

Docs and command output must use placeholders such as `<bot-token>` and `<chat-id>`. Do not paste real
bot tokens into config files, shell history, bug reports, or docs examples. `JWC_NOTIFICATIONS=0` hard
disables notifications regardless of stored settings (`JWC_NOTIFICATIONS` / `JWC_NOTIFICATIONS_TOKEN`
take precedence; legacy `GJC_NOTIFICATIONS*` is read only as a backward-compatibility fallback).
