# 161 — wp12 A synthesis: I planned to break a tested contract

Fermat returned **FAIL**. This one is different in kind from the previous four audits, and worth separating.

## Not "you missed scope" — "your fix was a regression"

The earlier audits caught triage that skewed toward less work. This one caught something worse: the change I
planned would have **actively broken behavior the repository guarantees**.

`packages/coding-agent/test/session-event-ordering.test.ts` contains a test named, in plain words,
**"does not await a slow subscriber"**. My plan was to make the session await subscribers. I would have had to
delete that test to land my own fix — the clearest possible signal that the fix was wrong, sitting in the
file I should have read first.

Three compounding errors:

1. **The fix already existed.** `#subscriberEmitGate` is at `agent-session.ts:1872`, ticketing fan-out at
   `:1894`, matching upstream `133af40c0` including its `message_update` fast path. (I did find this myself
   while reading upstream's diff, before the audit returned — but only after writing a plan that asserted the
   opposite.)
2. **My reproduction was a toy.** I wrote a standalone script with a deliberately-suspending listener and
   treated its output as production evidence. Interactive startup sets `isInitialized = true` *before*
   subscribing, so the suspension I relied on does not occur on that path. A script that reproduces a shape is
   not a probe that reproduces a defect.
3. **The design ignored why the contract exists.** Awaiting subscribers globally means one never-settling
   listener stalls every later event forever — and plan approval *deliberately* suspends a subscriber while
   waiting for the user, so every terminal event would have been held for the length of a human interaction.

## And "UNPROBED" did not save it

I marked ~28 anchors *unprobed* rather than dismissed, framing that as correcting for my track record. The
audit spot-checked seven and found **four small live gaps** — `c0966d0f6`, `aa0884d51`, `ee9c08a5c`,
`e5f65fcd5` — each concrete and in scope.

Labeling work as unexamined does not make closing the card honest. So `20.082` **does not close this cycle**;
wp12 now implements those four, and the card stays open.

## Disposition

| # | finding | disposition |
|---|---|---|
| 1 | fix already exists | **accepted, retracted.** `133af40c0` marked already satisfied; no duplicate gate, no new test file |
| 2 | production defect not established | **accepted.** Toy reproduction withdrawn |
| 3 | plan-approval reentrancy disproves global serialization | **accepted.** Design abandoned entirely |
| 4 | reverses an explicit tested contract | **accepted.** This is the finding that mattered |
| 5 | mode behavior incomplete (RPC/print/bridge/ACP) | **moot** — the design is gone |
| 6 | upstream semantics misstated | **accepted.** Upstream gated `#emitSessionEvent`, not `#emit` |
| 7 | "UNPROBED" is avoidance; 4 live gaps found | **accepted.** Card stays open; those four become this cycle's work |
| 8 | deterministic test formulation | **accepted.** No sleeps; reuse the existing ordering owner |
| 9 | repo contract | confirmed; no protected TUI file in scope |

## What I take from five consecutive FAILs

The pattern has shifted. Cycles 1–4 were scope avoidance. This one was a confident, well-argued plan to make
the product worse — and the disproof was a test file sitting in the same directory as the code I was reading.
The cheapest check I skipped was the one that would have ended the plan in thirty seconds.
