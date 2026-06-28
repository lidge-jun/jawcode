# 542 Phase 54 build — media render + inbound media routing

Built after audit `541` PASS. 10.034 pass 2a (gates 1 + 5). Card still OPEN (gate 2 tool → phase 55).

## Changes
### NEW `src/notifications/telegram-media-render.ts` (~50 ln)
`renderAndSendTelegramMedia(input)` — classify `{fileName, sizeBytes: data.length}` via
`classifyTelegramMedia`; reject (`empty_file`/`too_large`) short-circuits before any network call;
otherwise dispatch to `sendTelegramPhoto`/`sendTelegramDocument`. Returns
`{ok:true, method, result}` | `{ok:false, rejected}` | passthrough send failure. (gate 1 render)

### MODIFY `src/notifications/threaded-surface.ts` (gate 5)
- `ThreadInboundUpdate.media?: { kind, fileId?, fileName? }`.
- New decision variant `route_media` + `ThreadInboundMedia` type; context flag `allowMedia?`.
- Media branch inserted after the not-stale gate: when `allowMedia` and media present, route to the
  mapped session (carrying trimmed caption); else fail-closed `attachment_not_supported`. Default-off
  preserves existing behavior.

### MODIFY `src/notifications/telegram-inbound-router.ts`
Defensive guard: this router never enables `allowMedia`, so a `route_media` decision (unreachable here)
maps to a `drop attachment_not_supported` — keeps the exhaustive union typed.

### MODIFY `src/notifications/index.ts` — export telegram-media-render.

### Tests
- NEW `test/notifications-telegram-media-render.test.ts` (5): png→sendPhoto, oversize→sendDocument,
  >cap→too_large (no network), 0 bytes→empty_file (no network), send-failure propagated.
- EXTEND `test/notifications-threaded-surface.test.ts` (5): media off→attachment_not_supported; media on→
  route_media (caption trimmed); wrong chat→wrong_chat; unknown topic→unknown_topic; dup→duplicate_update.

## Verification handoff
C: media-render + threaded-surface + full notifications regression + check:types + biome + diff-check.
Phase 55: connection-gated `telegram_send` tool → close 10.034.
