# Phase 5 — Stream + decoder hardening (jawcode & opencodex)

Driven by two gpt-5.5 review agents that diffed jawcode's Kiro provider against the
more-hardened opencodex sibling. Findings were applied to both repos.

## jawcode (packages/ai/src/providers)

P1 — long tool descriptions (`convertTools`): were hard-truncated with `.slice(0,1024)`,
silently dropping guidance. Now a description over the limit is moved verbatim into the
system prompt with a short pointer left on the toolSpecification, matching opencodex.
`buildPayload` keeps tool-doc additions even on `currentTurnOnly` resumed turns (the base
system prompt is still dropped there, but re-advertised tools must carry their docs).

P1 — streaming tool calls (`streamKiro`): a single `currentToolCall` meant a second tool
starting (or input for a different `toolUseId`) before the first `stop` overwrote/merged the
first, losing it. Added a shared `finalizeToolCall()` that fires on `tool_stop`, on an
interleaving start, on cross-id input, and at end-of-stream, so no buffered tool call is
dropped and arguments never bleed across tools.

P1 — `currentTurnOnly` history: clearing all history orphaned the current turn's
`toolResults` from the assistant `toolUses` they answer (CodeWhisperer 400). Now the
assistant tool-use turn (plus a leading user turn) is retained when the current message
carries tool results.

P2 — `aws-eventstream.ts`: added `MAX_MESSAGE_LEN` (16 MiB) caps in `decodeMessage` and the
streaming loop, a `headersLen <= total - MIN` check, and per-header bounds (`need()`), so a
malformed/hostile frame fails with a clean decoder error instead of unbounded buffering or a
low-level `RangeError`.

## opencodex (src/adapters)

P1 — `kiro.ts` `parseKiroStream`: `tool_input` appended to the open tool without checking
`toolUseId`, so input for a different tool before stop could merge into the wrong tool.
Added a fail-closed guard that errors when input arrives for a different id than the open
tool. (tool_start already guarded id/name mismatch.)

## Tests

- jawcode: new `kiro-stream-integration.test.ts` drives `streamKiro` end-to-end through a
  mocked fetch + in-test eventstream encoder (normal call, interleaved start, cross-id input,
  open-at-EOF). New payload tests for long-description move and `currentTurnOnly` tool-result
  retention. New `aws-eventstream` bounds tests. All Kiro suites green (51 across 6 files);
  full packages/ai run shows only the 3 pre-existing unrelated failures (#404, #489).
- opencodex: new interleaved-input fail-closed stream test; full `./tests/` green (766).

## Deliberately not changed

- jawcode keeps fail-open finalize of incomplete tool JSON (`{ _raw: ... }`) rather than
  opencodex's fail-closed truncation error — that is jawcode's existing behavior and a
  separate policy decision.
- Auth `authCache` keying-by-profile and conversationId stability (P2/P3 from review) are
  noted but left for a dedicated pass.
