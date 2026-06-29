# B4 — Per-attempt request/stream timeout (100s)

SoT: opencodex `src/adapters/kiro-retry.ts` `fetchKiroWithRetry` (commit b62a145 "raise provider
connect/stream timeout to 100s"); the signal there rides on the fetch and the eventstream is read
off the same response, so 100s bounds connect AND the streaming body read of each attempt.

## Problem

jawcode routed Kiro through the shared `fetchWithRetry` with only the caller's `opts.signal` and no
per-attempt deadline. A stalled CodeWhisperer stream (connection opened, bytes stop flowing) would
hang the turn indefinitely — the retry budget only covers the HTTP handshake, not a mid-stream
stall.

## Fix

Added `KIRO_REQUEST_TIMEOUT_MS = 100_000` and a `kiroAttemptSignal(callerSignal)` helper that mints
a fresh `AbortSignal.timeout(100s)` combined (`AbortSignal.any`) with the caller's signal. Both
`fetchWithRetry` call sites (initial + the 401-refresh retry) pass it via `prepareInit`, so every
attempt gets its own deadline rather than sharing one across the whole retry budget. Because the
eventstream body is consumed off the same `response`, the timeout bounds connect + stream read,
matching opencodex.

## Tests

- `kiro-stream-integration.test.ts` (+1): a fetch that only settles on `signal` abort, driven by a
  caller `AbortController`, surfaces an `error` turn quickly instead of hanging — proving the signal
  is wired through `prepareInit` to the underlying fetch.

## Notes / divergence

- jawcode keeps the shared `fetchWithRetry` retry surface (5xx/408/429) rather than opencodex's
  fixed `{429,500,502,503,504}`. Retry policy parity is intentionally left as jawcode's existing
  behavior; this phase only adds the missing timeout.

## Verify

- `bun test packages/ai/src/providers/kiro-stream-integration.test.ts` — 11 pass, 0 fail.
- `bun run check:types` (packages/ai) — clean. biome format applied.
