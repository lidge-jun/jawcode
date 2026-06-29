# Phase 4 — Port opencodex Kiro hardening into jawcode

Source of truth: the opencodex `dev` branch Kiro adapter (split modules under
`src/adapters/kiro-*.ts`). jawcode keeps a single `packages/ai/src/providers/kiro.ts`,
so each opencodex fix was reimplemented in jawcode's idiom rather than copied.

## What was ported

Tool fidelity:
- Tool names are sent verbatim (removed the 64-char `slice`). Truncation silently
  broke long MCP / Computer Use tool names so the model echoed a name the harness
  could no longer match.
- Tool input-schema sanitization before the CodeWhisperer payload:
  - strip `additionalProperties` and empty `required: []` recursively
    (`sanitizeKiroSchema`).
  - `ensureRootObjectType`: Bedrock requires `inputSchema.json.type === "object"`
    and rejects `oneOf`/`anyOf`/`allOf` at the top level. The root composition is
    flattened into a single object schema. Root direct `properties`/`required` and
    any sibling keys (`description`, `$defs`, `definitions`) are preserved; variant
    `properties` are merged; `required` is unioned only for `allOf` (AND), dropped
    for `oneOf`/`anyOf` (OR) so a valid single-branch call still passes. All three
    composition keywords are removed even when several coexist at the root.

Images (CodeWhisperer native `userInputMessage.images`):
- User/developer message images and tool-result screenshots are sent as
  `{ format, source: { bytes } }`. Tool-result images ride on the carrier
  `userInputMessage.images` (CW cannot embed images inside a `toolResult`).
- Vision is gated on `model.input.includes("image")`; non-vision models drop the
  bytes and append the shared `[image omitted ...]` placeholder.
- `image/jpg` is normalized to `jpeg`; media-type parameters (`image/png; ...`)
  are stripped before deriving the format.

Reasoning + errors:
- `<thinking>` / `<think>` / `<reasoning>` parseback: a leading block in the
  streamed content is split into reasoning blocks (`thinking_*` events), tolerant
  of tags split across chunks; non-leading tags stay visible text.
- Upstream errors (HTTP body + in-stream exception/error frames) are classified
  (rate limit / auth / quota / overload / invalid request) and redacted (tokens,
  ARNs, absolute paths) instead of surfacing raw 500-char dumps.

## Not ported
- HTTP retry/backoff: jawcode already has it via the shared `fetchWithRetry` +
  `resolveRetryBudget`.
- Truncation fail-closed vs jawcode's fail-open finalize of incomplete tool JSON:
  left as jawcode's existing behavior (intentional, out of scope).

## Verification

- `bun run check:types` (packages/ai) — clean.
- `bun test src/providers/kiro-payload.test.ts kiro-errors.test.ts
  kiro-thinking.test.ts kiro-stream.test.ts` — all green (new regression tests for
  schema sanitization/flattening, root-key preservation, oneOf+allOf coexistence,
  image bytes + `image/jpg` normalization, vision gate against the real catalog,
  thinking parseback, and error classification/redaction).
- Full `packages/ai` suite: only the 3 pre-existing failures unrelated to Kiro
  (MiniMax-M3 #404, qwen3.7-max transport #489) remain.

## Review

Two independent reviewers (gpt-5.5 and a second agent) checked both repos. Both
converged on the same defects in the first-pass flatten — dropped sibling root
keys/`$defs`, and `oneOf` required being unioned as AND — plus the `image/jpg`
format gap. All were fixed and covered by tests before close-out.
