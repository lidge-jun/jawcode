# 250 — wp21: a session kept receiving messages while it shut down

Source: **residual gap 2** in the wp8 `_fin` card for `20.089` (anchors `da2e630fb` / `54f4a1894`).
Three of five residuals now closed.

| phase | evidence |
|---|---|
| P | gated-dispose reproduction |
| A | **pass**, after closing a test-fidelity hole |
| B | `5bcb0ad` |
| C | gates green; ablation on the production line |

## The window

`sdk.ts` wrapped `session.dispose` and called `agentRegistry.unregister` in a `finally` — i.e. only after
`originalDispose()` resolved. Dispose does network and subprocess teardown, so that is a real interval, and
for all of it:

- the ref still carries a live `session`, and
- `listVisibleTo()` still reports the agent as `running`/`idle`.

`tools/irc.ts` picks targets from exactly that list and calls `respondAsBackground(...)` on `target.session`.
So a peer could send a message to a session mid-teardown and get a failure, or worse, partial work on a
session whose resources were already going away.

The fix needed no new mechanism: `detachSession` already existed for this and was simply never called from
the wrapper. Detach first, keep `unregister` in the `finally`.

## The audit's real finding was about my test

`createAgentSession` needs auth storage, a model registry and network access, so I asserted the ordering on a
**mirrored** wrapper. That is the same hole the wp12 C-audit found: a test that never touches production
code stays green when production changes.

I verified it rather than assuming: with only the mirrored test, deleting `agentRegistry.detachSession` from
`sdk.ts` left **2 of 2 passing**. So I added a source-shape assertion — `detachSession` must appear before
`await originalDispose()`, and `unregister` after it. With that in place the same deletion turns the suite
red.

A source-shape test is a weaker instrument than executing the path, and I would rather say so than dress it
up: it pins ordering, not behavior. It is the right trade here only because the behavioral half is covered
by the mirrored wrapper and the alternative is no production coverage at all.

## Residual tracker

`20.089` residuals: 1 (`7550bd887`) done in wp19, 2 (`da2e630fb`/`54f4a1894`) done here, 4 (`477112e81`) done
in wp20. Still open: 3 (`e00eb7cfb`, OTLP — needs a live collector probe rather than a blind port) and 5
(`8b0402b32`, cursor mounted-device approval — closes N/A once a focused approval-denial test confirms the
bypass is absent).
