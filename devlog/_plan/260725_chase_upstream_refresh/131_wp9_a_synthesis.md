# 131 — wp9 A synthesis: audit FAIL folded

Kant returned **FAIL** with 8 required fixes. All folded. The audit found a defect I had missed entirely and
disproved the framing of the one I had found.

## The finding I did not have

**The native diff has never loaded.** `edit/diff.ts:67` resolves the addon with `createRequire`, but
`packages/natives/package.json` exports only an `import` condition — no `require`. So the call throws
`MODULE_NOT_FOUND`, `diff.ts:82` swallows it as "native unavailable", and every diff in JWC silently runs the
pure-JS path the native port was written to replace.

I verified it independently: `require("@jawcode-dev/natives")` → `MODULE_NOT_FOUND`, while every other consumer
in the tree (`agent-session.ts`, `lsp/render.ts`, `tools/fetch.ts`, `bash-executor.ts`, `ast-grep.ts`, …) uses
a plain static ESM import and works. `edit/diff.ts` is the lone outlier.

That reframes the cycle: the headline is not a UTF-16 edge case, it is a dead optimization whose own comment
claims it "avoids the pure-JS Myers blowup (>1s on ~1MB files)".

It also creates an ordering constraint the draft could not have known about: **repairing the loader first
would newly expose the U+FFFD corruption to users.** Decoder first, loader second.

## The correction that matters most about my own process

This is the **second consecutive cycle** where an independent audit caught my triage erring toward less work.
wp8 was "no IRC subsystem" from one wrong path. Here it is worse in kind:

- I triaged **26 of 40** anchors and never read the last 14.
- I called three anchors "already satisfied" that are not — including `52ad6516e`, whose whole point is that
  native diff replaces jsdiff, when jsdiff is exactly what still runs.
- I dismissed 11 memory anchors as "JWC has no mnemopi subsystem at all". JWC has `memory-backend`,
  `hindsight`, `mem0` and a retention cursor. The vector/embedding anchors are still N/A, but for the much
  narrower reason that there is no local vector kernel — not because memory is absent.
- I cited `src/tools/xdev.ts` as an owner. **That file does not exist.** I invented it.

A fabricated owner path is the worst of these, because it looks like evidence.

## Verification before acceptance

| finding | independent check | holds? |
|---|---|---|
| loader is dead | `createRequire("@jawcode-dev/natives")` → `MODULE_NOT_FOUND`; `exports` has only `import` | **yes** |
| 14 anchors untriaged | card has 40 anchors; draft table covered 26 | **yes** |
| word diff / structured patch still JS | `modes/components/diff.ts` uses `Diff.diffWords`; `hashline/recovery.ts` uses `Diff.structuredPatch` | **yes** |
| napi 3 supports the fix | `Cargo.toml:248` napi 3; `hashline.rs:153` already uses `into_utf16()` + `Result` | **yes** |
| rebuild required | `.node` is gitignored; `check:rs` runs guard/fmt/clippy only | **yes** |

## Disposition

| # | finding | disposition |
|---|---|---|
| 1 | reachability premise false; loader repair missing from scope | **accepted.** Premise retracted; loader repair added, ordered after the decoder |
| 2 | only 26/40 anchors triaged | **accepted.** Full 40-anchor ledger; counts corrected to 2 / 14 / 22 / 2 |
| 3 | three native-diff anchors wrongly "satisfied" | **accepted.** Reclassified: one implemented, two deferred gaps |
| 4 | memory anchors wrongly dismissed | **accepted.** Retention/consolidation anchors become deferred gaps needing semantic comparison |
| 5 | unsupported deferrals; fabricated `xdev.ts` owner | **accepted.** Per-anchor verdicts; codex search recorded as three live gaps; xdev marked N/A with the fabrication noted |
| 6 | "file integrity" framing wrong after disk persistence | **accepted.** Recorded as an explicit open decision for the user; this cycle only makes the two engines agree |
| 7 | tests must not skip; rebuild ordering | **accepted.** Three distinct tests, and the no-skip requirement is called out because a silent skip is how this hid |
| 8 | Rust scope guard / protected TUI | **accepted.** Fix stays in `crates/pi-natives`; the two OSC8 anchors are flagged NEEDS_HUMAN, not dropped |

## Effect on the outcome

The draft would have shipped a latent-only fix while leaving a dead optimization undiscovered and 14 anchors
unexamined. The corrected cycle ships **two** fixes — the decoder and the loader that makes it matter — and
hands forward 22 named gaps instead of an implied all-clear.
