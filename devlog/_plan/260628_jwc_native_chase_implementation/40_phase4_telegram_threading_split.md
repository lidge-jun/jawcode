# 40 Phase 4 split — 10.031 Telegram threaded surface

## Source card

`struct_har/chase/10.031_gjc_chase_telegram_threaded_surface.md`

## JWC posture

Split, then adapt only pure local helpers first. Runtime Telegram topic creation, deletion, network sending, and live inbound injection stay deferred until the managed daemon and endpoint connection slices exist.

## Adapt candidates

| Slice | Candidate | Allowed now | Required future tests |
|---|---|---|---|
| `10.031-A` | Pure topic registry model | Yes, as local data model only. Store JWC session/topic records without Bot API calls. | duplicate topic record dedupe, stale record replacement, no token/chat persistence |
| `10.031-B` | Threaded render formatter | Yes, pure HTML/text rendering for identity header and ask frames. | no raw token/chat, JWC repo/session labels, no double option numbering |
| `10.031-C` | Inbound threaded classifier | Yes, classifier only. It may return bounded drop/route decisions but must not inject messages. | wrong chat, missing topic, unknown topic, duplicate update, empty text |

## Reject for now

- GJC public names, `.gjc` paths, or copied topic title strings.
- Any helper that requires a live Telegram Bot API client.
- Any default behavior that treats unknown chat/topic as authorized.
- Attachment-only or attachment-bearing inbound updates. `10.031-C` must drop/fail closed on attachments until `10.034` storage, MIME, authorization, and media-ingress policy exists.

## Defer

| Upstream behavior | Deferred until |
|---|---|
| `createForumTopic` / `deleteForumTopic` | daemon process and outbound send slices exist |
| flat fallback outbound delivery | outbound send slice exists |
| in-topic free-text injection | endpoint connection and authorization context exist |
| identity header sent once per active topic | renderer plus daemon delivery ownership exist |
| topic rename/reuse on session title changes | topic registry integration phase |

## Security constraints for later implementation

1. Topic records must bind `chatIdFingerprint`, `sessionId`, and `messageThreadId` without raw chat id/token persistence.
2. Unknown chat/topic/update ids fail closed with bounded reason codes.
3. Duplicate update ids must be idempotent.
4. Threaded rendering must not weaken redaction from `remote-answer`.
5. Flat fallback cannot allow replies to control a session unless the session mapping is unambiguous.
6. Paired-chat, known-topic, and duplicate-update rules apply to attachment-bearing updates too; unclassified attachments must not route or inject user messages.

## Required classifier tests for attachments

Later `10.031-C` tests must include:

- attachment-only update in a known topic -> drop/fail-closed;
- unknown attachment type with text caption -> drop/fail-closed until `10.034` defines media policy;
- attachment update from wrong chat/topic -> drop/fail-closed with the same bounded reason style as text updates.

## Done-gate status after this split

No `10.031` done-gate is closed by this docs-only split. The card remains active.
