# 260629 npm Release Finalize — Plan

## Objective
Commit pending release-script changes, fix provenance blocker, push `main`,
then run `release.yml` (OIDC, 1.1.0/latest) to publish all packages and verify.

## Context (verified)
- 8 packages bootstrap-published at 1.1.0 by `bitkyc08` (registry 200 each).
- Already on npm: `@jawcode-dev/natives@1.0.6`, `jawcode@1.0.9`.
- Trusted Publishers configured by user for all 10 packages.
- Working tree: `scripts/ci-release-publish.ts` (added `--otp`/`--interactive`),
  plus unrelated generated `docs-index.generated.ts` (leave untouched).

## Root-cause finding (E422 from prior real release)
- npm provenance requires `repository.url` to match the GitHub repo.
- `packages/jwc/package.json` and `packages/cu-mcp-server/package.json` have NO
  `repository` block. On OIDC release the script publishes with `--provenance`;
  `jwc@1.1.0` is unpublished → it WILL fail E422 again unless fixed.
  `cu-mcp-server@1.1.0` is already published (script skips it) but fix anyway
  for consistency + future releases.

## What OIDC release will actually publish
- Skipped (name@1.1.0 exists): utils, ai, tui, stats, agent-core,
  coding-agent, cu-mcp-server, bridge-client.
- Published with provenance: `@jawcode-dev/natives@1.1.0`, `jawcode@1.1.0`.

## Change map
1. `packages/jwc/package.json` — add `repository` block (type/url/directory)
   matching sibling packages, fixing provenance.
2. `packages/cu-mcp-server/package.json` — add same `repository` block.
3. Commit A: release-script flags (`scripts/ci-release-publish.ts`).
4. Commit B: provenance fix (the two manifests).
5. Push `main`.
6. Dispatch `release.yml` via `gh workflow run` (version=1.1.0, tag=latest,
   dry-run=false). Watch to completion.
7. Verify registry: natives 1.1.0 + jawcode 1.1.0 present; all 10 at 1.1.0.

## Risks
- If a Trusted Publisher is misconfigured for natives/jwc → OIDC publish 403.
  Report verbatim, do not work around (account-level, user's decision).
- `docs-index.generated.ts` left uncommitted (unrelated generated artifact).

## Retry 1 RCA — release run 28330002127
- `mac-native-probes` passed; `publish` failed at `@jawcode-dev/natives@1.1.0`.
- Evidence: the job signed and uploaded a provenance statement, then npm returned
  E404 `do not have permission` for `PUT @jawcode-dev%2fnatives`.
- The log also showed `NODE_AUTH_TOKEN` in the publish step environment. This is
  consistent with `actions/setup-node` writing an npm user config containing
  `_authToken=${NODE_AUTH_TOKEN}` when `registry-url` is configured.
- Fix: before `npm publish`, remove `_authToken` from npm's active user config
  (`$NPM_CONFIG_USERCONFIG` when set, else `$HOME/.npmrc`) so npm uses OIDC
  trusted publishing instead of token auth.
