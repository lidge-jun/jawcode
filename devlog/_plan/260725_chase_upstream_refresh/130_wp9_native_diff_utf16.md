# 130 — wp9 P: repair the dead native-diff loader, then reject ill-formed UTF-16

wp9 takes `20.087` (OMP: native diff, search, memory, and performance kernels).

> **Revised after A-audit (Kant, FAIL — reachability premise false, 14 anchors never triaged).** The audit
> found a defect I had missed entirely and disproved the framing of the one I had found. Both corrections are
> kept visible.

## Retracted premise, and the bigger defect underneath it

The draft asserted "the native path is the default for every edit diff". **False.** The native diff has never
loaded at all:

- `edit/diff.ts:67` resolves the addon with `createRequire(import.meta.url)`.
- `packages/natives/package.json` declares `exports: { ".": { types, import } }` — an **`import`-only**
  condition, with no `require` condition.
- So `require("@jawcode-dev/natives")` fails, `diff.ts:82` swallows it as "native unavailable", and every diff
  silently runs the pure-JS `Diff.diffLines`.

Reproduced directly: `require(...)` → `MODULE_NOT_FOUND`. Every *other* consumer in the tree
(`agent-session.ts`, `lsp/render.ts`, `tools/fetch.ts`, `exec/bash-executor.ts`, `tools/ast-grep.ts`, …) uses a
plain static ESM import and works. `edit/diff.ts` is the lone `createRequire` outlier.

That inverts the cycle's value: the headline is not a UTF-16 edge case, it is that **the native line-diff
optimization — the thing whose comment claims it "avoids the pure-JS Myers blowup (>1s on ~1MB files)" — has
been silently inert.**

## The UTF-16 defect is real, but it is a latent addon bug

`crates/pi-natives/src/linediff.rs:273` declares `diff_lines(old_str: String, new_str: String)`. napi's default
`String` conversion is lossy: an unpaired surrogate becomes `U+FFFD` rather than an error. Probing the built
addon directly (bypassing the broken loader):

```
native:  added "a\uFFFD"      ← corrupted, and the trailing \n is lost
jsdiff:  added "a\uD800\n"    ← preserved
```

So the two implementations genuinely disagree. But today that divergence is unreachable through
`generateDiffString`, because the native side never loads. **Fixing the loader without also fixing the decoder
would newly expose the corruption.** The two must land together, loader second.

### Where a lone surrogate can actually come from

Not from file reads: `edit/read-file.ts` decodes UTF-8, so a lone surrogate cannot survive a read. It arrives
from **model tool arguments** — `JSON.parse` preserves `\ud800`, and the edit schema accepts a bare
`z.string()`. The audit's sharpest point follows: Bun's write encodes that surrogate to `EF BF BD` on disk, so
a diff that "preserves" `D800` would be showing the user something that is *not* what was persisted.

This cycle therefore does **not** claim to preserve ill-formed input. It makes the native and JS paths agree,
and records the persistence question as an explicit open decision rather than papering over it.

## Anchor triage — all 40, corrected

The draft triaged 26 of 40 and never read the last 14. It also called three anchors "already satisfied" that
are not. This is the second consecutive cycle where my triage erred toward less work; the ledger below is the
correction.

| anchor(s) | JWC state | disposition |
|---|---|---|
| `8f17a0300` ill-formed UTF-16 | `linediff.rs:273` takes `String`; corruption reproduced against the built addon | **IMPLEMENT** |
| `52ad6516e` native diff replaces jsdiff | **not satisfied** — the loader is dead (`exports` has no `require`), so jsdiff is what actually runs | **IMPLEMENT (loader repair)** |
| `3ec594f3e` native word diff + structured hunks | JWC has line diff only; no native word diff, no structured patch | **GAP — deferred, named** |
| `2b7707e6d` native word diff + hashline recovery | `modes/components/diff.ts:68` still calls `Diff.diffWords`; `hashline/recovery.ts:96` still calls `Diff.structuredPatch`/`applyPatch` | **GAP — deferred, named** |
| `b6e9d387d`, `a480e9920` retention cursor / unretained turns | JWC **does** have memory: `memory-backend/resolve.ts` selects three backends; `hindsight/state.ts:310` implements retention-cursor behavior. Not a blanket N/A | **GAP — deferred, needs semantic comparison** |
| `831b94fee`, `d698580d6` dispose-time consolidation | analogous JWC session-dispose lifecycle exists | **GAP — deferred, named** (omitted from the draft entirely) |
| `4ffe1822d`, `3c84e2c41`, `46e296637`, `22a5fb3d9`, `23201555e`, `7542b31ee`, `7ca023561`, `e6d3064be`, `6cc0c71d1` vector kernels / embedding cache | non-applicable for the **narrow** reason that JWC has no local vector kernel (`vectors.rs` absent) and no embedding-model cache — not because it lacks memory | **non-applicable** |
| `f3bbc23d0` vectorized hamming | no `vectors.rs` or equivalent kernel | **non-applicable** |
| `bb7faf62c` `uu-rm` empty operand | no `crates/vendor/uu-rm` or embedded `rm` owner | **non-applicable** |
| `f8e7b29b7` hashline trailing colon | JWC uses a different `≔` grammar; native `hashline.rs` is formatting, not tokenization | **non-applicable (bug class compared)** |
| `178dd214b` diff benchmark | bench-only, no product behavior | **non-applicable (bench)** |
| `2d27bfdd6`, `feac38298`, `9c2682cea` codex search transport | **live gaps**, not "different surface": `web/search/providers/codex.ts` hardcodes ChatGPT transport, ignores configured transport, and accepts only OAuth | **GAP — deferred, named** |
| `44c8627b0` unsigned PTY pids | `crates/pi-natives/src/pty.rs` is live in JWC | **GAP — deferred, named** |
| `044b74594` PTY start hangs / launch broker | `pty.rs` live, but `src/launch/` broker owner absent | **partial N/A — PTY half deferred** |
| `36280b56e` leaked-thinking signatures | no leaked-thinking wrapper in `packages/ai` after a full search | **non-applicable** |
| `e99d565e2` xdev web_search | `src/tools/xdev.ts` **does not exist** — the draft cited a fabricated owner | **non-applicable** |
| `913ec0baa` Kimi contract | live gap at `packages/ai/src/providers/kimi.ts:42` | **GAP — deferred, named** |
| `acff85202` Kimi search credentials | live gap: `web/search/providers/kimi.ts:63` still accepts Moonshot credentials | **GAP — deferred, named** |
| `f3f574520`, `cad30f8c2` GH review large-diff fallback | live gaps | **GAP — deferred, named** |
| `3e38a5b51` timeout before output drainage | live gap at `exec/bash-executor.ts:239` | **GAP — deferred, named** |
| `9e7382120` brace expansion before tilde | renamed owner exists: `crates/brush-core-vendored/src/expansion.rs:629` | **GAP — deferred, named** |
| `65d0d779f`, `54fe6a4bc` OSC8 behavior | touches protected TUI scope — **UNSAFE without explicit user authorization in this session** | **NEEDS_HUMAN** |
| `3d72284de`, `05af550d8` cursor advisor native tools | cursor advisor surface differs | **deferred — own probe** |
| `b65467291` malformed local-model ranges | edit-range recovery owner exists | **deferred — own probe** |
| `5cb953343` `uv run --extra` parsing | shell parsing owner exists | **deferred — own probe** |

**2 implemented · 14 non-applicable with reasons · 22 deferred with named owners · 2 NEEDS_HUMAN (protected
TUI).** `20.087` closes **ADAPT-partial** with by far the largest residual of any card so far — which is the
honest result for a 40-anchor card against a fork that diverged hard from upstream.

## Fix — ordered, decoder first

1. **Decoder (`crates/pi-natives/src/linediff.rs`).** Add a strict decoder taking `JsString`, converting via
   `into_utf16()`, dropping napi's trailing NUL, then `String::from_utf16` — returning `Status::InvalidArg` on
   an unpaired surrogate instead of substituting. Change `diff_lines` to
   `(JsString, JsString) -> Result<Vec<LineDiffPart>>` delegating to an unchanged inner
   `diff_lines_impl(&str, &str)`, so the diff algorithm itself is untouched. napi 3 already supports this;
   `crates/pi-natives/src/hashline.rs:153` uses the same API.
2. **Loader (`edit/diff.ts`).** Replace `createRequire` with the static ESM import every other consumer uses,
   keeping the `try`/fallback for genuinely missing platform builds.

Order matters: repairing the loader first would newly expose the U+FFFD corruption to users.

The generated `.d.ts` surface is unchanged — `(string, string) => Array<LineDiffPart>` — because napi maps
`JsString` to `string`.

## Owner paths

- `crates/pi-natives/src/linediff.rs`
- `packages/coding-agent/src/edit/diff.ts`
- `packages/natives/native/index.d.ts` (generated)
- `packages/coding-agent/test/` — focused regressions

## Verification

A `.node` rebuild is **mandatory** — `check:rs` only runs the scope guard, fmt and clippy; it does not rebuild
the addon, and the local `.node` is gitignored. Rebuild via `packages/natives` `bun run build`, then:

1. **Loader, no-skip**: `resolveNativeDiffLines()` must return a function. The existing parity test
   (`edit-diff-fallback.test.ts:81`) silently `return`s when native is unavailable — that is exactly how this
   stayed hidden, so the new test must **fail** rather than skip.
2. **Boundary, post-rebuild**: import `packages/natives/native/index.js` directly and assert `diffLines`
   **throws** on a lone surrogate instead of returning `U+FFFD`.
3. **Fallback, no rebuild needed**: inject a throwing fn through `__setDiffLinesForTest` and assert
   `generateDiffString` returns the exact jsdiff output.
4. **Parity**: well-formed input is byte-identical to `Diff.diffLines` across CRLF, trailing-newline and
   empty-input edges — the premise of the native port, now actually exercised.
5. Embedded `U+0000` still works: the strict decoder drops napi's terminator, not a legitimate NUL.

Gates: `bun run check:ts`, `bun run check:rs`, natives + edit-diff suites.

## Open decision for the user (not decided here)

Ill-formed tool input is currently written to disk as `EF BF BD` before the diff is generated. So the correct
long-term contract is either "reject ill-formed edit input before writing" or "diff the re-read file". Both
change tool behavior, so both are the user's call. This cycle only makes the two diff engines agree.

## Not in scope

TUI visual identity — including the two OSC8 anchors, which are flagged NEEDS_HUMAN rather than silently
dropped. All deferred anchors above.
