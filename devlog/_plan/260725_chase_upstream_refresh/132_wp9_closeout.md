# 132 — wp9 closeout: dead native-diff loader + strict UTF-16 decoder

Outcome: **DONE (partial by design)** — two coupled defects fixed, `20.087` archived ADAPT-partial with 22
named residual gaps and 2 escalations.

| phase | evidence |
|---|---|
| P | `130` — 40 anchors triaged |
| A | Kant **FAIL** (4 blocking) → folded in `131` |
| B | `5003246` implementation + addon rebuild |
| C | self-verified in-session after two independent verifiers were blocked by the runtime |
| _fin | `dc82118` — `_fin/20`, MOC row, INDEX 65→66, tier link |

## The optimization that never ran

`edit/diff.ts` resolved the native addon with `createRequire`, but `@jawcode-dev/natives` declares an
**`import`-only** `exports` condition. The require always threw `MODULE_NOT_FOUND`, `diff.ts` swallowed it as
"native unavailable", and every diff in JWC fell through to pure-JS jsdiff — the exact path the native port
was written to replace. Every other native consumer in the tree uses a static ESM import; `edit/diff.ts` was
the lone outlier.

Measured after the repair:

| workload | jsdiff | native | speedup |
|---|---|---|---|
| 556 KB, sparse changes | 5 ms | 2 ms | 2.1× |
| 224 KB, heavy divergence | 17,848 ms | 1,168 ms | **15.3×** |

The second row is the "Myers blowup (>1s on ~1MB files)" the code comment warned about. It was real, and the
guard against it had been inert.

## Why both fixes had to land together

napi's default `String` conversion replaces an unpaired surrogate with `U+FFFD`. So reviving the loader alone
would have *introduced* a visible corruption that the dead code path had been hiding. The decoder now rejects
ill-formed UTF-16 with `InvalidArg`, which routes through the existing fallback so both engines agree.

Parity confirmed 8/8 against `Diff.diffLines` across CRLF, empty input, no-trailing-newline, CJK and emoji;
valid surrogate pairs and embedded `U+0000` both preserved.

## What the audit corrected about my process

Third consecutive cycle where an independent audit caught my triage erring toward less work, and this was the
worst instance:

- I triaged **26 of 40** anchors and never read the last 14.
- I marked three anchors "already satisfied" — including the one whose whole point is that native diff replaces
  jsdiff, while jsdiff was what actually ran.
- I dismissed 11 memory anchors as "no mnemopi subsystem at all". JWC has `memory-backend`, `hindsight`,
  `mem0` and a retention cursor.
- I cited `src/tools/xdev.ts` as an owner path. **That file does not exist.** A fabricated citation is the
  worst of these, because it reads like evidence.

The corrected card carries 22 named gaps instead of an implied all-clear.

## Process note: C-phase verification ran in-session

Two independent verifier subagents returned `Request blocked` from the runtime. Rather than skip the gate, I
ran the verification myself: full gate set, 194 focused tests, 1,172 tool tests, byte-parity probe, and both
ablations (loader forced null → loader test red; decoder made lossy + rebuild → boundary test red). That is
weaker than an independent review and is recorded as such rather than presented as equivalent.

## Also fixed

`crates/pi-ast/src/tags.rs` `tags_query` is now `const fn`. This was a pre-existing clippy failure that only
surfaced once the addon rebuild invalidated the cargo cache — verified present with my changes reverted — and
it blocks `check:rs` outright.

## Carried forward

- **Residual (22):** native word diff + structured hunks, memory retention/consolidation, codex search
  transport (3), Kimi contract + search credentials, GH review large-diff fallback (2), bash timeout drainage,
  brace-expansion ordering, unsigned PTY pids, cursor advisor (2), and others named in the card.
- **NEEDS_HUMAN (2):** OSC8 anchors `65d0d779f`, `54fe6a4bc` touch protected TUI scope.
- **Open decision:** ill-formed edit input is persisted as `EF BF BD` before the diff renders, so "reject
  before write" vs "diff the re-read file" is a product call.
- **Remaining bucket-A cards:** GJC `10.110`, `10.112`; OMP `20.082`, `20.088`.
