# 390 — wp35: the codex quota never appeared, and nobody would have noticed

Source: named residual in the wp10 `_fin` card for `20.088` — *"quota-window display comparison"*.

| phase | evidence |
|---|---|
| P | traced both usage producers against the consumer |
| A | **pass**, after rejecting the obvious fix |
| B | `c10359f` |
| C | gates green; ablation-verified |

## Three mismatches in one comparison

The status line picked its rows with `windowId === "5h" && !tier`. Set against how limits are actually
produced:

| mismatch | consequence |
|---|---|
| **Case** — usage layer uses `windowId?.toLowerCase()`, status line did not | a `5H` from any provider misses |
| **Duration** — `openai-codex` derives its id from reported seconds | a five-hour window calling itself `1h` misses |
| **Tier** — `openai-codex` *always* sets `scope.tier` | **every** codex limit rejected; its quota never rendered |

The third is the real one. A user on a Codex plan simply had no quota display, and there is no error to
notice — an absent row looks like "no data yet".

## The obvious fix was wrong

Delete the `!tier` guard so codex rows pass. But `claude.ts` builds `anthropic:7d:opus` and
`anthropic:7d:sonnet` as **per-model** rows distinguished *only* by `tier`. Removing the guard lets whichever
arrives first stand in for the account-wide quota — a wrong number, displayed confidently. That is worse than
the missing row.

So I read both producers instead of patching the consumer by feel:

- **Anthropic** leaves `tier` unset on the shared row → `tier` is a valid discriminator there.
- **openai-codex** always sets `tier`, but sets `modelId` *only* on the per-model variant → `modelId` is the
  discriminator there.

Both are handled, in the place each belongs: `modelId` filters in the caller, `tier` in the classifier.

## Why extract it

The classification now lives in its own module, so the three-way mismatch has one home and can be tested
without constructing a status line. Ablating it back to `=== && !tier` turns 4 of 8 red while the Anthropic
per-model control stays green — which is what shows the fix widened the match without loosening it.

## Not mine

Three failures in the status-line session-accent suites. Verified pre-existing by stashing every change:
identical 68 pass / 3 fail.
