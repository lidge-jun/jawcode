# B3b — Tool-fallback + structuredToolIds guard (REQUEST_BODY_INVALID risk)

SoT: opencodex `src/adapters/kiro-tool-fallback.ts` + the `buildKiroPayload` structuredToolIds
gating (commit a63aa76 "harden tool fallback payloads"). Surfaced by the PABCD audit subagent
as a missed gap not in the original inventory.

## Problem

CodeWhisperer only accepts structured `toolUses` / `toolResults` when the matching tools are
advertised on the request. jawcode emitted them unconditionally:

- a resumed turn that no longer advertises tools still sent `toolUses` / `toolResults`;
- a `toolResult` whose id had no matching advertised structured `toolUse` was still sent as a
  structured result.

Either produces `REQUEST_BODY_INVALID` ("Improperly formed request") — the exact class of
sporadic upstream error this effort targets.

## Fix

New `kiro-tool-fallback.ts` (parity with opencodex): `toolCallFallbackText`,
`toolResultFallbackText`, `appendFallbackText` serialize calls/results into readable prose.

`buildPayload` now tracks `structuredToolIds` (ids actually emitted as structured toolUses this
request — only possible when tools are advertised):

- tools advertised: assistant tool calls become structured `toolUses` and their ids are recorded;
  with no tools advertised, calls are appended to the assistant text as fallback prose.
- a `toolResult` is sent structured only when tools are advertised AND its id is in
  `structuredToolIds`; otherwise it is serialized as fallback prose on its own user turn.
- fallback user turns are tracked in a `fallbackEntries` WeakSet and excluded from synthetic
  thinking-tag injection.

The consecutive-user / pending-flush logic was factored into a shared `pushUserEntry` helper
(behavior-preserving) so the fallback path reuses the same role-alternation guarantees.

## Tests

- `kiro-payload.test.ts`: tool history with NO tools advertised → all-prose, zero structured
  toolUses/toolResults; orphaned tool-result id (tools advertised) → fallback prose. The shared
  `ctx` helper now advertises the referenced tools by default (matching real usage and
  opencodex's test harness), with explicit `[]` for the tool-less / plain-thinking fixtures.

## Verify

- `bun test` kiro suites — 63 pass, 0 fail.
- `bun run check:types` (packages/ai) — clean. biome format applied.
