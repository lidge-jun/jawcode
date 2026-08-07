# 290 — wp25: `cp ~/{one,two} dest` wrote to a directory named `~`

Source: named residual in the wp9 `_fin` card for `20.087` — *"brace expansion before tilde in
`brush-core-vendored`"*.

| phase | evidence |
|---|---|
| P | live differential against `/bin/bash` |
| A | **pass**, blast radius bounded before editing vendored Rust |
| B | `a74b645` |
| C | gates green; ablation required rebuilding the addon both ways |

## The bug

```
echo ~/{alpha,beta}
jwc  → /Users/jun/alpha ~/beta
bash → /Users/jun/alpha /Users/jun/beta
```

Brace expansion runs first and `brace_expand_if_needed` joined its results with `join(" ")` into one string.
Tilde expansion is gated on `tilde_expansion_at_word_start`, so only the leading result was at a word start.

Every path after the first stayed a literal `~` — and `~` is a perfectly valid directory name. So
`cp ~/{one,two} dest` copies one real file and one file from a directory called `~`, or creates it. That is
the kind of failure that looks like it worked.

## Bounding the risk before touching vendored code

This is vendored upstream shell internals; a careless change breaks quoting or field splitting for
everything. So I probed eight forms against `/bin/bash` **before** editing:

| form | before |
|---|---|
| `~/{alpha,beta}` | **diverged** |
| `~root/{x,y}` | **diverged** |
| `a{b,c}d ~/{e,f}` | **diverged** |
| `~/"a b"/{x,y}` | **diverged** |
| `{a,b}`, `pre{a,b}post`, `{1..3}`, `"~/{a,b}"` | already matched |

That is what scoped the fix: leading-tilde handling on pieces *after* the first. The first still goes through
the parser's own word-start path and is untouched. All nine forms now match bash exactly.

`scripts/check-rust-scope.ts` confirmed `brush-core-vendored` is an in-bounds crate before I edited it.

## Bash is the oracle, not me

The tests compare against `/bin/bash` rather than hand-written strings. A hand-written expectation is
precisely how a wrong behavior gets frozen into a suite — I would have been asserting my own output.

## Ablation across the N-API boundary

This is Rust behind a native addon, so an ablation means rebuilding the addon, running, restoring, and
rebuilding again. Worth noting because my first attempt was invalid: neutering the call made the helper dead
code, `-D warnings` failed the build, and the tests then ran against the **stale binary** and passed. A green
suite there proved nothing. The second attempt short-circuited inside the helper, compiled, and turned 4 of 6
red with the no-tilde control staying green.
