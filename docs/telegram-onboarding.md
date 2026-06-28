# Telegram Notifications Onboarding

Telegram support in JWC is currently a guarded foundation, not a live runtime.

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

What is still deferred:

- Telegram `getUpdates`
- sending messages to Telegram
- answering a live ask from Telegram
- remote session start, stop, or reload
- Discord and Slack notification adapters
- media and file transfer

## Media and files

Telegram media/file transfer is not implemented yet. JWC currently has only a local workspace path-confinement helper for a future file-egress path.

Do not document or automate `telegram_send`, `sendPhoto`, `sendDocument`, inbound Telegram media injection, or live attachment delivery as supported behavior.

Before any media/file runtime can ship, a later security-reviewed slice must prove:

- the selected file is realpath-confined to the active workspace;
- an active authorized Telegram sink is mapped to the current session;
- MIME and size policy are enforced before reading or sending bytes;
- logs never include raw file contents, bot tokens, chat ids, or full Telegram response bodies.

Do not treat the Telegram docs as a production bot setup guide until the poller and endpoint connection slices are implemented and verified.

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
