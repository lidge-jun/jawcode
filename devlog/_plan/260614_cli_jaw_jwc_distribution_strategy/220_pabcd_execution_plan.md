# 220 — repeated PABCD execution plan through 150

## Goal

Implement the distribution strategy through the 150 visible-cleanup slice using
small, independently verifiable PABCD cycles.

## Cycle 0 — clean current MCP/CUA restore work

### Intent

Finish and commit the existing dirty MCP/CUA restore changes before package
surface work starts.

### Files

| Action | Path |
|---|---|
| MODIFY | `packages/coding-agent/src/defaults/jwc-defaults.ts` |
| MODIFY | `packages/coding-agent/src/cli/setup-cli.ts` |
| MODIFY | `packages/coding-agent/test/default-mcp-config.test.ts` |
| MODIFY | `structure/21_extensibility.md` |
| MODIFY | `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/180_validation_matrix.md` |
| MODIFY | `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/211_computer_use_mcp_default_restore_plan.md` |

### Required corrections

- Keep `211` active and indexed.
- Make Computer Use/CUA managed defaults macOS-only.
- Keep Context7 as cross-platform managed default.
- Preserve unmanaged MCP entries on every platform.
- Treat any unrelated `_cli-jaw-entry.ts` dirty state as a separate blocker:
  do not stage or fix it inside the MCP/CUA restore commit.

### Verification

```bash
bun test packages/coding-agent/test/default-mcp-config.test.ts packages/coding-agent/test/agent-session-mcp-discovery.test.ts packages/coding-agent/test/mcp-lifecycle-cleanup.test.ts packages/coding-agent/test/acp-builtins.test.ts
git diff --check
```

Full package typecheck is expected to remain blocked until the separate
`_cli-jaw-entry.ts` barrel/export cleanup is handled.

## Cycle 1 — 120 embedding foundation

### Intent

Make `jawcode/sdk` a package-facing embedding contract that can be loaded by
Node without pulling in TUI-only Bun runtime paths.

### Files

| Action | Path |
|---|---|
| MODIFY | `packages/jwc/src/sdk.ts` |
| MODIFY | `packages/jwc/src/index.ts` |
| MODIFY | `packages/jwc/scripts/build-node.ts` |
| MODIFY | `packages/jwc/scripts/smoke-node-sdk.mjs` |
| NEW/MODIFY | `packages/jwc/scripts/smoke-packed-sdk.mjs` |
| MODIFY | `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/120_embedding_slice.md` |

### Verification

```bash
bun --cwd=packages/jwc run build:node
node packages/jwc/scripts/smoke-node-sdk.mjs
```

## Cycle 2 — 130 package surface and Bun dependency launcher

### Intent

Make the standalone package installable as `jawcode` with command `jwc`, using
an npm-managed Bun runtime dependency rather than requiring the user to install
Bun manually.

### Files

| Action | Path |
|---|---|
| MODIFY | `packages/jwc/package.json` |
| MODIFY | `packages/jwc/bin/jwc.js` |
| NEW | `packages/jwc/scripts/resolve-bun-runtime.cjs` |
| NEW | `packages/jwc/scripts/verify-runtime.cjs` |
| MODIFY | `packages/jwc/scripts/build-node.ts` |
| MODIFY | `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/080_bun_distribution_contract.md` |
| MODIFY | `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/130_packaging_slice.md` |

### Package contract

- package name: `jawcode`
- user bin: `jwc`
- package dependency: `bun@1.3.14`
- package files include `bin`, `dist`, `dist-node`, `scripts`
- exports point at distributable artifacts, not source TypeScript
- launcher resolves package-local Bun first, compatible system Bun second, then
  fails with a clear remediation message.

### Verification

```bash
bun --cwd=packages/jwc run bundle
bun --cwd=packages/jwc run build:node
cd packages/jwc && npm pack --dry-run
```

## Cycle 3 — 140 public push and CI tracking

### Intent

Push each completed slice publicly and track CI failures immediately.

### Verification

```bash
git push fork agent
gh run list --limit 5
gh run watch <run-id> --exit-status
```

Do not publish to npm in this cycle.

## Cycle 4 — 150 active public visible cleanup

### Intent

Remove or compatibility-alias active public legacy identity on public/current
release surfaces, including docs, issue templates, package metadata, runtime
user text, release URLs, plugin/MCP visible defaults, and cli-jaw embedded
Jawcode bundles.

The 150 completion bar is now active public `gajae` zero plus active public
`gjc` zero in both Jawcode and cli-jaw. Historical attribution and compatibility
readers are allowed only in explicitly classified zones.

### Files

| Action | Path |
|---|---|
| NEW | `scripts/check-public-legacy-zero.ts` |
| MODIFY | `.github/ISSUE_TEMPLATE/*.yml` |
| MODIFY | `README.md` |
| MODIFY | `README.jwc.md` |
| MODIFY | `structure/*.md` as required |
| MODIFY | `docs/*.md` active-current docs as required |
| MODIFY | `package.json` and publishable `packages/*/package.json` metadata as required |
| MODIFY | `scripts/rebrand-inventory.ts` if inventory rules need updates |
| MODIFY | `/Users/jun/Developer/new/700_projects/cli-jaw/src/lib/tui/jawcode-*bundle*` tracked embedded bundles |

Inherited GitHub Actions workflows were already deleted in commit
`499c09b2`; do not restore them during 150. Fresh CI/release policy is a 160+
track.

### Verification

```bash
bun --cwd=packages/coding-agent run generate-docs-index
bun scripts/check-public-legacy-zero.ts
bun scripts/rebrand-inventory.ts --strict
bun scripts/check-visible-definitions.ts
bun scripts/verify-g002-gates.ts
bun --cwd=packages/jwc run bundle
bun --cwd=packages/jwc run build:node
(cd packages/jwc && npm pack --dry-run)
git diff --check
```

cli-jaw verification must include a scripted or documented guard over tracked
embedded `src/lib/tui/jawcode-*bundle*` files, plus the appropriate cli-jaw
build command after reading that repo's package scripts. Local untracked
code-mode recovery files are excluded from this cycle until they become
repository surface.

## Cycle 4.5 — 155/156 active public zero split

### Intent

Split the active public zero cleanup into a guardable gap run and a concrete
execution slice so this work does not collapse into an unbounded internal
namespace rename.

### Files

| Action | Path |
|---|---|
| NEW | `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/155_active_public_zero_gap_run.md` |
| NEW | `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/156_active_public_zero_execution.md` |
| NEW | `scripts/check-public-legacy-zero.ts` |

### Verification

```bash
bun scripts/check-public-legacy-zero.ts
bun scripts/verify-g002-gates.ts
bun scripts/rebrand-inventory.ts --strict
git diff --check
```

## Stop point

Stop after 150 passes locally in both repositories and every remaining
`gajae`/`gjc` hit is either gone from active public surfaces or classified as
historical/compatibility-only. Remote CI is not a 150 stop condition because
inherited workflows are absent; 160 cli-jaw integration plus fresh release CI
design remains the next goal.
