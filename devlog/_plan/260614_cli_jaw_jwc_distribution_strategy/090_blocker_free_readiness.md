# 090 — blocker-free readiness checklist

## Purpose

This is the final checklist before implementation. If every row has an owner and proof command, 120 can begin without returning to requirements interview.

## Required doc decisions

| Decision | Status |
|---|---|
| npm package name | `jawcode` |
| installed command | `jwc` |
| cli-jaw dependency | `jawcode` |
| cli-jaw import | `jawcode/sdk` |
| standalone runtime | managed Bun included/provisioned |
| local dev | `file:`/link or packed tarball, same package surface |
| global `jwc` lookup | not primary path |
| public/current legacy identity text | remove from active docs and public surfaces |

## Implementation blockers to close in code

| Blocker | Owner repo | File area | Required action | Proof command/evidence |
|---|---|---|---|---|
| package still named `jwc` | jawcode | `packages/jwc/package.json` | rename package to `jawcode`, keep `bin.jwc` | `npm pack --dry-run` metadata shows `jawcode` and bin `jwc` |
| exports point at source TS | jawcode | `packages/jwc/package.json` | point publish exports to distributable artifacts | packed temp install then `node -e 'import("jawcode/sdk")'` |
| package files omit scripts/dist-node | jawcode | `packages/jwc/package.json` | include provisioning scripts and SDK bundle | `npm pack --dry-run` file list contains `scripts`, `dist`, `dist-node` |
| workspace-only dependencies | jawcode | `packages/jwc/package.json`, build scripts | bundle or publish all runtime deps | packed `package.json` has no unresolved workspace-only runtime deps |
| standalone Bun assumption | jawcode | `bin/jwc.js`, postinstall scripts | add managed Bun resolver/provisioning | `CI=true` safe install passes; non-Bun PATH smoke reaches resolver/remediation |
| cli-jaw local dev dependency | cli-jaw | cli-jaw package/config | use `file:`/link or packed tarball against `jawcode` package | cli-jaw smoke imports `jawcode/sdk` with global `jwc` absent |

## Proof bundle before 120 closes

- `npm view jawcode` checked before publish.
- `npm pack --dry-run` shows expected files.
- temp install can run `jwc --version`.
- Node import can load `jawcode/sdk`.
- cli-jaw smoke passes with global `jwc` removed from PATH.
