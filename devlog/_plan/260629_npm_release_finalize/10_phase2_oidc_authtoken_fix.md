# Phase 2 — Fix OIDC Trusted Publishing (E404 authToken conflict)

## Root cause (confirmed)
- `actions/setup-node@v4` with `registry-url` writes `~/.npmrc`:
  `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}`.
- No `NODE_AUTH_TOKEN` secret is set, so npm authenticates with an EMPTY/invalid
  token instead of using OIDC trusted publishing. Registry rejects the PUT with
  E404 "do not have permission" — even though provenance signing (OIDC id-token)
  succeeded. (Known interaction: npm trusted publishing requires NO _authToken
  line in .npmrc; the token path takes precedence when present.)

## Evidence
- gh run 28330002127 publish job: provenance signed + transparency log entry,
  then `npm error 404 ... PUT @jawcode-dev/natives ... do not have permission`.
- `NODE_AUTH_TOKEN: XXXXX-XXXXX-XXXXX-XXXXX` printed in step env group.

## Fix (minimal, diff-level)
In `.github/workflows/release.yml`, before "Publish all packages", strip the
auth line so npm uses OIDC trusted publishing only. Add a step:

```yaml
- name: Remove npm auth token so OIDC trusted publishing is used
  run: |
    npmrc="${NPM_CONFIG_USERCONFIG:-$HOME/.npmrc}"
    if [ -f "$npmrc" ]; then
      sed -i '/_authToken/d' "$npmrc"
    fi
```
Rationale: setup-node still useful for Node/npm versioning; we only need to drop
the empty-token auth line it generated. `NPM_CONFIG_USERCONFIG` is used because
setup-node may point npm at a runner temp config instead of `$HOME/.npmrc`.

## Acceptance criteria
1. Re-run release.yml (1.1.0/latest, dry-run=false) → publish job success.
2. `@jawcode-dev/natives@1.1.0` and `jawcode@1.1.0` present on registry.
3. All 10 packages resolvable at 1.1.0.

## Risk
- If trusted publisher truly not configured for natives/jwc → still E404/E403.
  Then it's account-level (user action), report verbatim.
