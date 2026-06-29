# Fix — first-turn "Recovering from context overflow" false trigger

## Symptom

After B2 (estimated Kiro usage) shipped, a brand-new session whose first prompt was a one-line
greeting immediately showed `Recovering from context overflow` + `Summarizing split turn…` and ran
auto-compaction.

## Root cause (confirmed from the live session log)

Session `019f13ec-bb76-…` first assistant turn usage:
`{"input":1344086,"output":20,"totalTokens":51807,"estimated":true}` on `claude-opus-4.8`
(contextWindow 1,000,000), routed through the Kiro/CodeWhisperer backend.

Two independent defects combined:

1. `estimateKiroInputTokens` (kiro-usage.ts) counted `JSON.stringify(context.tools)` on a fresh
   session. jawcode's `context.tools` are factory-built objects (handler closures + framework
   metadata), so stringifying the whole array ballooned the estimate to ~1.34M tokens — orders of
   magnitude above the wire surface actually sent.
2. `isContextOverflow` Case 2 (overflow.ts) treats `usage.input + cacheRead + cacheWrite >
   contextWindow` as a silent-overflow signal. It trusted the heuristic estimate as if it were real
   provider-reported input: `1,344,086 > 1,000,000` → `#checkCompaction` fired
   `#runAutoCompaction("overflow")` on the very first turn.

(The 51,807 in the status line is `totalTokens` from the `contextUsagePercentage` path — a display
value; the overflow decision reads `input`.)

opencodex doesn't hit this: its estimate feeds Codex's usage display only and there is no
`usage.input > contextWindow` overflow path in that proxy.

## Fix

1. kiro-usage.ts — `estimateKiroInputTokens` now serializes only each tool's wire surface
   (`name` + `description` + `toolWireSchema(tool)`) via `toolWireText`, never the factory object.
2. overflow.ts — `isContextOverflow` Case 2 is skipped when `message.usage.estimated` is true. A
   heuristic estimate is not a trustworthy "actual input exceeded the window" signal; only real
   provider-reported usage drives silent-overflow detection. Case 1 (error-message patterns) is
   unchanged.

## Tests

- kiro-usage.test.ts: a tool with a 200k-char non-wire field produces the same (tiny, <1000) estimate
  as the wire-only tool — bloat no longer inflates input.
- overflow-utils.test.ts: estimated usage of 1.34M against a 1M window is NOT overflow; the same
  value as real (non-estimated) usage still IS overflow; real usage under the window is not.

## Verify

- `bun test` packages/ai full suite: 1394 pass, 0 fail.
- `bun run check:types` clean; biome clean.
