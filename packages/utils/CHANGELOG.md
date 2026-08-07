# Changelog

## [Unreleased]

- Shutdown cleanup is now bounded. Every fatal path — Ctrl-C, `SIGTERM`, an uncaught exception — waits for all registered cleanup callbacks before exiting, and that wait used `Promise.allSettled`, so a single callback that never settled left the process unkillable by normal means: Ctrl-C simply did nothing. Cleanup now gives up after ten seconds and exits, naming the callbacks that were still pending. Healthy shutdowns are unaffected and callbacks that do finish still run. `JWC_CLEANUP_TIMEOUT_MS` overrides the budget; `0` restores the old wait-forever behavior.

- Documented `JWC_*` environment variables now actually reach the runtime. Many read sites consume the older `PI_*` spelling directly, and the load-time alias layer only mirrored `JWC_*` onto `GJC_*`, so setting a variable exactly as the published reference describes it — `JWC_PY`, `JWC_PYTHON_SKIP_CHECK`, `JWC_FORCE_IMAGE_PROTOCOL` and others — silently did nothing. `JWC_ISOLATE_LEGACY_ENV=1` still suppresses all mirroring, an explicitly provided legacy value still wins, and `JWC_COMPILED` is deliberately never mirrored because `PI_COMPILED` is a build-injected marker rather than an operator setting.

- `Flags.integer` now rejects anything that is not exactly an integer instead of silently accepting a prefix of one. `--limit 12abc` used to become `12`, `--timeout 3.9` became `3`, `0x10` became `0` and `1e999` became `1`, so a mistyped number quietly ran a different command than the one requested; values beyond the safe integer range are rejected too. Bad values now raise a parse error, which means the CLI prints the problem plus usage and exits with a usage code rather than crashing with a stack trace. Range is unchanged and still belongs to each command: `--port 0` still asks for an ephemeral port.

## [0.4.5] - 2026-06-12

### Fixed

- Kept provider credential resolution from trusting the caller project's `.env` values while preserving merged project environment access through `$env`.

## [0.4.4] - 2026-06-10

- Version aligned with the 0.4.4 monorepo release; no functional changes in this package.
