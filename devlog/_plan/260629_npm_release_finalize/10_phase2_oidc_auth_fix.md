# Phase 2 — OIDC publish E404 auth fix

## Symptom
`gh run 28330002127` publish job: provenance signed OK, then
`PUT /@jawcode-dev%2fnatives` → `E404 ... do not have permission`.
Job stops at natives (first unpublished pkg in order); jwc never attempted.

## Two candidate root causes (from npm/GitHub docs)
1. **`.npmrc` NODE_AUTH_TOKEN fallback**: `actions/setup-node` with
   `registry-url` writes `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}`
   into `~/.npmrc`. With no secret set, npm may auth with an empty/invalid
   token instead of pure OIDC → 404.
2. **Missing Trusted Publisher for natives**: 404 also means npm could not
   match the run to a configured Trusted Publisher. User configured TPs for the
   8 bootstrap packages; `@jawcode-dev/natives` (already on npm as 1.0.6) may
   have been omitted. ACCOUNT-LEVEL — user action, cannot fix in code.

## Code-side change (this phase)
- `.github/workflows/release.yml`: stop letting a token shadow OIDC on publish.
  Option: drop `registry-url` from setup-node (so no token .npmrc is written),
  OR add a step to scrub `_authToken` from ~/.npmrc before publish. Keep
  `id-token: write`. npm >= 11.5.1 already ensured.
- No source/test code changes; release.yml only.

## User-side prerequisite (cannot self-fix)
- Verify Trusted Publisher exists for `@jawcode-dev/natives` AND `jawcode`
  with org=lidge-jun, repo=jawcode, workflow=release.yml.

## Verification
- yamllint/parse release.yml; re-dispatch release.yml dry-run=false; watch;
  registry check natives@1.1.0 + jawcode@1.1.0 present.
