# B2 — Estimated token usage + context-usage percentage

SoT: opencodex `src/lib/token-estimate.ts` + the kiro adapter usage path (commits 0b26c89
"emit estimated usage", 23bd889 "current-turn usage delta", e50ca23 "mark heuristic usage
as estimated", 45272b2 / 7374c3a "context usage percentage for totals").

## Problem

CodeWhisperer's event stream returns no token usage. jawcode initialized `usage` to all
zeros and then ignored both the numeric `usage` event and the `contextUsagePercentage`
frame (`case "usage": break`). Every Kiro assistant turn therefore reported `input/output/
totalTokens = 0`: the cost line stayed at $0 and any usage display showed nothing. (Auto-
compaction has its own native-tokenizer fallback, so it still functioned, but the visible
usage/cost was wrong.)

## Fix

New `kiro-usage.ts` (dependency-free, parity with opencodex):

- `estimateKiroTokens(text, modelId)` — char-based estimate, ~3.5 chars/token for the Kiro
  model family (code/JSON-heavy), ~4 for generic prose. Over-counting fails safe.
- `estimateKiroInputTokens(context, modelId)` — current-turn input only; counts the stable
  system-prompt + tool-schema overhead once on a fresh session, and excludes it on resumed
  turns so the input delta is not inflated by repeated history.
- `contextUsageTotalTokens(pct, window)` — converts a server-sent `contextUsagePercentage`
  into an absolute total, guarded against missing/zero inputs.
- `finalizeKiroUsage(usage, …)` — fills `input`/`output`/`totalTokens`, prefers the
  context-usage total when present (else input+output), and sets `usage.estimated = true`.

`streamKiro` now accumulates assistant text/thinking + tool-call argument length into
`outputChars`, captures the latest `contextUsagePercentage`, and on done calls
`finalizeKiroUsage` followed by `calculateCost(model, usage)`. `parseKiroPayload` learned a
`context_usage` branch; `Usage` gained an optional `estimated` flag.

## Tests

- `kiro-usage.test.ts` (6): ratio/empty handling, percentage→total guards, fresh-vs-resumed
  input estimate, finalize prefers context-usage total, finalize fallback.
- `kiro-stream-integration.test.ts` (+2): end-to-end text response yields non-zero estimated
  usage; a `contextUsagePercentage` frame drives `totalTokens` off the model window.

## Verify

- `bun test` kiro suites — 50 pass, 0 fail.
- `bun run check:types` (packages/ai) — clean. biome format applied.
