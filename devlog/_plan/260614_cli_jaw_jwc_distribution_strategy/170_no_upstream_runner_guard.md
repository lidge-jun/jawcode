# 170 - no upstream-runner workflow guard

## Goal

Keep the fresh Jawcode repository from accidentally requesting inherited, fork-origin, or upstream self-hosted GitHub runners before a dedicated runner policy is approved.

This is intentionally a guard, not a full CI replacement. Local release validation stays the authoritative gate for now.

## Patch

- Added `scripts/check-no-github-workflows.ts`.
- Added `bun run check:no-github-workflows`.
- Inserted the workflow guard into `bun run validate:jwc-release`.
- Updated `060_ci_release_tracks.md` to document that public `.github/workflows/*` files are currently blocked.

Allowed `.github` content remains:

- issue templates
- PR templates
- security metadata
- dependabot config
- local composite actions

Blocked content:

- `.github/workflows/*` files, until a safe runner policy is explicitly approved.

## Verification

Commands run:

```sh
bun run check:no-github-workflows
git diff --check -- package.json scripts/check-no-github-workflows.ts scripts/jwc-release-validation.ts devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/060_ci_release_tracks.md
bun run validate:jwc-release
```

Evidence:

```text
GitHub workflow guard OK: .github/workflows has no workflow files
jwc/0.1.0
[smoke 120] jawcode/sdk import OK - 28 exports
3 pass
0 fail
Active public legacy identity zero OK
[validate:jwc-release] OK
```

Known retained warning:

```text
This "import()" was not recognized because the second argument was not an object literal
```

This warning is emitted by esbuild while bundling an upstream dynamic import site and does not fail the current Jawcode release validation runner.
