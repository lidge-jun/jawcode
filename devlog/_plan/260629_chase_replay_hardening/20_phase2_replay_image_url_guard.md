# Phase 2 — replay image_url/detail well-form guard (DECISION: evidence-based defer)

> Card: 10.055 (cluster 2 of 5, GJC split). Source: GJC `a8904baa` (#1214).
> Tier: STANDARD. Outcome: **conscious defer with evidence** — not imported.

## What GJC #1214 does

In GJC `packages/ai/src/utils.ts`, `sanitizeResponsesMessageContentForReplay`
iterates message *content parts* and, for any part carrying `image_url`:
- well-forms a string `image_url` via `.toWellFormed()`,
- for object-valued `{ url, detail }`, well-forms `url` and validates `detail`
  against `auto|low|high` (dropping invalid detail),
- migrates legacy `type: "image_url"` parts to `input_image`.

This guards against a malformed (lone-surrogate) `image_url` string that a
provider round-tripped back through replayed message content.

## Why JWC does not have the matching code path

JWC's replay/persistence representation is structurally different:

1. Replay sanitizer scope differs. `utils.ts sanitizeOpenAIResponsesHistoryItemsForReplay`
   operates on `providerPayload.items`, which are sourced from
   `runtime.nativeOutputItems` (`openai-codex-responses.ts:1608`) — i.e. assistant
   *output* items, not replayed user/tool *input* message content. It strips ids
   and normalizes `call_id` only; it never re-sends externally-supplied
   `image_url` content parts.

2. Input image parts are JWC-built, not replayed-through. In
   `openai-responses-shared.ts`, image input is reconstructed every turn as
   `image_url: \`data:${mimeType};base64,${data}\`` (lines 211-213, 352-354) from
   JWC's own content blocks, and all text goes through `.toWellFormed()`
   (lines 196, 202, 259, 327). The `image_url` string is JWC-generated, so it
   cannot carry an external lone-surrogate.

3. Persisted image_url round-trip is blob-ref only. The one place JWC restores a
   persisted `image_url` is `session-manager.ts resolvePersistedBlobRefs`
   (lines 896-921). It only resolves JWC `BlobStore` references
   (`isBlobRef`) created by JWC itself, for both `string` and `{ url }` shapes.
   The restored value is a JWC-produced data URL, not an unvalidated external
   string.

## Conclusion

The specific defect GJC #1214 prevents — a malformed externally-replayed
`image_url` string reaching the transport — does not arise in JWC's architecture.
Adding a `sanitizeResponsesMessageContentForReplay` clone would be dead defensive
code on a path JWC does not have, contradicting the "no 1:1 copy / adapt to JWC"
constraint.

## Decision (10.055 sub-feature: replay image_url sanitization)

- Classification: **reject / defer** (no matching JWC code path; defect cannot occur).
- Re-open trigger: if JWC ever adds a path that re-sends externally-sourced
  `image_url` content parts verbatim through replay (rather than rebuilding them
  from JWC blocks/blob store), import the well-form + detail-validation guard then.
- Naming impact: none.
- Test impact: none (no behavior change).
- Residual risk: none under current architecture; tracked as conditional re-open.
