# 168 — cli-jaw active-public legacy env cleanup

## Goal

Remove newly introduced `GJC_BRAND_NAME` writes from cli-jaw's active JWC integration paths.

## Patch

cli-jaw changes:

- `src/agent/jwc-runtime.ts` now sets only `JWC_BRAND_NAME`.
- `src/code-mode/acp-host.ts` now launches the ACP child with only `JWC_BRAND_NAME`.

The upstream compatibility fallback remains inside Jawcode internals where needed, but cli-jaw active integration code should not inject legacy env names.

## Verification

Commands:

```sh
bun scripts/check-public-legacy-zero.ts
npm run typecheck
```

Observed evidence:

```text
Active public legacy identity zero OK
npm run typecheck -> exit 0
```

## Result

Slice 168 keeps cli-jaw's newly added JWC integration aligned with the active public legacy-zero guard. Broader repository-wide internal compatibility names remain classified by `scripts/legacy-name-inventory.ts`.
