# 540 Phase 54 plan — media render + inbound media routing (10.034 pass 2a)

Card `10.034` (C4 egress). Builds on pass 1 (phase 53: policy + multipart senders). Closes gates 1 + 5.
The model-visible `telegram_send` tool (gate 2, tools-framework integration) is the final slice
(phase 55) that closes the card.

## This phase — files
- NEW `src/notifications/telegram-media-render.ts` (~60 ln): `renderAndSendTelegramMedia(input)` —
  classify `{fileName, sizeBytes: data.length}` via `classifyTelegramMedia`; on reject return
  `{ok:false, rejected}`; else dispatch to `sendTelegramPhoto`/`sendTelegramDocument` with
  chatId/messageThreadId/caption/data. This is the outbound frame render half of gate 1 (decision +
  method dispatch); `fetchImpl` injectable.
- MODIFY `src/notifications/threaded-surface.ts`: inbound media routing (gate 5). Extend
  `ThreadInboundUpdate` with optional `media?: { kind:"photo"|"document"; fileId?:string; fileName?:string }`.
  Add `ThreadInboundDecision` variant `{ mode:"route_media"; sessionId; media; updateId }` and context flag
  `allowMedia?: boolean`. When `allowMedia` and an update carries media, route ONLY after the existing
  paired-chat fingerprint + known-topic + not-stale + not-duplicate gates pass; otherwise keep current
  fail-closed `attachment_not_supported` drop. No behavior change when `allowMedia` is unset.
- MODIFY `src/notifications/index.ts`: export telegram-media-render.

## Tests
- NEW `test/notifications-telegram-media-render.test.ts`: png→sendPhoto path called; oversize png→
  sendDocument; >50MB→rejected too_large (no send); 0 bytes→empty_file (no send); error outcome
  propagated.
- EXTEND `test/notifications-threaded-surface.test.ts`: media with allowMedia=off→attachment_not_supported;
  allowMedia=on + valid media→route_media with sessionId; media from wrong chat→wrong_chat; media to
  unknown topic→unknown_topic; duplicate media update→duplicate_update.

## Done-gate
gate 1 (render→sendPhoto/sendDocument) DONE; gate 5 (inbound media paired-chat/known-topic only) DONE.
Remaining for close: gate 2 (connection-gated `telegram_send` tool) → phase 55.

## Verification
`bun test test/notifications-*.test.ts` + check:types + biome + diff-check. Independent C4 audit before B.
