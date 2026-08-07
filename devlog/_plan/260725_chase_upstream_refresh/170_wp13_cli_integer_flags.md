# 170 — wp13 P+A: integer flag parsing accepts garbage

Anchor: GJC `4824830bc` *"validate daemon timeout tokens"*. Upstream fixed it in
`packages/coding-agent/src/commands/daemon.ts`. That file does not exist here — but the **capability**
does, and the defect is broader in JWC than it was upstream.

## The path-shaped verdict I did not make

`rg` for `graceful-timeout-ms` returns nothing, and JWC has no `daemon` command. The tempting verdict is
"non-applicable". That would have been wrong. Upstream's fix was a *local* workaround: they changed the two
flags from `Flags.integer` to `Flags.string` and validated by hand, which means upstream's own
`Flags.integer` is still loose for every other consumer.

In JWC the same looseness lives in the shared parser, `packages/utils/src/cli.ts:210-219`, so fixing it there
covers every consumer at once.

## Behavioral probe (not a source read)

A real `Command` subclass with `Flags.integer`, parsed against actual argv:

| input | current result |
|---|---|
| `--n 12abc` | `12` — trailing garbage silently dropped |
| `--n 3.9` | `3` — silent truncation |
| `--n 0x10` | `0` — parses `0`, discards `x10` |
| `--n=1e999` | `1` — discards the exponent |
| `--n 99999999999999999999` | `1e20` — beyond `Number.MAX_SAFE_INTEGER` |
| `--n abc` | throws a **bare `Error`**, not `CliParseError` |

The last row matters independently: `run()` only renders usage for `CliParseError`
(`cli.ts:453`). A bare `Error` escapes as an uncaught exception with a stack trace, so today a typo'd
`--limit` crashes rather than printing help.

Seven live consumers: `stats --port`, `shell --timeout`, `local-provider --timeout-ms`,
`grep --limit`/`--context`, `web-search --limit`, `map --budget`.

## A-phase: my own plan had a defect

I planned to add a `min` bound so port and timeout flags reject `0` and negatives. **Dropped.**
`stats --port 0` is a legitimate request for an OS-assigned ephemeral port, and a `min: 1` would break it.
Rejecting negatives generically is also wrong: `parseArgs` already rejects a bare `--n -5` as ambiguous, but
`--n=-5` is a deliberate, well-formed way to pass one, and no shared parser can know whether a given flag's
domain includes negatives. Range is per-flag semantics and belongs to the consumer.

Scope after the audit is narrower and purely about *token validity*:

1. require the whole string to be an integer token, rather than a prefix of one;
2. require the result to be a safe integer;
3. throw `CliParseError` so `run()` renders usage instead of crashing.

No consumer's accepted range changes. `--port 0` still works.
