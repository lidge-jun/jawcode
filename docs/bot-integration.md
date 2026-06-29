# Bot Integration: JWC-native notifications vs cli-jaw channel send

JWC has **two distinct delivery paths** to a chat surface. They are separate systems with separate
purposes — choose by intent, do not conflate them.

## 1. JWC-native notifications (this SDK)

An agent-driven, transport-agnostic **session endpoint**. It is owned by the coding-agent session and
is about *the agent talking to a paired human about its own work*:

- per-session threaded topics, identity/turn render, and fail-closed inbound routing;
- ask → answer round-trips (inline keyboard + callback, or in-topic free text injected only into the
  mapped session via the reply-bridge);
- session lifecycle commands from chat (start / stop / resume / list);
- the connection-gated `telegram_send` tool for workspace-confined media egress.

Configure it with `jwc notify setup` / `status` / `verify`; state lives under
`.jwc/state/notifications/`. The supported transport today is Telegram (private chat only). Discord and
Slack adapters are **deferred** — not shipped. See `docs/notifications-sdk.md` and
`docs/telegram-onboarding.md`.

Use this path when the *agent* needs to reach the user mid-task, ask a question, or render session
output into a dedicated per-session topic.

## 2. cli-jaw channel send

A general-purpose, host-level **outbound delivery** endpoint provided by cli-jaw, not by the
coding-agent notification SDK:

```
POST http://localhost:3457/api/channel/send
```

Supports `text`, `voice`, `photo`, `document` to the active channel (Telegram or Discord). It is for
*the operator / boss agent broadcasting a result* to whatever channel is currently active — it is not
session-scoped, has no ask/answer round-trip, and no threaded per-session topic model.

Use this path for one-shot result delivery, file/voice handoff, or heartbeat output — not for
session-bound agent ask/answer flows.

## Choosing

| You want… | Use |
|---|---|
| agent asks the user a question and waits for an answer | JWC-native notifications |
| per-session threaded topic with identity/turn render | JWC-native notifications |
| remote session start/stop/resume from chat | JWC-native notifications |
| workspace-confined media egress tied to the session | JWC-native notifications (`telegram_send`) |
| one-shot broadcast of a finished result to the active channel | cli-jaw channel send |
| send a voice note / photo / document handoff | cli-jaw channel send |

Both paths keep bot tokens out of logs and tool I/O. Neither path runs a hosted production bot for
you: JWC-native notifications need an operator token + running daemon, and cli-jaw channel send needs a
configured active channel.

## Secrets

Use placeholders such as `<bot-token>` and `<chat-id>` in docs, examples, and bug reports. Never paste
a real bot token into config files, shell history, or issues for either delivery path.
