# 121 — wp8 A synthesis: audit FAIL folded

Sagan (independent, read-only) returned **FAIL** on `120` with 4 blocking findings and 8 required fixes. All
are folded. None were argued down.

## The finding that matters most

The draft's triage was wrong **in the direction that reduced my own workload**, and that is worth naming
precisely rather than filing under "an error was made". Three of the four blocking findings had the same
shape: a subsystem was declared non-applicable or already-satisfied on evidence that did not support the
claim, and every such verdict silently deletes chase scope that nobody will revisit.

The IRC case is the clearest. The draft checked `packages/coding-agent/src/irc/` — upstream's directory
layout — found nothing, and wrote "no IRC subsystem in JWC". JWC has `src/tools/irc.ts`, a documented
process-global registry, and IRC tests. One wrong path became a verdict on two anchors.

## Verification before acceptance

| finding | independent check | holds? |
|---|---|---|
| JWC has IRC | `ls src/tools/irc.ts` → exists; `agent-registry.ts:1` documents the IRC registry | **yes** |
| `7550bd887` omitted | card table has 20 anchors; `rg '7550bd887'` in the plan → **0 hits** | **yes** |
| IRC-during-dispose is real | `sdk.ts:2047` unregisters in a `finally` **after** `await originalDispose()`, so the session stays registered and deliverable for the whole disposal | **yes** |
| fatal cleanup unbounded | `postmortem.ts` `runCleanup` awaits `Promise.allSettled` with no watchdog | **yes** |
| `exec` hazard is load-bearing | 7 call sites pass `stderr: "full"`, including `exec/exec.ts:44`, `youtube.ts:179`, `tools-manager.ts:259,271` | **yes** |

## Disposition

| # | finding | disposition |
|---|---|---|
| 1 | `7550bd887` missing from triage | **accepted.** Added as a REAL GAP (unbounded fatal cleanup + shared rotation); its three log-bundling anchors become conditional follow-ons |
| 2 | "no IRC" false | **accepted, retracted.** `da2e630fb`/`54f4a1894` reclassified REAL GAP with the dispose-race traced to `sdk.ts:2047` |
| 3 | OTLP already adopted | **accepted.** `506d0942c` → already satisfied; `e00eb7cfb` → deferred gap needing a live collector probe, not a product decision |
| 4 | stats stronger only on Linux/macOS | **accepted.** `477112e81` split out as a Windows partial gap; `4010bef98` stays satisfied-stronger; `b7c8fce83` N/A to loopback binding |
| 5 | cursor defer unjustified | **accepted.** Now closes N/A on a focused approval-denial test rather than an unspecified "probe" |
| 6 | forwarding `stderr:"full"` to `spawn()` is insufficient | **accepted.** Exposure and retention split; `exec` retains **without** exposing, so no unconsumed tee |
| 7 | output test cannot prove memory retention | **accepted.** Verification restated as five observable contracts; case 1 labelled a proxy, not proof |
| 8 | wrong gates cited | **accepted.** The four rebrand/default-surface gates apply to workflow-definition changes; this is utils-only |

## Effect on the outcome

The draft would have closed `20.089` as "one real gap, everything else N/A". It now closes with **five real
gaps deferred and named**. The implemented slice is unchanged — the ptree leak is genuinely the one piece that
belongs in this cycle — but the card's residual is four times larger than the draft admitted, and future
readers get owners and line numbers instead of a false all-clear.
