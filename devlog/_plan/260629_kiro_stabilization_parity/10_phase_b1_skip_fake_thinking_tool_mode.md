# B1 — Skip synthetic thinking tags in tool / continue mode

SoT: opencodex `src/adapters/kiro.ts` injection guard. NOTE the SoT moved: commit b496629
("skip fake thinking in tool mode") added a `shouldInjectKiroThinkingTags` helper that also
skipped when tools were advertised, but opencodex HEAD (0254b66) reverted that with the rest of
the unstable reasoning-summary work (commit b19d4a0). This phase was re-aligned to HEAD — see
the "Revision" note below.

## Problem

jawcode injected the synthetic `<thinking_mode>...</thinking_mode>` prompt onto the
current user turn whenever it did not carry `toolResults`. That over-fires in two cases:

- a free-form user turn that also advertises tools (`tools` on the context) — the
  synthetic prompt can leave Kiro waiting for a leading thinking block that never comes,
  stalling before the first tool/exec event;
- the empty `"(continue)"` placeholder turn — there is no user intent to think about.

## Fix

Added `shouldInjectKiroThinkingTags(uim, toolsAdvertised)` mirroring opencodex. The
synthetic prompt is now injected only on a genuine free-form user turn: not when the
turn carries `toolResults`, not when tools are advertised, and not on `"(continue)"`.
Natural leading `<thinking>` blocks the model emits are unaffected — they are still
routed to reasoning by `KiroThinkingParser` on the way back.

## Revision (align to opencodex HEAD)

The PABCD check reviewer flagged SoT drift: opencodex HEAD no longer skips on tool advertisement.
`shouldInjectKiroThinkingTags(uim)` was updated to drop the `toolsAdvertised` condition; it now
skips only `toolResults` turns and `"(continue)"`, with fallback-prose carriers excluded at the
call site via `fallbackEntries`. Matches the current SoT inline condition
`!fallbackEntries.has(currentEntry) && !toolResults && content !== "(continue)"`.

## Tests (kiro-payload.test.ts)

- tool-advertised plain user turn STILL receives the synthetic tags (opencodex HEAD behavior);
- `"(continue)"` placeholder turn skips the synthetic tags;
- tool-result carrier turns skip; free-form xhigh injection stays green.

## Verify

- `bun test packages/ai/src/providers/kiro-payload.test.ts` — 22 pass, 0 fail.
- `bun run check:types` (packages/ai) — clean.
