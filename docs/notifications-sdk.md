# JWC Notifications SDK

JWC notifications are currently a local foundation for future mobile transport support.

Supported today:

- `jwc notify status`
- `jwc notify setup --token <token> --chat-id <id>`
- notification settings under `notifications.*`
- discovery files under `.jwc/state/notifications/*.json`
- Telegram transport state and registered-root scanning helpers
- pure remote-answer safety helpers for authorization, idempotency, race decisions, and payload normalization

Deferred, not supported yet:

- live Telegram polling
- outbound Telegram sending
- Discord or Slack adapters
- session lifecycle commands from chat
- media or file transfer
- compiled notification daemon entrypoints

## Secrets

Docs and command output must use placeholders such as `<bot-token>` and `<chat-id>`.
Do not paste real bot tokens into config files, shell history, bug reports, or docs examples.

## Remote Answers

Remote answer helpers are side-effect-free. They decide whether a Telegram-origin answer should be accepted, rejected, or dropped, but they do not mutate an agent session or send network traffic.

The caller is responsible for atomically storing the returned context patch before applying an accepted answer.
