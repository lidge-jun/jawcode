# Release & Publishing Guide

> Current as of 2026-06-29. This is the maintained source of truth for Jawcode npm publishing.

## Canonical release path

Use GitHub Actions npm Trusted Publishing through `.github/workflows/release.yml`.

- Do not use long-lived `NPM_TOKEN` for normal releases.
- Do not run ad-hoc local `npm publish` for a normal release.
- Every real CI publish uses `npm publish --provenance` through `scripts/ci-release-publish.ts`.
- Every public package must have an npm Trusted Publisher entry for:
  - repository: `lidge-jun/jawcode`
  - workflow: `release.yml`
  - environment: none, unless the workflow is later changed to use one
- Node/npm requirements for trusted publishing are Node 22.14+ and npm 11.5.1+. The workflow uses Node 24 and upgrades npm before publish.

Release trigger:

```sh
gh workflow run release.yml --ref main -f version=<VERSION> -f tag=latest -f dry-run=false
```

Dry-run validation:

```sh
gh workflow run release.yml --ref main -f version=<VERSION> -f tag=latest -f dry-run=true
```

## Published packages

`scripts/ci-release-publish.ts` is the package list and publish-order source of truth.

| Order | npm package | Source | Kind | Notes |
|---:|---|---|---|---|
| 1 | `@jawcode-dev/utils` | `packages/utils/` | TypeScript | Shared utilities |
| 2 | `@jawcode-dev/ai` | `packages/ai/` | TypeScript | Provider and model client |
| 3 | `@jawcode-dev/natives` | `packages/natives/` | Native | Rust N-API addon package |
| 4 | `@jawcode-dev/tui` | `packages/tui/` | TypeScript | Terminal UI library |
| 5 | `@jawcode-dev/stats` | `packages/stats/` | TypeScript + client build | `jwc stats` dashboard |
| 6 | `@jawcode-dev/agent-core` | `packages/agent/` | TypeScript | Agent runtime |
| 7 | `@jawcode-dev/coding-agent` | `packages/coding-agent/` | TypeScript | Main CLI implementation |
| 8 | `jawcode-cu-mcp-server` | `packages/cu-mcp-server/` | Manifest + build | Computer Use MCP server |
| 9 | `jawcode` | `packages/jwc/` | Manifest + bundled CLI | Public `jwc` CLI and `jawcode/sdk` |
| 10 | `@jawcode-dev/bridge-client` | `packages/bridge-client/` | TypeScript | Bridge client |

Not part of normal npm release:

- `jawcode-compat` in `packages/gajae-code/`
- benchmark packages under `packages/*benchmark/`
- Python packages under `python/`

## Workflow shape

`.github/workflows/release.yml` has two jobs.

### `mac-native-probes`

Runs on `macos-14` before publish:

- checks out source
- installs Bun 1.3.14 and Node 24
- installs dependencies with `bun install --frozen-lockfile`
- builds natives through `bun run build:native`
- builds the `jawcode` bundle and Node SDK
- runs `node packages/jwc/scripts/smoke-packed-sdk.mjs --native-probes`

### `publish`

Runs on `ubuntu-latest` after `mac-native-probes`:

- permissions must include `contents: read` and `id-token: write`
- installs Bun 1.3.14 and Node 24
- upgrades npm so trusted publishing support is present
- installs dependencies and builds natives
- verifies `packages/jwc/package.json` version matches the workflow input
- removes any setup-node `_authToken` line from npm user config before publishing
- runs `scripts/ci-release-publish.ts`
- runs post-publish registry smoke when `dry-run=false`

The `_authToken` removal is required. `actions/setup-node` with `registry-url` can write an empty `NODE_AUTH_TOKEN` entry into `.npmrc`; npm then tries token auth instead of OIDC and can fail with a misleading permission or `E404` error.

## Publish script contract

`scripts/ci-release-publish.ts` prepares and publishes every public package in dependency order.

- TypeScript packages emit declarations into `dist/types/`.
- Package manifests are rewritten in CI so `workspace:` and `catalog:` dependencies become concrete package versions.
- `types` and export type paths that point at `./src/` are rewritten to `./dist/types/`.
- `files` is expanded with required publish artifacts.
- Existing `name@version` packages are skipped on real publish, so reruns are idempotent.
- Dry-run prints publish intent without publishing.
- Real CI publish adds `--provenance`.

`packages/jwc` has the strictest pre-publish checks:

- `bun run bundle`
- `bun run build:node`
- `bun test ../../packages/coding-agent/test/jwc-cli-jaw-bootstrap.test.ts`
- `bun test ../../packages/coding-agent/test/jwc-package-manifest-contract.test.ts`
- `bun run smoke:packed-sdk`
- `node scripts/smoke-packed-sdk.mjs --postinstall-matrix`
- `node scripts/smoke-packed-sdk.mjs --registry-faithful`
- `node scripts/smoke-packed-sdk.mjs --native-probes`

Dry-runs skip only the `--registry-faithful` pre-build smoke because it requires already-published dependencies for the target version. The real publish keeps that smoke, and `release.yml` also runs a post-publish registry-faithful smoke.

## Version bump contract

Before triggering a real release, keep these versions aligned:

- every non-private `packages/*/package.json` that is part of the publish set
- root `package.json` workspace catalog entries for `@jawcode-dev/*`
- `Cargo.toml` workspace package version when Rust native ABI/package version changes
- `scripts/verify-g002-gates.ts` allowed public package versions when that gate is version-sensitive

The release contract test is:

```sh
bun test scripts/release-publish-order.test.ts
```

It verifies that the non-private package bump set equals the publish set and that `packages/jwc` keeps the required pre-publish smoke matrix.

## Native version sentinel

Rust N-API addon exports a sentinel function:

- definition: `crates/pi-natives/src/lib.rs`
- loader check: `packages/natives/native/loader-state.js`

The sentinel tracks native ABI compatibility, not every npm patch version. If package versions move without a native ABI change, keep the loader sentinel pinned to the binary ABI sentinel. A mismatch means the `.node` file can load but the expected sentinel export is missing, producing a "version sentinel" release mismatch error.

## Bootstrap-only fallbacks

Only use these paths when a package does not yet exist on npm or Trusted Publishing cannot be attached until a first publish exists.

```sh
bun scripts/ci-release-publish.ts --only <package-dir> --no-provenance --interactive
```

or, with an authenticator code:

```sh
bun scripts/ci-release-publish.ts --only <package-dir> --no-provenance --otp <OTP>
```

Rules:

- bootstrap publishes are manual exceptions, not the release path
- use them only for the unpublished package subset
- after bootstrap, configure npm Trusted Publisher for that package
- the next normal release must go through `release.yml` with provenance

## Troubleshooting

### `npm error E404` or "do not have permission" during OIDC publish

Check the publish job removed setup-node's `_authToken` line. An empty token in `.npmrc` can shadow OIDC trusted publishing.

### Trusted publishing rejected

Verify the npm package Trusted Publisher entry exactly matches `lidge-jun/jawcode` and `release.yml`. Also verify the workflow job has `id-token: write`.

### `npm publish --provenance` fails locally

Expected. Provenance requires the CI OIDC environment. Use the workflow for real releases; use bootstrap-only fallback only when creating a package before Trusted Publishing can be configured.

### `Cannot publish over the previously published versions`

That package version already exists. Bump the release version or let the CI script skip already-published packages on rerun.

### `blocked by minimum-release-age`

`bunfig.toml` can block very new packages. CI release jobs use the project install path; if this reappears, inspect the install step before publish rather than bypassing the release workflow.

### Native sentinel mismatch

Verify the Rust sentinel export and JS loader sentinel are intentionally aligned. If the native ABI did not change, keep the JS loader sentinel pinned to the existing ABI sentinel.

### Old branding or stale CLI behavior after install

Rebuild `packages/jwc` before publish. The release script already does this through the `packages/jwc` pre-build matrix; local ad-hoc publishes are the usual source of stale bundles.

## Verification after release

After `dry-run=false` completes:

```sh
gh run view <RUN_ID> --json status,conclusion,url
npm view jawcode@<VERSION> version
npm view @jawcode-dev/coding-agent@<VERSION> version
npm view @jawcode-dev/natives@<VERSION> version
```

Check all ten public packages at the target version, confirm the release workflow concluded `success`, and confirm npm provenance from the package pages or npm registry metadata.
