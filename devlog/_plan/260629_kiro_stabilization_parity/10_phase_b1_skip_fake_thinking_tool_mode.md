# B1 — Skip synthetic thinking tags in tool / continue mode

SoT: opencodex `src/adapters/kiro.ts` `shouldInjectKiroThinkingTags` (commit b496629
"fix(kiro): skip fake thinking in tool mode").

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

## Tests (kiro-payload.test.ts)

- tool-advertised plain user turn skips the synthetic tags but keeps the user text;
- `"(continue)"` placeholder turn skips the synthetic tags;
- existing free-form xhigh injection + tool-result-carrier skip tests stay green.

## Verify

- `bun test packages/ai/src/providers/kiro-payload.test.ts` — 22 pass, 0 fail.
- `bun run check:types` (packages/ai) — clean.
