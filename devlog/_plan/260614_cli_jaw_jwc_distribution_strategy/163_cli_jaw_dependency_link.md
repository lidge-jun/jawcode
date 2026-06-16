# 163 — cli-jaw Jawcode dependency link

## Goal

Make cli-jaw resolve the Jawcode package through a package dependency before flipping runtime imports.

## Decision

For the current dev-branch integration, cli-jaw uses:

```json
"jawcode": "file:../jawcode/packages/jwc"
```

This matches the local workspace layout under `/Users/jun/Developer/new/700_projects/` and lets cli-jaw test `jawcode/sdk` before the public npm package is published. The release slice must replace this with a published semver dependency before npm publishing cli-jaw.

## Verification

Commands run in `/Users/jun/Developer/new/700_projects/cli-jaw`:

```sh
npm install --save ../jawcode/packages/jwc --package-lock-only --ignore-scripts
npm install --ignore-scripts
node -e "import('jawcode/sdk').then(m=>console.log('jawcode/sdk ok', typeof m.createAgentSession, Object.keys(m).length))"
git diff --check -- package.json package-lock.json
```

Observed evidence:

```text
jawcode/sdk ok function 28
```

`pnpm install --lockfile-only` was attempted but reverted because it updated unrelated `latest` optional dependency resolutions. This slice intentionally keeps the committed dependency proof to npm `package.json` and `package-lock.json`.

## Result

cli-jaw can now resolve `jawcode/sdk` from the local package dependency. Slice 164 can safely replace the resident runtime fallback from `jwc/sdk` to `jawcode/sdk`.
