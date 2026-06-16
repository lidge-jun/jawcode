# 169 — release validation runner

## Goal

Make the current JWC release evidence reproducible through one command instead of a loose checklist.

## Patch

Jawcode adds:

- `scripts/jwc-release-validation.ts`
- `package.json` script `validate:jwc-release`

The runner executes:

1. `bun --cwd=packages/jwc run bundle`
2. `bun --cwd=packages/jwc run build:node`
3. `node packages/jwc/scripts/smoke-packed-sdk.mjs`
4. `bun test scripts/release-publish-order.test.ts`
5. `bun scripts/check-public-legacy-zero.ts`
6. `bun run inventory:legacy-names`

## Verification

Command:

```sh
bun run validate:jwc-release
```

Observed evidence:

```text
jwc/0.1.0
[smoke 120] jawcode/sdk import OK — 28 exports
scripts/release-publish-order.test.ts -> 3 pass, 0 fail
Active public legacy identity zero OK
[validate:jwc-release] OK
```

Observed inventory summary during the runner:

```json
{
  "active-public": 346,
  "current-internal": 883,
  "compat-internal": 7429,
  "history": 11902,
  "reference": 1068
}
```

## Result

Slice 169 turns the 120-170 validation chain into a single local command. It intentionally includes the inventory report as a non-strict final step so the cleanup roadmap stays visible without blocking package/import/runtime proof.
