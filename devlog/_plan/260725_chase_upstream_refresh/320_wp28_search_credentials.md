# 320 — wp28: the right key, sent to the wrong system

Source: the "search credentials" residual in the wp9 `_fin` card for `20.087`. It named one item; it turned
out to span two anchors with **opposite** outcomes.

| phase | evidence |
|---|---|
| P | traced both anchors to their JWC owners |
| A | **pass**, after catching a half-fix |
| B | `cf4e0a6` |
| C | gates green; ablation-verified |

## Anchor 1 — a live gap

`kimi.ts` posts to `api.kimi.com/coding/v1/search`. That endpoint belongs to **Kimi Code**. But
`findApiKey` resolved a `moonshot` credential *first*, and `isAvailable` advertised on it — and Moonshot Open
Platform (`api.moonshot.ai`, `MOONSHOT_API_KEY`) is a different credential system entirely.

So a user with a perfectly valid Open Platform key got Kimi selected as their search engine, a 401 from an
endpoint that never accepts that credential, and a silent demotion to some other engine. The key was fine.
The system it was sent to was wrong.

### The half-fix the audit caught

Fixing `findApiKey` alone changes nothing the user can see. `isAvailable` is what makes the provider
**selectable**, so a moonshot-only user would still have Kimi chosen and still hit the 401. The two have to
agree, and the tests now pin that agreement from both sides: `isAvailable(moonshot-only) === false`, and
`kimi-code` as the sole storage lookup.

While reading the failure path I also found the missing-credential error telling users to run
`gjc /login moonshot` — wrong command name for this fork, and wrong provider. Being told to authenticate
against the system that *caused* the failure is worse than no guidance.

## Anchor 2 — structurally absent

Upstream's perplexity leak (`c97449c51d`) emitted the OAuth session JWT as a direct api-key config, so a
transport failure on the consumer endpoint fell through and sent the session token to `api.perplexity.ai`.

JWC cannot do that: `resolveAuth` returns exactly **one** typed credential, and `searchPerplexity` dispatches
on the type with a single `callPerplexityApi` site reachable only after the oauth/cookies branch returns.

I pinned it rather than declaring N/A. The property is enforced by control flow, and control flow is exactly
what a well-meaning "add a fallback when the ask endpoint drops the socket" refactor would change — which is
how upstream got the leak in the first place.

## `20.087` closing state

Every named residual is now resolved one way or another: implemented (codex endpoint, brace/tilde, foreign
signatures, kimi scope), already satisfied and pinned (bash drainage, PTY pids, PR diff bound, perplexity
isolation), declined with reasons (structured hunks, memory retention), or out of scope pending explicit
authorization (word diff, 2 OSC8 anchors — protected TUI).
