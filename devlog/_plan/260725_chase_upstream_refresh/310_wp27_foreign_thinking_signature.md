# 310 — wp27: one bad turn wedged the whole session

Source: the "Kimi contract" residual in the wp9 `_fin` card for `20.087`, generalized to its real JWC owner
via OMP `5795515af2`.

| phase | evidence |
|---|---|
| P | reproduced against the real `transformMessages` |
| A | **pass**, boundary chosen from Anthropic's contract |
| B | `1fb5206` |
| C | full `packages/ai` suite green; ablation-verified |

## Why it wedged rather than just failed once

`mustPreserveLatestAnthropicThinking` compared **api**, not provider. Several bundled providers speak
`anthropic-messages` — `anthropic`, `zai`, `opencode-zen` — so a latest turn from one replayed its thinking
signature verbatim into a request to another. Anthropic rejects it: `Invalid signature in thinking block`.

The nasty part is the loop. The offending turn is still the *latest* turn, so the same signature is replayed
on every retry and each one fails identically. The session falls back to another model and stays there until
some unrelated turn completes and the poisoned one stops being latest. From the outside it looks like the
model silently changed.

## The boundary had to come from the contract, not from taste

Tightening a *preserve-verbatim* rule risks the opposite failure: Anthropic **requires** the latest assistant
turn to replay byte-for-byte, so over-stripping breaks signed replay for legitimate switches.

Anthropic's rule covers the target provider's **own** latest response. That makes provider equality exactly
the right predicate — not model-id equality, which would break a `claude-opus` → `claude-sonnet` switch, and
not blanket stripping.

So the same-provider case is a control, not a nicety: `sig_from_anthropic` must **survive** a model-id switch
within `anthropic`. It passed before the fix and still passes after, which is what shows the change is
narrow rather than a blunt strip.

Foreign `redactedThinking` siblings are dropped alongside the signature — sending an opaque block the target
provider cannot verify is not a safe middle ground.

## Two residuals declined as disproportionate

Both probed, neither implemented, and the reasons recorded rather than left as silence:

- **structured hunks** (`hashline/recovery.ts` uses `Diff.structuredPatch`) — the natives package exports
  only `diffLines`; there is no native `structuredPatch`. Porting it means writing new Rust for a path that
  runs only when a hashline edit already failed and is being recovered. The cost is not proportionate to a
  rare error path.
- **memory retention/consolidation** — subsystem-scale design work across `memory-backend` and `hindsight`,
  not a bounded fix. Attempting it inside a work-phase would produce a shallow change to a durable system.

Declining is only honest with the reason attached, so both are now stated on the card.
