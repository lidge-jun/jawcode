# 400 — wp36: the N/A that was right, and the bug next to it

Source: the final residual on card `20.088` — *"robojwc rate-limit/admission parity"*. The card names no
anchor, so this started as a capability search.

| phase | evidence |
|---|---|
| P | traced upstream's shape to its JWC counterpart |
| A | **pass**, after stress-testing my own N/A |
| B | `9b91167` |
| C | gates green; ablation-verified |

## The named shape genuinely does not apply

Upstream `base.ts` defines `isExplicitlyAvailable`, which admits a provider when the user *explicitly*
selects it even if auto-chain admission would reject it. Their Exa overrides it so an explicit selection
routes through Exa's public MCP fallback instead of silently becoming a different engine.

Two facts make that inapplicable here, and both are now pinned by test:

1. **This fork removed the fallback.** `exa.ts` throws `Exa MCP fallback is disabled in jawcode`. The
   unauthenticated path the split exists to admit does not exist.
2. **DuckDuckGo is the only keyless provider**, its `isAvailable()` is unconditionally `true`, and
   `resolveProviderChain` appends it as terminal fallback regardless.

So the explicit/auto split would have nothing to admit. Porting it would be a method with no caller.

## Auditing the N/A found the real defect

I reached that verdict quickly — which is the exact shape I got wrong in **wp22**, where a residual that
looked non-applicable had a live bug one layer over. So I read the admission path properly instead of
filing it.

The explicit branch drops an unavailable preferred provider **with no diagnostic at all**. Search still
works, because DuckDuckGo is appended — but the substitution is invisible. A user whose `EXA_API_KEY` expired
sees results they believe came from Exa. A missing credential presents as a provider that simply got worse.

Fixed with a warning naming the provider and the reason. Deliberately **not** a hard failure: the terminal
fallback stays unconditional so a missing credential never breaks web search. The tests pin both halves —
the warning exists, and the fallback still happens.

## Why record the N/A rather than just closing it

The two facts above took real reading to establish. Left implicit, the next person re-derives them, or worse,
ports `isExplicitlyAvailable` because upstream has it. Pinning them by test makes the verdict checkable
rather than remembered.
