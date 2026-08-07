# 420 — wp38: the session that kept changing accounts

Source: OMP `c6cff316b`, from the follow-up list on the still-open card `20.082`.

| phase | evidence |
|---|---|
| P | traced the promotion gate against the ranking path |
| A | **pass**, after an existing test disproved my first fix |
| B | `abd8ede` |
| C | full `packages/ai` suite green; ablation-verified |

## The gap

A Pro-gated model always re-ranks — `requiresProModel` forces `shouldRank` true. But the sticky-promotion
block was gated on `!shouldRank && !requiresProModel`, so it never ran for exactly the sessions that re-rank
on every request.

Ranking mixes a stable session hash with usage-derived weights. When 5h/7d headroom flips between two
eligible accounts, the same hash lands on the sibling and `#recordSessionCredential` overwrites the binding.
The user sees `/usage` alternating accounts mid-session, and the server-side prompt cache cold-starts each
time.

## An existing test disproved my first fix

I promoted the sticky candidate whenever one existed. `re-ranks an Anthropic session after more than one
hour idle` went red immediately — Anthropic's 1h prompt-cache idle window *deliberately* re-ranks, and
unconditional promotion defeats the very re-ranking that window exists to enable.

Gated on `sessionPreferredIsWarm`. An idle-expired pin still re-ranks; a warm one stays put. This is the
second time this session that a suite caught a fix that was correct in isolation and wrong in context.

## My regression test could not fail — twice

It passed under ablation on the first attempt, and again after I "fixed" it. Rather than shrug at a weak
assertion, I looked for why:

1. It flipped the **primary** usage window, but the ranker sorts on `secondaryUsed` first — so the candidate
   order never actually changed.
2. Usage reports are **TTL-cached**, so the second `getApiKey` replayed the first ranking without re-ranking
   at all.

Both had to be fixed together: flip `secondaryUsed`, and advance the mocked clock past the usage TTL while
staying inside the stickiness warm window. Only then did ablation turn it red.

A test that cannot fail is worse than no test — it reports success for a fix that was never exercised. Two
false greens in one phase is worth recording as a pattern, not an anecdote.
