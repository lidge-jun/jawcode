# 080 — Bun distribution contract

## Decision

Standalone JWC must not require the user to install Bun manually before `jwc` can run.

Target UX:

```sh
npm install -g jawcode
jwc --version
jwc --help
```

## Current code facts

| Fact | Evidence |
|---|---|
| package currently requires Bun | `packages/jwc/package.json` has `engines.bun >=1.3.14` |
| current user bin is already `jwc` | `packages/jwc/package.json` `bin.jwc = bin/jwc.js` |
| current package is not publish-ready | `packages/jwc/package.json` `name = jwc`, `files = ["bin","dist"]`, `exports` point at `src/*.ts` |
| Node-compatible SDK bundle exists as a target | `packages/jwc/scripts/build-node.ts` writes `dist-node/sdk.js` |

## Distribution model

| Runtime path | Bun requirement | Package behavior |
|---|---|---|
| standalone TUI/CLI | needs Bun-compatible runtime | package provisions managed Bun or bundles a platform runtime |
| cli-jaw embedding | should be Node-compatible | cli-jaw imports `jawcode/sdk` from distributable `dist-node` |
| local dev | may use system Bun | `file:`/link dependency can use repo-local build scripts |

## P0 managed Bun strategy

1. Depend on npm package `bun@1.3.14`; npm installs the matching platform
   package through `bun` optional dependencies.
2. Add a safe postinstall path that checks/skips cleanly and never blocks
   install. Runtime verification belongs to the launcher.
3. On local install, reuse package-local `node_modules/bun/bin/bun.exe` when
   available; do not download or mutate outside npm.
4. `bin/jwc.js` resolves runtime in this order:
   - `JWC_BUN_PATH`;
   - package-local `bun` dependency;
   - system Bun if compatible;
   - clear remediation error.
5. The `jawcode` package must include all scripts needed by postinstall in `files`.

## File-level implementation plan

| File | Change |
|---|---|
| `packages/jwc/package.json` | rename package to `jawcode`; keep `bin.jwc`; include `dist-node` and `scripts` in `files`; add `bun@1.3.14`; add `postinstall` guard |
| `packages/jwc/bin/jwc.js` | replace Bun shebang assumption with Node launcher that resolves package-managed Bun, compatible system Bun, then errors clearly |
| `packages/jwc/scripts/resolve-bun-runtime.cjs` | CommonJS resolver used by the launcher; checks env override, package-local Bun dependency, then system PATH |
| `packages/jwc/scripts/verify-runtime.cjs` | local/CI/postinstall smoke that proves resolver behavior without invoking network |

## Environment contract

| Env | Meaning |
|---|---|
| `CI=true` | never download or prompt; verify skip path only |
| `JWC_SAFE=1` | same safe-mode behavior for local/package tests |
| `JWC_BUN_PATH=/abs/path/to/bun` | explicit override for development and CI fixtures |
| `JWC_SKIP_BUN_INSTALL=1` | skip postinstall checks; launcher still requires package/system/override runtime |

Pinned version source: start from `packages/jwc/package.json` `engines.bun` (`>=1.3.14`). Implementation may pin an exact version in package metadata, but it must not drift from the documented minimum without updating this file.

## Verification

- `npm pack --dry-run` includes `bin`, `dist`, `dist-node`, and provisioning scripts.
- temp global install smoke can run `jwc --version` through package-local or
  compatible system Bun.
- CI safe-mode install does not download or prompt.
- cli-jaw package dependency smoke imports `jawcode/sdk` under Node.
