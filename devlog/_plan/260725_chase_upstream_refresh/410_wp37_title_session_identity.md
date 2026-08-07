# 410 — wp37: a one-token upstream change that needed reading

Source: two of the 27 named follow-ups on the still-open card `20.082` — OMP `e3b117678` and `3cb925887`.

| phase | evidence |
|---|---|
| P | traced both anchors to their JWC counterparts |
| A | **pass**, after catching the guard coupling and a bad ablation |
| B | `bcce27c` |
| C | gates green; two line-verified ablations |

## The gap

Credential selection is session-sticky: `AuthStorage` pins its choice on the session id, which is what keeps
a multi-account setup on one account with a warm prompt cache.

`generateTitle` passed `sessionManager.getSessionId()`. But `AgentSession.sessionId` resolves
`#providerSessionId ?? sessionManager.getSessionId()` — so whenever a provider session id was set, the title
request resolved credentials under a *different* key than every other request in the session and quietly
defeated the stickiness.

## Upstream's diff is one token; copying it would have broken something else

`e3b117678` changes `getSessionId()` to `sessionId` and nothing else. Trivial to port — and wrong to port
blind, because the **same variable** is reused after the await:

```
sessionId !== this.sessionManager.getSessionId()   // detects a session switch mid-flight
```

Swapping the capture without touching that guard compares a provider session id against a session-file id.
They never match, so a title generated for a session the user already switched away from would be applied
anyway. The two ids are now captured separately and each compared against its own source.

## My first two ablations passed, and that was my bug

Both came back green, which reads as "the tests are weak". I investigated rather than accepting it: the
`perl` substitution had matched a *different* `const sessionId = this.sessionId;` at line 6210, inside
`clearContext()`. The line I meant to ablate was untouched.

Re-run line-targeted at 6261 and 3599, each turns exactly 1 of 4 red. Worth recording because a passing
ablation is ambiguous — it means either the test is weak *or* the ablation missed, and the two need
different responses.

## The other anchor was already satisfied

`3cb925887` (abort title generation during dispose): `dispose()` already bumps the generation counter and
aborts the controller whose signal the request carries. Pinned by test rather than closed on inspection.
