# 240 — wp20: on Windows the stats port could never be recovered

Source: **residual gap 4** in the wp8 `_fin` card for `20.089` (anchor `477112e81`).

| phase | evidence |
|---|---|
| P | live reproduction with `process.platform` stubbed to win32 |
| A | **pass**, plus one weak assertion caught and strengthened |
| B | `0affd87` |
| C | gates green; both parser guards ablation-verified |

## An asymmetry, not a missing feature

`findPortHolder` already had a `findWindowsPortHolder` branch — someone did the Windows work for *finding*
the holder. `readProcessIdentity` did not: linux, darwin, then `return null`.

`recoverStatsPort` requires a non-null identity to prove ownership, so on Windows it always failed. The
practical result is that `jwc stats` refused to reuse a dashboard **it had started itself**, and refused to
reclaim a port left behind by its own crashed instance. The user got "the listening process could not be
identified" and a permanently unusable port.

Confirmed rather than inferred: with `process.platform` stubbed to `win32`, a second `startServer` against a
live dashboard throws.

## The safety property drove the design

This code kills processes. The property that must survive is: **never terminate a process JWC does not
own.** So the win32 identity had to be a start-time + command pair like the POSIX branches, not a PID
comparison — a recycled PID must fail the check. `CreationDate` + `CommandLine` gives exactly that. A
partial identity stays `null`, so a process `wmic` cannot read looks unprovable rather than provable.

`wmic` is deprecated and absent from newer Windows images, so PowerShell `Get-CimInstance` is a fallback.
Shipping `wmic`-only would have "fixed" Windows while silently losing the capability on current Windows.

## One of my assertions was not doing anything

Ablating the empty-value guard left **all tests green**. The guard was real — `wmic` prints `CommandLine=`
for processes it cannot read — but no case exercised the path where a later blank repeat overwrites a value
already read. I added that case; the guard now fails under its own ablation.

Worth stating plainly: a passing test suite said the guard was unnecessary, and the suite was wrong. Running
the ablation is what surfaced it.

## Coverage honesty

The probes shell out to Windows-only binaries, so they cannot execute on this host. The tests target the
parsing, which is where the failure modes live (`=` inside a command line, empty values, repeated keys), and
the real end-to-end path runs in the `windows-2022` CI job added in wp11. Parser tests are not a substitute
for that job — they are what makes it debuggable when it fails.
