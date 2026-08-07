# Changelog

## [Unreleased]

- `Flags.integer` now rejects anything that is not exactly an integer instead of silently accepting a prefix of one. `--limit 12abc` used to become `12`, `--timeout 3.9` became `3`, `0x10` became `0` and `1e999` became `1`, so a mistyped number quietly ran a different command than the one requested; values beyond the safe integer range are rejected too. Bad values now raise a parse error, which means the CLI prints the problem plus usage and exits with a usage code rather than crashing with a stack trace. Range is unchanged and still belongs to each command: `--port 0` still asks for an ephemeral port.

## [0.4.5] - 2026-06-12

### Fixed

- Kept provider credential resolution from trusting the caller project's `.env` values while preserving merged project environment access through `$env`.

## [0.4.4] - 2026-06-10

- Version aligned with the 0.4.4 monorepo release; no functional changes in this package.
