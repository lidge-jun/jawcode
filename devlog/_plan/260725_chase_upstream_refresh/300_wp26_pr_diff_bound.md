# 300 — wp26: the residual that was already handled

Source: named residual in the wp9 `_fin` card for `20.087` — *"GH review large-diff fallback"*.

| phase | evidence |
|---|---|
| P | traced the full path from `gh pr diff` to the model |
| A | **pass**, after declining to invent a fix |
| B | `ff3b286` |
| C | gates green; opt-out guard ablation-verified |

## The finding is "already satisfied"

`fetchPrDiffFresh` returns the verbatim `gh pr diff` output. `pr://<n>/diff/all` serves that payload with **no
cap of its own**. Reading only those two files, it looks like an unbounded diff reaches the model.

It does not. `read.ts` runs every internal-URL body through `truncateHead` at 3000 lines / 50 KiB, and the
head is preserved so the file list survives. A 100k-line diff comes back bounded.

## Declining to invent a fix

The pull here was to add a cap inside the `pr://` handler so the phase would have something to show. That
would have been redundant code justified by the card's wording rather than by the tree — the same instinct
that produces a "fix" for a bug that does not exist.

What is genuinely fragile is *where* the bound lives. The contract spans two files and hangs on a **negative
condition**: `pr://` must not be in the `ignoreResultLimits` allowlist that `skill://` is in. Nothing
expressed that. Adding one scheme to that condition would silently hand a 200k-line diff to the model, and
no test would notice.

So this phase adds coverage, not a fix:

- the bound holds on a 100k-line synthetic diff, with the head kept;
- a small diff passes through untouched;
- `skill` remains the **only** `ignoreResultLimits` opt-out.

Ablation granting the opt-out to `pr` turns the third test red.

## Why this counts as work

A residual list is only honest if "already satisfied" is a real outcome that can be reached and recorded.
The alternative — closing it on inspection with no test — leaves the same invisible dependency in place, and
the next person re-derives the whole path. The alternative in the other direction is worse: shipping a
second cap that does nothing.
