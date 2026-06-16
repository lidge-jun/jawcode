# 115 — cli-jaw integration manifest

## Purpose

List the cli-jaw-side file areas that must change before the embedded path can pass a no-global-`jwc` smoke. This is a manifest, not an implementation patch. Exact line numbers must be refreshed inside the cli-jaw repo before editing.

## Contract

cli-jaw must consume JWC through the `jawcode` package dependency and `jawcode/sdk` import surface. The primary path must not shell out to a globally installed `jwc` binary.

## File-area manifest

| cli-jaw area | Change | Proof |
|---|---|---|
| root package manifest | add dependency on `jawcode` through published version, packed tarball, or local `file:` link during dev | package install succeeds with no global `jwc` in `PATH` |
| JWC runtime adapter | import the embedding facade from `jawcode/sdk` | Node import smoke reaches the expected session/runtime export |
| server/runtime feature flag | keep fallback disabled by default or explicitly staged; record consumed `jawcode` version/source | startup log/status shows package dependency source |
| worker/session creation path | create or dry-run JWC-backed session without invoking `jwc` from `PATH` | PATH-negative smoke passes |
| CI smoke | run cli-jaw with a sanitized `PATH` where global `jwc` cannot resolve | smoke proves embedded path remains functional |
| release notes/status | state whether standalone `jwc` is optional or required for each release channel | release checklist includes consumed package version and fallback status |

## Local dev workflow

Use one of these, in order of reproducibility:

1. packed tarball from `packages/jwc`;
2. `file:` dependency pointing at `packages/jwc`;
3. workspace link only for fast local iteration.

The same smoke must pass for the packed tarball before release.

## Verification shape

```bash
tmpdir="$(mktemp -d)"
PATH="$tmpdir/bin:/usr/bin:/bin" node -e 'import("jawcode/sdk").then(m => { if (!m.createAgentSession) throw new Error("missing createAgentSession") })'
```

The concrete cli-jaw command belongs in the cli-jaw repo once its adapter entry point is selected. This manifest is the pre-120 bridge that tells that implementation where the proof must land.
