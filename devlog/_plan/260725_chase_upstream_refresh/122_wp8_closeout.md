# 122 — wp8 closeout: 20.089 bounded ptree stderr retention

Outcome: **DONE (partial by design)** — the stderr-retention leak is fixed and re-verified PASS; five other
applicable gaps in this card are deferred with named owners rather than quietly dropped.

| phase | evidence |
|---|---|
| P | `120` — 20 anchors triaged against the tree |
| A | Sagan **FAIL** (4 blocking) → folded in `121` |
| B | `48a473d` implementation |
| C | Kepler **FAIL** (3 blocking) → `73415e9` + `8cf381b`; Kepler **PASS** |
| _fin | `fd12f6b` — `_fin/20`, MOC row, INDEX 64→65, tier link |

## The audit caught me minimizing my own workload

This is the finding worth carrying forward. The first triage concluded that 12 of 20 anchors were
already-satisfied or non-applicable, leaving exactly one thing to build. Three of those verdicts were wrong,
and all three errors pointed the same way — less work:

- **"No IRC subsystem in JWC."** I checked `src/irc/` — upstream's layout — found nothing, and generalized.
  JWC has `src/tools/irc.ts`, a documented process-global registry, and IRC tests. One wrong path became a
  verdict on two anchors.
- **Anchor `7550bd887` omitted entirely.** 19 of 20 triaged; the count was never reconciled against the card.
- **"OTLP is a product decision."** `telemetry-export.ts` already initializes trace, metric and log providers.
  I judged from the commit subject instead of the file.

A "non-applicable" verdict silently deletes chase scope that nobody revisits. It has to be earned by searching
the fork for the equivalent, not by failing to find upstream's path.

## Then the C round found the fix itself was half-done

`48a473d` gated the retention flag correctly — and left the actual leak in place. Public `spawn()` still
mapped `stderr: "full"` to *both* exposure and retention, and the three callers that motivate this fix at all
(RPC, MCP stdio, SSH) consume the exposed stream themselves and never call `wait({ stderr: "full" })`. They
kept retaining chunks nobody reads — precisely the long-lived-noisy-subprocess case.

`73415e9` added `stderr: "stream"` (expose without retaining) and migrated them. `8cf381b` then dropped
`"full"` from three `exec` callers that requested it and read only stdout.

## What shipped

| path | exposes `child.stderr` | retains raw chunks |
|---|---|---|
| default `spawn()` | no | no |
| `spawn({ stderr: "stream" })` | yes | **no** |
| `spawn({ stderr: "full" })` | yes | yes |
| `exec({ stderr: "full" })` | **no** | yes |

`wait({ stderr: "full" })` without spawn-time capture rejects rather than silently returning a truncated tail.
`exec` retains through an internal helper: forwarding `stderr` into public `spawn` would tee a stream `exec`
never reads, moving the unbounded buffering rather than removing it.

## Verification

`check:ts` 0 · `packages/utils` 114 pass/0 fail · coding-agent tools + silent-abort 876 pass/0 fail ·
`verify-g002-gates` PASS · `rebrand-inventory --strict` PASS · `check:schemas` PASS.

Three ablations prove the tests bite: unconditional retention (red), `exec` losing retention (red), and
`exec` teeing an unread stream (red — only after adding a `ReadableStream.prototype.tee` spy, since the first
suite could not see that hazard at all and the reviewer was right to call it out).

Chase gates sit at their exact pre-existing baseline — 136 offenders, 39 lifecycle violations — with `20.089`
contributing zero. The closure gate also caught two real errors in my first `_fin` header (an upstream SHA
cited as a JWC commit, and an owner list that did not cover `8cf381b`); both fixed before commit.

## Carried forward

- **Residual from this card:** fatal-cleanup watchdog + log rotation (`7550bd887`), IRC-during-dispose
  (`da2e630fb`/`54f4a1894`), OTLP signal probe (`e00eb7cfb`), Windows port recovery (`477112e81`), cursor
  approval confirmation (`8b0402b32`).
- **Remaining bucket-A cards:** GJC `10.110`, `10.112`; OMP `20.082`, `20.087`, `20.088`.
