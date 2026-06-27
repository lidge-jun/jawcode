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
