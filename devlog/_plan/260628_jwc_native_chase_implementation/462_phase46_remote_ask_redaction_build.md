# 462 Phase 46 build — remote ask redaction view

> Boss-direct build after audit `461` PASS. Implements gate 4 invariant. Card OPEN.

## Changes
### NEW `packages/coding-agent/src/notifications/notification-redaction.ts` (~55 lines, pure)
- `RedactionPolicy{redact:boolean}`, `REDACTED_PLACEHOLDER="[redacted]"`.
- `redactStreamText(text, policy)` — verbatim when `!redact`; placeholder for non-empty, `""` for
  empty/whitespace when `redact`.
- `buildRemoteAskView({question, options, leadIn?, policy}) → RemoteAskView`
  - question + options ALWAYS verbatim regardless of redaction (gate 4); empty options dropped.
  - lead-in (gate 6) redacted when `redact`, omitted when empty/whitespace **regardless of redaction**
    (fix: a whitespace lead-in passed through `redactStreamText` with `redact:false` is trimmed out by
    the caller, not just relying on the placeholder path).

### MODIFY `packages/coding-agent/src/notifications/index.ts` — export notification-redaction.

## Verification handoff
C: redaction suite + full notifications regression + check:types + biome + diff-check.
