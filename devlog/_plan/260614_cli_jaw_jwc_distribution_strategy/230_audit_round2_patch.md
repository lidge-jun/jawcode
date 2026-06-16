# 230 Round-2 Packaging Audit Patch

## Trigger

The second audit round found issues that were not covered by the first 120-150 packaging slice verification:

- `jawcode` could be published without `dist-node/sdk.js` because the `packages/jwc` publish entry only ran the Bun CLI bundle.
- `jawcode/sdk` type targets pointed at `src/*.ts`, but the package `files` list did not include `src`.
- The packed SDK smoke linked the workspace package, so it missed publish-file omissions and dependency-resolution failures.
- Update/install fallback paths still targeted `gjc-*` release assets and `@gajae-code/coding-agent@latest` instead of `jwc-*` and `jawcode@latest`.
- `packages/cu-mcp-server` was non-private and version-bumped, but absent from the publish set.
- `packages/cu-mcp-server`'s TypeScript build path OOMed in local verification, making it unsafe as a release prebuild.

## Patch

- `scripts/ci-release-publish.ts`
  - Adds `packages/cu-mcp-server` to the publish set.
  - Makes `packages/jwc` publish run `bundle`, `build:node`, and `smoke:packed-sdk`.
- `packages/jwc/package.json`
  - Adds `src` to `files` so current export `types` targets are present in the tarball.
- `packages/jwc/scripts/smoke-packed-sdk.mjs`
  - Packs and installs real `jawcode` and local `@gajae-code/natives` tarballs into a temporary project.
  - Verifies `node_modules/.bin/jwc --version`.
  - Verifies `import("jawcode/sdk")` returns `createAgentSession`.
- `packages/coding-agent/src/cli/update-cli.ts`
  - Switches update fallback to `APP_NAME`, `jawcode`, `lidge-jun/jawcode`, and `jwc-*` assets.
- `scripts/install.sh` / `scripts/install.ps1`
  - Switch public install surface to `jawcode` + `jwc`, with `GJC_INSTALL_DIR` kept only as a compatibility fallback.
- `scripts/install-tests/*`
  - Extends tarball install smoke to include `jawcode`, `jwc`, and `jawcode/sdk`.
- `packages/cu-mcp-server/package.json`
  - Changes build to `bun build src/index.ts --target=node --outfile=dist/index.js`, avoiding the `tsc`/`tsgo` OOM path while producing the executable MCP server artifact.
- `scripts/verify-g002-gates.ts`
  - Adds a public-doc guard for stale default-skill paths and public legacy command wording.

## Verification

- `bun test packages/coding-agent/test/update-cli.test.ts scripts/release-publish-order.test.ts`
  - 15 pass, 0 fail.
- `bun scripts/check-visible-definitions.ts && bun scripts/rebrand-inventory.ts --strict && bun scripts/verify-g002-gates.ts && git diff --check`
  - All passed; G002 gate verification passed.
- `bun --cwd=packages/coding-agent run check:types`
  - Passed.
- `bun --cwd=packages/jwc run bundle && bun --cwd=packages/jwc run build:node && bun --cwd=packages/jwc run smoke:packed-sdk`
  - Passed; `jwc/0.4.4`; `jawcode/sdk import OK — 28 exports`.
- `bun --cwd=packages/cu-mcp-server run build && node --check packages/cu-mcp-server/dist/index.js`
  - Passed; build emitted `packages/cu-mcp-server/dist/index.js`.
- `bun scripts/ci-release-build-binaries.ts --dry-run --targets linux-x64,linux-arm64,darwin-x64,darwin-arm64,win32-x64`
  - Passed; dry-run outputs `jwc-linux-*`, `jwc-darwin-*`, `jwc-windows-x64.exe`.
- Targeted public legacy scan over touched install/update/docs files
  - No hits for stale public release URLs, `gjc-*` release assets, `@gajae-code/coding-agent@latest`, or legacy default-skill paths.

## Remaining Notes

- The repo still intentionally retains legacy internal compatibility names (`ENGINE_NAME = "gjc"`, legacy env fallbacks, old coding-agent bin) under the existing allowlist. This patch closes the visible Jawcode package/install/release path, not the later full internal namespace rename.
