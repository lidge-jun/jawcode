# 165 — cli-jaw no-global JWC smoke

## Goal

Prove cli-jaw's resident JWC integration does not require a globally installed `jwc` binary for the primary embedded SDK path.

## Patch

cli-jaw adds:

- `scripts/jwc-no-global-smoke.mjs`
- `package.json` script `smoke:jwc:no-global`

The smoke creates a reduced `PATH`, asserts `command -v jwc` fails, statically checks `src/agent/jwc-runtime.ts` defaults to `jawcode/sdk` rather than `jwc/sdk`, and then imports `jawcode/sdk` in a child Node process under that same reduced `PATH`.

## Verification

Commands run in `/Users/jun/Developer/new/700_projects/cli-jaw`:

```sh
npm run smoke:jwc:no-global
npm run typecheck
git diff --check -- package.json scripts/jwc-no-global-smoke.mjs
```

Observed evidence:

```text
[jwc no-global] jawcode/sdk import OK — 28 exports
[jwc no-global] global jwc absent; embedded package import path OK
```

## Result

The primary resident SDK path is now proven independent of global `jwc`. Code-mode ACP may still use a `jwc --mode acp` executable fallback, which remains a separate slice because it is a child-process protocol path rather than the main resident runtime.
