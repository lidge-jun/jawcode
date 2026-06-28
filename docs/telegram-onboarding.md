# Telegram Notifications Onboarding

Telegram support in JWC is a JWC-native session-endpoint layer whose logic is implemented and
unit-tested with an injected fetch. It is not a turnkey hosted bot: live operation requires an
operator-supplied bot token and a running managed daemon.

You can configure the local settings surface:

```sh
jwc notify setup --token <bot-token> --chat-id <chat-id>
jwc notify status
```

This creates JWC notification configuration and allows local code to write discovery records under `.jwc/state/notifications/`.

What works now:

- masked status output
- private discovery files
- transport owner/root helper state
- fail-closed inbound decisions
- pure remote-answer authorization and idempotency helpers
- managed singleton daemon logic (engine / loop / runtime), unit-tested with an injected fetch
- threaded per-session topics with render and fail-closed inbound routing
- reply-bridge that injects in-topic free text only into the mapped session
- session lifecycle commands from chat (start / stop / resume / list), parsed and control-routed
- ask inline keyboard plus callback remote answers
- the connection-gated `telegram_send` media tool (see below)

What is still deferred:

- Discord and Slack notification adapters (not shipped; rejected until a user requests them)
- a live production bot deployment — the logic above is unit-tested with an injected fetch, so
  bringing it online still requires an operator-supplied bot token and a running managed daemon

## Media and files

Telegram media/file egress ships through the **connection-gated `telegram_send` tool**. The tool is
only exposed to the model when an active authorized Telegram transport is mapped to the current
session; when that gate is not satisfied the tool is not offered and the egress path never calls the
network. The tool is workspace-confined and token-safe, enforcing:

- the selected file is realpath-confined to the active workspace before any bytes are read;
- an active authorized Telegram sink is mapped to the current session;
- MIME and size policy are enforced before reading or sending bytes;
- logs never include raw file contents, bot tokens, chat ids, or full Telegram response bodies.

Inbound Telegram media injection is routed through the same fail-closed inbound classifier as text;
unknown-chat, wrong-chat, and duplicate updates are dropped. This is implemented and unit-tested with
an injected fetch; a live bot still requires an operator token and a running daemon.

## Pairing verification (private chat only)

JWC pairs only with a **private** Telegram chat (a direct DM with your bot). Group, supergroup, and
channel chats are rejected fail-closed. After creating a bot with BotFather and obtaining your private
`chat-id`, verify the pairing before relying on it:

```sh
jwc notify verify --token <bot-token> --chat-id <chat-id>
```

`verify` calls the Telegram `getChat` API and reports:

- `Pairing: accepted (private chat)` — or `rejected (<chat type>)` for non-private chats.
- `Threaded Mode: verified | unverified | unknown` — whether the chat advertises forum-topic support.
  Threaded Mode is a supergroup capability, so a private chat reports `unknown`; runtime still falls
  back to a flat surface when `createForumTopic` is unavailable.

The bot token is never printed, logged, or included in any error reason. `JWC_NOTIFICATIONS=0` hard
disables notifications regardless of stored settings (`JWC_NOTIFICATIONS` / `JWC_NOTIFICATIONS_TOKEN`
take precedence; legacy `GJC_NOTIFICATIONS*` is read only as a backward-compatibility fallback).
