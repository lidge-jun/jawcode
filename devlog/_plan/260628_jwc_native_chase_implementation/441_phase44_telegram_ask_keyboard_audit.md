# 441 Phase 44 audit — Telegram ask inline keyboard (independent, read-only)

> Audits plan `440`. Verdict: **PASS**. Card 10.032 stays OPEN.

## Confirmed (cited by auditor against actual files)
- `remote-answer.ts:4` `MAX_CALLBACK_PAYLOAD_BYTES=256` (prefix `jwc:v1:`) is for the WS loopback
  protocol — overflows Telegram's 1–64-byte `callback_data` limit, so a separate compact scheme is
  required. Plan identifies this correctly.
- Compact `jwc1:<index>:<nonce>`: prefix(5) + index(1–3) + `:` + 36-char UUID nonce = 44 bytes ≤ 64;
  fail-fast throw on overflow is the correct guard.
- No token/chat/session secrets in callback_data — only an opaque index + nonce; canonical value
  resolved server-side via `RemoteActionContext.allowedValues` (`remote-answer.ts:37`).
- `invalid_button_value` already in `RemoteAnswerRejectionReason` (`remote-answer.ts:58`) → resolver
  output feeds `decideRemoteAnswer` directly; defense-in-depth (resolver index-bound check + decide
  value-membership check).
- `stripTelegramOptionPrefix` (`remote-answer.ts:88`) reused for button text → gate 5 (no
  double-numbering).
- No index/nonce collision: nonce per-action, index deterministic; cross-action replay caught by
  `decideRemoteAnswer` `stale_action`.
- Module pure/side-effect-free; scope guard keeps live ingestion/lead-in/redaction/acks open → card
  NOT closed.
