# 161 — 160+ PABCD marathon execution index

## Goal

Execute the 160+ Jawcode/JWC release work as at least 10 small PABCD slices, with one documentation, implementation, and verification bundle per slice.

The product target is concrete:

- `npm install -g jawcode` exposes bin `jwc`;
- `jawcode/sdk` is the only package import surface cli-jaw consumes;
- cli-jaw can use embedded JWC without requiring a globally installed `jwc`;
- active public surfaces stay Jawcode/JWC-first and do not leak legacy public names;
- repo-local validation proves package, import, runtime, and fallback behavior before release.

## Current evidence lock

As of this slice:

- Jawcode is on `main` and ahead of `origin/main` by two local documentation commits.
- cli-jaw is on `dev` and has dirty JWC/code-mode integration files plus unrelated runtime/TUI work. Staging must remain path-specific.
- `packages/jwc/package.json` already declares package name `jawcode`, bin `jwc`, and export `./sdk`.
- `packages/jwc/src/sdk.ts` still re-exports the internal `@gajae-code/coding-agent/sdk` surface.
- cli-jaw `src/agent/jwc-runtime.ts` still falls back to `jwc/sdk`, which conflicts with the decided package import `jawcode/sdk`.
- cli-jaw `package.json` does not yet depend on `jawcode`.

## Slice list

| Slice | Scope | Primary files | Verification |
| --- | --- | --- | --- |
| 161 | Execution index and dirty-state boundary | this file, task ledger | `git diff --check` |
| 162 | Jawcode package artifact truth | `packages/jwc/package.json`, `packages/jwc/scripts/*`, `packages/jwc/src/*` | `bun --cwd=packages/jwc run build:node`; `node packages/jwc/scripts/smoke-packed-sdk.mjs` |
| 163 | cli-jaw dependency source | `cli-jaw/package.json`, lockfile if generated | package install/resolve proof for `jawcode/sdk` |
| 164 | cli-jaw resident runtime import flip | `cli-jaw/src/agent/jwc-runtime.ts`, integration tests | typecheck or targeted runtime import smoke |
| 165 | no-global-`jwc` proof | cli-jaw smoke script/test | `PATH` without global `jwc`, embedded SDK import still succeeds |
| 166 | code-mode/session routing | `cli-jaw/src/code-mode/*`, `cli-jaw/src/routes/code.ts`, server route registration | API/route smoke without starting vendor global binary where possible |
| 167 | legacy-name inventory v2 | Jawcode guard scripts/docs | classified inventory output |
| 168 | current/public cleanup | package/docs/docker/schema surfaces that are safe to flip | strict guard plus targeted greps |
| 169 | validation matrix automation | `180_validation_matrix.md`, scripts/tests as needed | matrix command suite |
| 170 | release/CI redesign | release docs/scripts, no workflow reintroduction unless runner policy is safe | no `.github/workflows` leakage; release dry-run docs |
| 171 | mac MCP/CUA packaging | MCP/CUA package/install defaults | mac-only config tests or documented no-op on non-mac |
| 172 | final installed/repo-local JWC smoke | package tarball, cli-jaw embedded runtime | `jwc --help`, `jwc --version`, `jawcode/sdk` import, cli-jaw no-global smoke |

## Commit discipline

Each slice should commit only its own paths. Because cli-jaw currently has unrelated dirty files, cli-jaw staging must use explicit path lists and must not sweep with `git add -A`.

Push is not part of this marathon unless the user explicitly asks in the same turn. The current work should leave both repositories locally committed and verifiable.

## First implementation target

Start with slice 162. A package artifact that cannot be packed, installed, and imported through `jawcode/sdk` makes all later cli-jaw integration evidence weak.
