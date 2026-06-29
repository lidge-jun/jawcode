# B3 — Truncation detection + fail-closed surfacing

SoT: opencodex `src/adapters/kiro-truncation.ts` + the `parseKiroStream` guards (commits
c3b10c9 "surface truncated tool-call streams", a038784 "map upstream failures to actionable
errors").

## Problem

CodeWhisperer can cut a response short (token/length limits, upstream incidents) by emitting
a finish/stop reason, a `truncated` flag, or simply ending the stream mid tool call. jawcode
failed open: an unparseable tool-argument buffer was finalized as `{ _raw: "<partial>" }`,
which then surfaced downstream as a confusing CodeWhisperer `REQUEST_BODY_INVALID` on the
*next* turn instead of a clean, retriable error now.

## Fix

New `kiro-truncation.ts` (parity with opencodex):

- `kiroTruncationReason(parsed)` — detects `truncated: true` or a finish/stop-reason matching
  `length | max_tokens | truncat | incomplete | context_length`.
- `isCompleteKiroToolInput(input)` — empty or a parseable JSON object is complete; a non-empty
  unparseable buffer is not.
- `kiroTruncationErrorMessage(reason?)` — stable, redacted, fail-closed message.

`parseKiroPayload` gained a `truncation` event (checked first). `streamKiro` now fails closed
(throws → emits an `error` turn) on:

- an explicit `truncation` event;
- `content` arriving while a tool call is still open (tool never got its stop);
- a non-empty-but-invalid tool-argument buffer at `tool_stop`;
- the same at end-of-stream (previously fail-open `{_raw}` finalize).

## Deliberate divergence preserved

jawcode's reviewed parallel-tool interleaving recovery (a new tool / cross-id input before the
previous tool's stop → finalize the previous one rather than drop it) is intentionally kept.
That path is a normal CodeWhisperer parallel-tool pattern with complete per-tool JSON, not a
truncation, so it is not failed closed. Only genuinely incomplete JSON or explicit truncation
signals are fail-closed. The `{_raw}` fallback in `finalizeToolCall` now only remains reachable
from that interleaving recovery, never from a normal stop/EOS.

## Tests

- `kiro-truncation.test.ts` (5): reason detection, completeness checks, message stability.
- `kiro-stream-integration.test.ts` (+4): incomplete JSON at stop, stream-ends-mid-JSON,
  content-before-stop, explicit finish-reason — all surface a fail-closed error turn. Existing
  parallel-interleaving + open-at-EOS (complete JSON) tests stay green.

## Verify

- `bun test` kiro suites — 57 pass, 0 fail.
- `bun run check:types` (packages/ai) — clean. biome format applied.
