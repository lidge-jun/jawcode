# 130 — packaging slice

## Goal

Make standalone JWC installable from a package or release artifact without relying on unpublished workspace packages.

## Preferred P0 path

Use package `jawcode` with command `jwc`:

- package name is `jawcode`;
- package exposes bin `jwc`;
- package includes built runtime output;
- package `files` includes required bin/dist/dist-node/scripts;
- postinstall is safe, idempotent, and non-fatal;
- package depends on `bun@1.3.14`; the launcher reuses package-local Bun,
  `JWC_BUN_PATH`, or a compatible system Bun for standalone CLI;
- CI mode skips interactive or machine-mutating setup.

## Required tests

- package dry run includes expected files;
- install smoke in temporary directory;
- `jwc --version`;
- `jwc --help`;
- postinstall safe mode;
- runtime resolver smoke;
- `jawcode/sdk` Node import smoke;
- no unresolved `@gajae-code/*` dependency in the published package unless that package is intentionally published too.

## Build recipe

1. `bun --cwd=packages/jwc run bundle`
2. `bun --cwd=packages/jwc run build:node`
3. Update package exports for publish:
   - `.` -> distributable CLI/manifest surface;
   - `./sdk` -> `./dist-node/sdk.js` with generated declarations if available.
4. Ensure `files` includes:
   - `bin`;
   - `dist`;
   - `dist-node`;
   - `scripts`;
   - any package metadata needed by the launcher.
5. Keep `scripts/verify-runtime.cjs --postinstall` non-fatal. npm lifecycle
   ordering can make package-local Bun temporarily unavailable during install;
   `bin/jwc.js` performs the authoritative runtime check.
6. Pack and inspect:

```sh
cd packages/jwc
npm pack --dry-run
node scripts/smoke-node-sdk.mjs
```

7. Packed install smoke:

```sh
tmpdir="$(mktemp -d)"
npm install -g ./jawcode-*.tgz --prefix "$tmpdir"
PATH="$tmpdir/bin:$PATH" jwc --version
node -e 'import("jawcode/sdk").then(m => { if (!m.createAgentSession) throw new Error("missing createAgentSession") })'
```

The exact smoke path may become a checked script, but the semantics above are the contract.

## Do not do yet

- do not publish to npm until package name `jawcode` ownership/auth is confirmed;
- do not rename all workspace scopes;
- do not make standalone packaging the only path cli-jaw can consume.
