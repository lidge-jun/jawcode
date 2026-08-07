# 172 — wp13 closeout: integer flags stop guessing

Outcome: **DONE.** `Flags.integer` no longer accepts a prefix of a number, and a bad value renders usage
instead of crashing.

| phase | evidence |
|---|---|
| P + A | `170` — behavioral probe, and one defect removed from my own plan |
| B | `4f77427` implementation, `3548aaf` consumer range pins |
| C | gates green; both fixes ablation-verified |

## Why this was not "non-applicable"

GJC `4824830bc` patches `src/commands/daemon.ts`. JWC has no such file, and `rg` for the flag names returns
nothing. Declaring the anchor non-applicable on that basis is the exact path-shaped verdict I have gotten
wrong repeatedly.

Searching for the **capability** instead found the defect one level down, in the shared parser at
`packages/utils/src/cli.ts`. Upstream's fix was a local workaround — they swapped two flags to
`Flags.string` and hand-validated them, leaving their own `Flags.integer` loose everywhere else. JWC's
equivalent fix is smaller and covers all seven consumers at once.

## What was actually broken

`Number.parseInt` returns the prefix it can read, so every one of these was accepted silently:

| input | old result |
|---|---|
| `12abc` | `12` |
| `3.9` | `3` |
| `0x10` | `0` |
| `1e999` | `1` |
| `99999999999999999999` | `1e20`, past `MAX_SAFE_INTEGER` |

`--timeout 3.9` running with a 3ms timeout is not a cosmetic problem. Separately, the branch threw a bare
`Error`, and `run()` only turns `CliParseError` into "message + usage + exit 2" — so a typo produced a stack
trace instead of help.

## What I deliberately did not do

I planned to add a `min` bound rejecting `0` and negatives for port/timeout flags. The audit killed it:
`stats --port 0` is a legitimate request for an OS-assigned ephemeral port. Per-flag range is consumer
semantics that a shared parser cannot know, so it stays with the consumers and is named here as follow-up
rather than quietly dropped. `cli-integer-flag-consumers.test.ts` pins `--port 0` so a future tightening
cannot take it away by accident.

## Verification

- 12 token-validation assertions; ablation to `parseInt` turns 7 red.
- 1 end-to-end `run()` test; ablating only the error type makes it crash uncaught, which is precisely the
  regression it exists for.
- 5 consumer range pins across `grep`, `stats`, `map`, `shell`.
- `check:ts`, `check:schemas`, `verify-g002-gates`, `rebrand-inventory --strict`,
  `check-visible-definitions`, `ci:test:smoke` pass; utils suite 127 pass / 0 fail; combined scoped run
  311 pass / 0 fail. Chase gates unchanged at 136 / 39.
