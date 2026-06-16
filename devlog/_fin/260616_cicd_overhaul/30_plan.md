# CI/CD Overhaul Plan (R2 — Critic feedback applied)

Date: 2026-06-16
PABCD Stage: P (Planning)
Decisions: `20_decisions.md`
Investigation: `10_investigation_synthesis.md`
Critic R1: ITERATE (4 BLOCK, 7 CONCERN, 3 NOTE — all addressed below)

---

## Scope

4 waves of execution:

| Wave | Workstream | Files | Risk |
|---|---|---|---|
| W1 | npm dep fix + publish pipeline unification | 4 files | HIGH — blocks CI |
| W2 | CI workflow optimization | 2 files | MEDIUM — workflow yaml |
| W3 | gjc remnant cleanup | ~15 files | LOW — mostly text/config |
| W4 | ~~types fix~~ DEFERRED | — | — |

W4 deferred: `packages/jwc` intentionally ships `.ts` source as types (Bun-first package). D4 decision updated to match.

---

## Wave 1: npm Dep Fix + Publish Pipeline Unification (CRITICAL PATH)

### W1-A: Fix packages/jwc/package.json deps + version bump

**File**: `packages/jwc/package.json` (MODIFY)

```diff
- "version": "1.0.0",
+ "version": "1.0.1",
  ...
  "dependencies": {
-   "@gajae-code/natives": "0.4.4",
+   "@gajae-code/natives": "1.0.0",
  },
  "devDependencies": {
-   "@gajae-code/coding-agent": "0.4.4",
+   "@gajae-code/coding-agent": "1.0.0",
  }
```

After edit: `bun install` to regenerate `bun.lock`. Commit updated `bun.lock`.

**Why `1.0.0` not `workspace:*`**: `npm pack` (used by smoke-packed-sdk.mjs in CI) reads package.json literally. `workspace:*` would end up in the tarball, and `npm install` can't resolve it outside a workspace. Hard-coded `1.0.0` works in all paths: CI smoke, publish, consumer install. Future version bumps are guarded by W1-E version-match gate.

### W1-B: Add --provenance and --tag to ci-release-publish.ts

**File**: `scripts/ci-release-publish.ts` (MODIFY)

No preparePackage() restructure needed (deps are now hard-coded `1.0.0`, not `workspace:*`).

Only changes:
1. Add `--provenance` flag to `publishPackage()` (dev-devops §2.5 supply chain integrity)
2. Add `--tag` CLI argument support for dist-tag selection

```typescript
// Top-level: parse CLI args
const distTag = (() => {
  const idx = process.argv.indexOf("--tag");
  return idx >= 0 ? process.argv[idx + 1] : undefined;
})();

// In publishPackage(), change line 248:
// FROM: const result = await $`npm publish --access public`.cwd(pkgDir).quiet().nothrow();
// TO:
const publishArgs = ["publish", "--access", "public", "--provenance"];
if (distTag) publishArgs.push("--tag", distTag);
const result = await $`npm ${publishArgs}`.cwd(pkgDir).quiet().nothrow();
```

### W1-E: Version-match gate (NEW — guards against stale hard-coded versions)

**File**: `scripts/jwc-release-validation.ts` (MODIFY)

Add a step that verifies jwc's internal dep versions match workspace versions:

```typescript
{
  name: "internal dep version match",
  args: ["node", "-e", `
    const jwc = require('./packages/jwc/package.json');
    const natives = require('./packages/natives/package.json');
    const codingAgent = require('./packages/coding-agent/package.json');
    const checks = [
      ['@gajae-code/natives', jwc.dependencies?.['@gajae-code/natives'], natives.version],
      ['@gajae-code/coding-agent', jwc.devDependencies?.['@gajae-code/coding-agent'], codingAgent.version],
    ];
    let ok = true;
    for (const [name, dep, workspace] of checks) {
      if (dep && dep !== workspace) {
        console.error('MISMATCH: ' + name + ' dep=' + dep + ' workspace=' + workspace);
        ok = false;
      }
    }
    if (!ok) process.exit(1);
    console.log('internal dep versions match workspace');
  `],
}
```

### W1-C: Unify release.yml to use ci-release-publish.ts (Critic F1)

**File**: `.github/workflows/release.yml` (MODIFY)

Current `publish` job has: manual validate + bundle + pack + `npm publish` directly → NO manifest rewrite.

Replace with `ci-release-publish.ts` which handles full pipeline: rewrite → preBuild → publish.

```yaml
  publish:
    needs: mac-native-probes
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.3.14"
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          registry-url: "https://registry.npmjs.org"
      - uses: Swatinem/rust-cache@v2
        with:
          shared-key: release-${{ runner.os }}
          cache-on-failure: true
      - name: Cache bun dependencies
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: bun-${{ runner.os }}-${{ hashFiles('**/bun.lock') }}
      - run: bun install --frozen-lockfile
      - run: bun run build:native

      - name: Verify version matches
        run: |
          PKG_VERSION=$(node -e "console.log(require('./packages/jwc/package.json').version)")
          if [ "$PKG_VERSION" != "${{ inputs.version }}" ]; then
            echo "::error::package.json version ($PKG_VERSION) does not match input (${{ inputs.version }})"
            exit 1
          fi

      - name: Publish all packages
        run: |
          ARGS="--tag ${{ inputs.tag }}"
          if [ "${{ inputs.dry-run }}" = "true" ]; then
            bun scripts/ci-release-publish.ts --dry-run $ARGS
          else
            bun scripts/ci-release-publish.ts $ARGS
          fi
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Post-publish registry smoke
        if: inputs.dry-run != true
        run: |
          sleep 10
          node packages/jwc/scripts/smoke-packed-sdk.mjs --registry-faithful
```

This ensures:
1. `@gajae-code/natives@1.0.0` publishes BEFORE `jawcode@1.0.1` (publish order in script)
2. Manifest rewrite runs before preBuild smoke tests
3. `--registry-faithful` runs AFTER all packages are published

### W1-D: Regenerate bun.lock

After W1-A, run `bun install` to regenerate `bun.lock` with `workspace:*` resolution.
Commit the updated `bun.lock`.

### Acceptance Criteria (W1)
- `bun install` succeeds with updated `bun.lock`
- `node packages/jwc/scripts/smoke-packed-sdk.mjs` passes (version = `jwc/1.0.1`)
- `bun scripts/jwc-release-validation.ts` passes
- `bun scripts/ci-release-publish.ts --dry-run` succeeds (prints "DRY RUN" for each package)
- release.yml no longer has direct `npm publish` — uses ci-release-publish.ts

---

## Wave 2: CI Workflow Optimization

### W2-A: Merge check+package in ci.yml, add caching + concurrency

**File**: `.github/workflows/ci.yml` (MODIFY)

Changes:
1. Add `concurrency: group + cancel-in-progress`
2. Merge `check` + `package` into single `check-and-package` job
3. Replace manual `actions/cache` for Cargo with `Swatinem/rust-cache@v2`
4. Add bun dependency cache (`~/.bun/install/cache`)
5. Remove duplicate bundle steps (validate:jwc-release already bundles)
6. `mac-native-probes` unchanged (needs: check-and-package, macos-14)

Structure:
```yaml
name: CI
on:
  push:
    branches: [main, preview, dev]
  pull_request:
    branches: [main, preview]
env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  check-and-package:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: "1.3.14" }
      - uses: actions/setup-node@v4
        with: { node-version: "24" }
      - uses: Swatinem/rust-cache@v2
        with:
          shared-key: ci-${{ runner.os }}
          cache-on-failure: true
          save-if: ${{ github.ref == 'refs/heads/main' || github.ref == 'refs/heads/dev' }}
          cache-workspace-crates: true
      - name: Cache bun dependencies
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: bun-${{ runner.os }}-${{ hashFiles('**/bun.lock') }}
      - run: bun install --frozen-lockfile
      - run: bun run build:native
      - run: bun run ci:check:full
      - run: bun run ci:test:smoke
      - name: Canonical JWC release validation
        run: bun run validate:jwc-release
      - name: Node SDK smoke test
        run: node packages/jwc/scripts/smoke-node-sdk.mjs
      - name: Node bin syntax check
        run: node --check packages/jwc/bin/jwc.js
      - name: Pack dry-run
        run: cd packages/jwc && npm pack --dry-run
      - name: Pack size guard
        run: |
          cd packages/jwc
          npm pack 2>/dev/null
          SIZE=$(stat -c%s jawcode-*.tgz 2>/dev/null || stat -f%z jawcode-*.tgz)
          MAX=$((15 * 1024 * 1024))
          echo "Pack size: $SIZE bytes (max: $MAX)"
          [ "$SIZE" -le "$MAX" ] || { echo "::error::Package exceeds 15MB ($SIZE)"; exit 1; }
          rm -f jawcode-*.tgz
      - name: Pack file count guard
        run: |
          cd packages/jwc
          COUNT=$(npm pack --dry-run 2>&1 | grep "^npm notice total files:" | grep -o '[0-9]*')
          MAX=15
          echo "File count: $COUNT (max: $MAX)"
          [ "$COUNT" -le "$MAX" ] || { echo "::error::$COUNT files (max $MAX)"; exit 1; }

  mac-native-probes:
    runs-on: macos-14
    needs: check-and-package
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: "1.3.14" }
      - uses: actions/setup-node@v4
        with: { node-version: "24" }
      - uses: Swatinem/rust-cache@v2
        with:
          shared-key: ci-${{ runner.os }}
          cache-on-failure: true
          save-if: ${{ github.ref == 'refs/heads/main' }}
          cache-workspace-crates: true
      - name: Cache bun dependencies
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: bun-${{ runner.os }}-${{ hashFiles('**/bun.lock') }}
      - run: bun install --frozen-lockfile
      - run: bun run build:native
      - run: bun --cwd=packages/jwc run bundle
      - run: bun --cwd=packages/jwc run build:node
      - run: node packages/jwc/scripts/smoke-packed-sdk.mjs --native-probes
```

### W2-B: Optimize release.yml (already done in W1-C)

Additional changes beyond W1-C:
1. Add Swatinem/rust-cache + bun cache to mac-native-probes job
2. Add `timeout-minutes: 20` to both jobs
3. Update version input description for 1.0.1+

### Acceptance Criteria (W2)
- CI workflow YAML is valid (`bun scripts/check-workflow-yaml.ts` if available)
- Push to dev branch triggers CI, completes in <8min
- `release.yml` dispatch with dry-run=true succeeds

---

## Wave 3: gjc Remnant Cleanup (~30 items)

### W3-A: Install test scripts (4 changes)

| File | Line | Current | Replacement |
|---|---|---|---|
| `scripts/install-tests/run-ci.sh` | 63 | `smoke_cli "$BUN_INSTALL/bin/gjc"` | `smoke_cli "$BUN_INSTALL/bin/jwc"` |
| `scripts/install-tests/run-ci.sh` | 112 | `smoke_cli ./node_modules/.bin/gjc` | `smoke_cli ./node_modules/.bin/jwc` |
| `scripts/install-tests/source.dockerfile` | 24 | `RUN gjc --version` | `RUN jwc --version` |
| `scripts/install-tests/run-podman.sh` | 7,11,15 | `gjc-test-*` image tags | `jwc-test-*` |

### W3-B: Dockerfiles (8 changes)

| File | Change |
|---|---|
| `Dockerfile` | Lines 143-155: `/usr/local/bin/gjc` → `/usr/local/bin/jwc` + add `ln -s jwc gjc` compat symlink |
| `Dockerfile` | Line 189: `ENTRYPOINT ["gjc"]` → `ENTRYPOINT ["jwc"]` |
| `Dockerfile` | Lines 9,17-18,96,160: comment updates gjc → jwc |
| `Dockerfile.dockerignore` | Line 18: `.gjc/plugins/` → `.jwc/plugins/` |
| `Dockerfile.robojwc` | Lines 5-8,19: gjc shim → jwc |
| `Dockerfile.robojwc` | Lines 61-64: `~/.gjc` → `~/.jwc` |
| `Dockerfile.robojwc.dockerignore` | Line 20: `.gjc/plugins/` → `.jwc/plugins/` |

### W3-C: robojwc (5 changes)

| File | Change |
|---|---|
| `python/robojwc/docker-compose.yml:67` | `ROBJWC_GJC_COMMAND: gjc` → `ROBJWC_GJC_COMMAND: jwc` |
| `python/robojwc/docker-compose.yml:77,91,93` | `~/.gjc/` → `~/.jwc/` mount paths |
| `python/robojwc/src/config.py:76` | default `"gjc"` → `"jwc"` (keep env var name `ROBJWC_GJC_COMMAND`) |
| `python/robojwc/web/src/components/Working.tsx:64` | "gjc subprocess" → "jwc subprocess" |
| `python/robojwc/entrypoint.sh:60-66` | `~/.gjc` paths → `~/.jwc` |

### W3-D: Root package.json Docker scripts (2 changes)

| File | Change |
|---|---|
| `package.json:133` | `gajae-code/pi:dev` → `jawcode/pi:dev` in `pi:image` |
| `package.json:134` | `gajae-code/pi:dev` → `jawcode/pi:dev` in `pi:run` |

### W3-E: Scripts (2 changes)

| File | Change |
|---|---|
| `scripts/check-node20-baseline.test.ts:10` | `gjc-node20-baseline-` → `jwc-node20-baseline-` |
| `scripts/verify-jwc-skill-docs.ts:96-97` | console.log label `gjc` → `jwc` |

### NOT touched (intentional)
- `ENGINE_NAME = "gjc"` (KEEP-INTERNAL — log/path identifier)
- `@gajae-code/*` package scope (KEEP-COMPAT — npm names)
- `pkg.gjc ??` fallback chains (KEEP-COMPAT — backward compat)
- `packages/gajae-code/` (KEEP-COMPAT — private package, gjc bin)
- `X-Robogjc-*` HTTP headers (KEEP-COMPAT — API wire protocol)
- `python/robojwc/src/sandbox.py` `.gjc-*` dirs (KEEP-INTERNAL)
- `python/robojwc/entrypoint.sh` gjc group/users (KEEP-INTERNAL)
- Benchmark gjc-rpc references (OUT OF SCOPE — needs gjc-rpc rename first)

### Acceptance Criteria (W3)
- `bun run check:jwc-ui` passes (rebrand-inventory.ts --strict)
- `bun scripts/check-public-legacy-zero.ts` passes
- `bun scripts/verify-g002-gates.ts` passes

---

## Execution Order

```
W1-A (dep fix) → W1-D (bun install) → W1-B (publish script) → W1-C (release.yml)
                                            ↓
W2-A (ci.yml merge) ← depends on W1 being verified first
                                            ↓
W3-A..E (gjc cleanup) ← independent of W1/W2, can parallel
```

W1 must complete and verify before W2 (CI workflow changes depend on smoke test passing).
W3 is independent — can execute in parallel with W2.

## Verification Plan

1. After W1: `bun install` + `node packages/jwc/scripts/smoke-packed-sdk.mjs` + `bun scripts/ci-release-publish.ts --dry-run`
2. After W2: Push to dev, monitor CI run time
3. After W3: `bun run check:jwc-ui` + `bun scripts/check-public-legacy-zero.ts`
4. Full: `bun run ci:check:full` + `bun run ci:test:smoke`

## Risk Assessment

| Risk | Mitigation |
|---|---|
| bun.lock changes from workspace:* | Regenerate, commit (W1-D) |
| Smoke test with rewritten manifest | rewriteDependencyFields runs before preBuild |
| release.yml `npm publish` → ci-release-publish.ts | Publishes ALL packages, not just jwc. `skip if already published` logic handles this |
| Dockerfile gjc→jwc breaks existing `docker run` | gjc symlink preserved |
| robojwc ~/.gjc→~/.jwc breaks mount | Only affects new container builds, not running ones |
| NPM_TOKEN secret needed | release.yml already has NODE_AUTH_TOKEN; verify NPM_TOKEN availability |
