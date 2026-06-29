# 12 — Slice 3 prerequisite: npm OIDC first-publish blocker (researched)

## Confirmed hard blocker for the 8 never-published packages
npm **OIDC trusted publishing requires the package to already exist** on the registry; you cannot
configure a Trusted Publisher for a non-existent name. The **first** publish of a brand-new package must
use a traditional credential (an npm automation/granular token, or local `npm publish` while logged in);
trusted publishing only takes over for subsequent releases.

Sources (rephrased for licensing compliance):
- npm official docs — Trusted publishers / `npm trust`: the package being configured must already exist.
  https://docs.npmjs.com/trusted-publishers/  ·  https://docs.npmjs.com/cli/v11/commands/npm-trust/
- npm/cli issue #8976 — OIDC E404 when first-publishing scoped packages from CI.
  https://github.com/npm/cli/issues/8976  ·  feature request #8544 "Allow publishing initial version with OIDC".

## Impact on this release
`release.yml` is **OIDC-only** (no `NPM_TOKEN`). It will succeed for the 2 already-published names
(`jawcode`, `@jawcode-dev/natives` — both already trust the workflow per commit 3707888) but will
**fail (E404)** on first publish of the 8 new names:
`@jawcode-dev/{utils,ai,agent-core,coding-agent,stats,tui,bridge-client}` + `jawcode-cu-mcp-server`.

## Resolution options (Jun's decision — needs npm account / credentials I cannot access)
- **A. One-time bootstrap publish** of the 8 new names with an npm automation/granular token (or local
  `npm publish --access public` while `npm login`-ed), then add each as a Trusted Publisher on npmjs.com;
  thereafter the OIDC workflow self-serves.
- **B. Token fallback in release.yml** — add `NPM_TOKEN` secret + `NODE_AUTH_TOKEN`/`.npmrc` so the
  workflow can token-publish (covers first publish of new names too). Note: `--provenance` needs
  `id-token:write` (already present) and works alongside token auth in GitHub Actions.

Either way requires Jun to provide npm credentials / configure npmjs.com. The release CODE is ready; this
is purely an account-config/auth gate plus push permission (local `main` is ahead of `origin/main`).
