# 421 Phase 42 audit — Telegram→session reply bridge (independent, read-only)

> Audits plan `420`. Verdict: **PASS** — gate #4 met; keep 10.031 OPEN for gate #6.

## Confirmed
- `server.ts` `#handleOpen` sends `decision.frames` (hello + replayed `action_needed` w/ actionId) to a
  newly connected client; a `reply` frame → `resolveRemote` → broadcast `action_resolved` / send
  `reply_rejected`. `NotificationLoopbackServer` exposes `url`/`connectToken`/`enqueueAction`.
- `readNotificationDiscoveryRecord` returns `{url, token, ...}`; server writes the record on start.
- Protocol frames (`action_needed.actionId`, `action_resolved`, `reply`, `reply_rejected.reason`) match.
- bun global `WebSocket` usable as client (precedent: notifications-server.test.ts).
- Token from record never logged; reason strings token-free.

## Ruling
- gate #4 MET: forward targets only the mapped session's endpoint (fail-closed on no-endpoint/
  no-pending-action), token-gated at upgrade → text injects only to that session.
- 10.031 stays OPEN for gate #6 (topic deletion on shutdown) → phase 43.
