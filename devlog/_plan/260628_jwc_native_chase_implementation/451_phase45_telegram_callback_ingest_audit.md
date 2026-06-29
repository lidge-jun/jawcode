# 451 Phase 45 audit — Telegram callback ingestion (independent, read-only)

> Audits plan `450`. Verdict: **PASS**. Card 10.032 stays OPEN.

## Confirmed (cited against actual files)
- `remote-answer.ts:~211` `decideRemoteAnswer` calls `isNotificationConnectTokenAccepted(expectedToken,
  presentedToken)` and returns `{rejected, unauthorized}` on mismatch — caller need NOT pre-check the
  token. Plan's reliance on `decideRemoteAnswer` for `unauthorized` is correct.
- `transport-shell.ts:~143` `decideTransportInbound`'s token pre-check is redundant defense-in-depth,
  not a required precondition; the new ingest function can rely on `decideRemoteAnswer`.
- `config.ts isNotificationConnectTokenAccepted` requires non-empty `presentedToken === expectedToken`.
- `telegram-ask-keyboard.ts resolveAskButtonAnswer` `{ok:true,value,index,nonce}` → maps cleanly to
  `RemoteAnswerInput.value` + `idempotencyKey:nonce`; failure `{ok:false,reason:"invalid_button_value"}`
  matches `RemoteAnswerRejectionReason`.
- `answerCallbackQuery` is a real Bot API method; `telegramCall` `sanitize` strips token from error
  reasons → no leak.
- Idempotency replay path (`remote-answer.ts` ~183-205): matching key + matching valueHash + accepted →
  safe re-accept; matching key + different hash → `idempotency_conflict`. Plan's replay test correct.
- Scope guard lists daemon-loop wiring / lead-in / redaction / verbosity / free-text acks as open → card
  NOT closed.
