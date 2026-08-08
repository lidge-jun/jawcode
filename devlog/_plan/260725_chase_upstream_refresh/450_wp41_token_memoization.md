# 450 — wp41: counting the same tokens over and over

Source: OMP `a28eb0f47`, from the follow-up list on the still-open card `20.082`.

| phase | evidence |
|---|---|
| P | measured both halves of the anchor before porting anything |
| A | **pass**, in-place mutation hazard traced to the provider write sites |
| B | `d9cea36` |
| C | gates green; two independent ablations |

## The cost

`#estimateMessagesTokens` re-walked the whole message history on every call, and post-turn maintenance
calls it up to twice per turn. The walk is over a prefix that by definition cannot have changed since the
previous turn.

Measured on this tree rather than assumed:

| history size | one full walk |
|---|---|
| 500 messages | ~358ms |
| 2000 messages | ~1.15s |
| 6000 messages | ~3.46s |

Warm walk after the fix, at n=2000: **0.04ms**.

## Why the cache needs a settle gate

The natural key is message identity, and that is exactly where this gets dangerous. Providers push content
blocks onto a live assistant message while it streams — `packages/ai/src/providers/openai-completions.ts:581`
and `:604` both mutate `content` in place. Caching a message mid-flight would freeze a partial count and
keep handing it back for the rest of the turn.

So an assistant message counts as settled only with real usage **and** a terminal non-error stop reason.
Aborted and errored turns stay uncached, because they can still be repaired or retried in place. Every other
role is immutable once appended and settles on arrival.

The key also carries the encoding, so switching models does not reuse a count produced under a different
tokenizer.

## What is deliberately not ported

Upstream's anchor also caches `convertToLlm`. I measured that half first: 0.08ms at n=500, 0.44ms at n=2000,
0.14ms at n=6000 per call. It is not hot in this tree, and caching it would buy invalidation risk with no
speedup — so the port stops at the half that was actually costing something.

## Ablations

Two, each isolating a different guard. Removing the settle gate turns one test red — the streaming-mutation
case, which is the whole reason the gate exists. Dropping the encoding key turns a *different* test red. A
single ablation covering both would not have told me whether either guard was load-bearing on its own.

Test: `packages/coding-agent/test/message-token-cache.test.ts`.

## The gate that was not checking anything

Worth recording, because it invalidated part of this session's verification method rather than just this
work-phase. The gate recipe in use ran `bun run check:ts 2>&1 | grep -cE "error TS"` and read `0` as green.

`check:ts` chains `check:tools` first, and that is biome. Biome never prints `error TS`, so every lint and
format failure scored zero. Worse, `check:tools` exits non-zero on them, which `&&`-short-circuits the rest
of the chain — the workspace `tsc` pass never ran. Three lint errors and one format diff had accumulated,
and behind them sat two genuine type errors in the wp41 code itself: `Encoding` used as a parameter type
without an import, and `cached?.encoding` leaving `cached` possibly-undefined on the return.

All cleared in `7b9034e`. The gate is now read by exit code, not by grepping for a string that one stage of
a four-stage chain happens to emit.

A second-order lesson landed with it. The encoding-key test asserted an exact source spelling, so making the
undefined check explicit broke a green test without changing any behavior. It was rewritten to match the
declaration body by pattern and paired with a behavioral test — a switched encoding must recompute rather
than serve the stored count. Source-shape pins are useful for "the call site still uses the result", but
they should not pin punctuation.
