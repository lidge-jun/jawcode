# 162 — package artifact version smoke

## Problem

The first packed-install smoke proved `jawcode/sdk` imported successfully, but it also exposed a release artifact leak:

```text
jwc/0.4.4
```

That version came from the internal `@gajae-code/utils` package version, not from the published `jawcode` package manifest. A user installing `npm install -g jawcode` would see the wrong CLI version.

## Patch

- `packages/jwc/bin/jwc.js` reads the installed `jawcode/package.json` and sets `JWC_PACKAGE_VERSION` before launching the managed Bun runtime.
- `packages/jwc/src/cli-entry.ts` sets the same package version before loading the bundled coding-agent CLI.
- `packages/utils/src/dirs.ts` lets Jawcode package bins override the internal workspace version through `JWC_PACKAGE_VERSION`.
- `packages/jwc/scripts/smoke-packed-sdk.mjs` now asserts `jwc --version` equals `jwc/<jawcode package version>`.

## Verification

Commands:

```sh
bun --cwd=packages/jwc run bundle
bun --cwd=packages/jwc run build:node
node packages/jwc/scripts/smoke-packed-sdk.mjs
bun test scripts/release-publish-order.test.ts
git diff --check -- packages/jwc/bin/jwc.js packages/jwc/scripts/smoke-packed-sdk.mjs packages/jwc/src/cli-entry.ts packages/utils/src/dirs.ts
```

Observed evidence:

```text
jwc/0.1.0
[smoke 120] jawcode/sdk import OK — 28 exports
```

`scripts/release-publish-order.test.ts` stayed green: 3 pass, 0 fail.

## Result

Slice 162 closes the package artifact truth gap for the CLI version and SDK import surface. Later cli-jaw slices can now consume an artifact whose package name, bin name, version output, and `jawcode/sdk` import are aligned.
