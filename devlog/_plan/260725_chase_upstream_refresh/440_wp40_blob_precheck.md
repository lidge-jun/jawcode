# 440 — wp40: paying for a walk over data that had nothing to find

Source: OMP `1e209caee`, from the follow-up list on the still-open card `20.082`.

| phase | evidence |
|---|---|
| P | measured the walk against a synthetic history |
| A | **pass**, superset argument checked branch by branch |
| B | `c4ad927` |
| C | gates green; ablation-verified |

## The cost

`resolveBlobRefsInEntries` handed **every** non-session entry to `resolvePersistedBlobRefs`, which is
async-recursive and allocates a promise per object key at every depth. Plain-text entries — the bulk of a
long history — have no `blob:sha256:` reference anywhere, so all of that work resolves nothing.

Measured rather than asserted, on a 4000-entry text-only history:

| path | cost |
|---|---|
| async recursive walk | **15.8ms** |
| synchronous precheck | **1.6ms** |
| entries actually needing resolution | **0** |

That lands on every session open and every fork.

## Why the precheck cannot skip real work

A gate in front of real work is only safe if it never returns false when the walk would have found
something. So I enumerated every resolution branch: image-block `data`, `image_url` as a string,
`image_url.url` as an object, and the generic `data` key case. **All four terminate in `isBlobRef(someString)`.**

A recursive string scan for the same prefix is therefore a strict superset — if it returns false, the walk
had nothing to do. The tests cover each shape, plus refs nested several levels deep and inside nested
arrays, plus a negative case: a prose mention of the prefix mid-string must *not* count, because `isBlobRef`
is `startsWith`, not `includes`.

## What is deliberately not gated

The image-block fast path above the gate resolves its own refs directly and is untouched. Only the generic
sweep is gated, so image rehydration cannot regress — confirmed by the 19 blob/resident tests alongside the
136 session-manager tests.
