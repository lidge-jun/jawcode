# 172 - final JWC smoke and audit bundle

## Goal

Prove the 160+ marathon slices leave Jawcode and cli-jaw able to run the intended JWC integration path:

- `jawcode` package exposes `jwc` and `jawcode/sdk`.
- cli-jaw can import the embedded `jawcode/sdk` path without a global `jwc`.
- code-mode routes still expose their read-only surfaces.
- mac MCP/CUA defaults are covered by release validation.
- GitHub workflow files remain absent until a safe runner policy is approved.

## Verification

Jawcode:

```sh
bun --cwd=packages/jwc run verify:runtime --json
bun run validate:jwc-release
```

Evidence:

```text
verify-runtime: ok true, source package:bun, version 1.3.14
jwc/0.1.0
[smoke 120] jawcode/sdk import OK - 28 exports
release publish contract: 3 pass, 0 fail
mac mcp/cua defaults: 79 pass, 0 fail
GitHub workflow guard OK: .github/workflows has no workflow files
Active public legacy identity zero OK
[validate:jwc-release] OK
```

Known retained warning:

```text
This "import()" was not recognized because the second argument was not an object literal
```

This is the same esbuild dynamic import warning recorded in earlier slices and does not fail the release runner.

cli-jaw:

```sh
npm run smoke:jwc:no-global
tsx --import ./tests/setup/test-home.ts --experimental-test-module-mocks --test tests/unit/code-routes.test.ts
npm run typecheck
```

Evidence:

```text
[jwc no-global] jawcode/sdk import OK - 28 exports
[jwc no-global] global jwc absent; embedded package import path OK
code-routes.test.ts: tests 2, pass 2, fail 0
npm run typecheck: tsc --noEmit exited 0
```

## Repository state note

Jawcode is clean after the 171 commit before adding this document.

cli-jaw has unrelated dirty files at verification time:

```text
bin/commands/tui/fullscreen-mode.ts
src/agent/jwc-event-mapper.ts
src/cli/tui/render/frame.ts
src/cli/tui/renderers.ts
src/core/config.ts
tests/unit/tui-fullscreen-source-contract.test.ts
tests/unit/jwc-event-mapper.test.ts
```

Those files were not staged or committed by this slice. The verification above was run against the current cli-jaw working tree because the user asked to continue the active integration goal, but the dirty files remain out of this Jawcode commit.
