# 11 — Slice 1: local release readiness (B/C)

## What was done
1. **Aligned local bun 1.3.11 → 1.3.14** (`bun upgrade`; latest == repo's required min). This resolved
   the `validate:jwc-release` packed-sdk SyntaxError: the bundle uses `using` (TC39 explicit resource
   management) which sub-1.3.14 bun cannot parse. The repo already requires `bun>=1.3.14`
   (engines + `resolveBunRuntime` MIN_BUN_VERSION + `bun@1.3.14` dep); local env was simply stale.
2. **Diagnosed two local-only artifacts (NOT release blockers):**
   - `using` parse error → stale local bun (fixed by upgrade).
   - `validate:jwc-release` native-probes failing on `better-sqlite3` ERR_DLOPEN_FAILED → caused by
     `bun run` injecting a `node`→bun shim into PATH, so the probe ran under bun. The release pipeline
     invokes native-probes via real `node` (proven: `node scripts/smoke-packed-sdk.mjs --native-probes`
     → exit 0, all natives import OK). Not a release issue.
3. **Confirmed `@jawcode-dev/natives` is a hard runtime dep** (statically imported across 44+ files:
   grep/glob/shell/tokenizer/tui/ast-edit…). `optionalDependencies` only buys install-time platform
   tolerance; the CLI genuinely needs it. So `jwc --version` failing without natives is by-design, not a
   bug to "fix" with lazy loading.
4. **Fixed the real dry-run blocker.** jwc's `--registry-faithful` preBuild installs only the jawcode
   tarball and pulls `@jawcode-dev/natives@<release-ver>` from the live registry. Mid-release that
   version is unpublished, so the smoke can NEVER pass in a dry-run (local or CI) — and it is redundant
   with `release.yml`'s post-publish registry smoke. Added pure, exported
   `preBuildStepEnabled(argv,{dryRun})` in `scripts/ci-release-publish.ts` that skips
   `--registry-faithful` when `--dry-run`; wired into `preparePackage`. Real publish behavior unchanged.

## Files
- `scripts/ci-release-publish.ts` — add `preBuildStepEnabled`, gate the preBuild loop.
- `scripts/release-publish-order.test.ts` — +1 test for the gate (runs on real publish, skipped in dry-run).

## Verification
- `bun test scripts/release-publish-order.test.ts` → **4 pass / 0 fail**.
- `bunx biome check` → clean. `git diff --check` → clean.
- **Full local CI-faithful dry-run** `bun scripts/ci-release-publish.ts --dry-run --tag latest` →
  **exit 0** end-to-end (skips registry-faithful, reaches `DRY RUN npm publish` for all 10 packages incl.
  jwc + bridge-client). Manifest in-place mutations restored (`git restore packages/*/package.json`).

## Outcome
Release is code-ready and dry-run-green locally. Next: S2 CI dry-run, then S3 real publish (gated on
npm OIDC trusted-publisher config — Jun's npmjs.com setting for the 8 unpublished names).
