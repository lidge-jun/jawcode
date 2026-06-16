# Phase 7-8: Rebuild + Legacy Compat

## Phase 7: Rebuild

After all source changes (Phase 2-6):

```bash
# 1. Regenerate bun.lock
rm bun.lock && bun install

# 2. Rebuild dist bundles (contains embedded @gajae-code strings)
cd packages/jwc && bun run bundle && bun run build:node

# 3. Regenerate schemas
bun run generate-schemas

# 4. Regenerate models (if @gajae-code refs in model registry)
bun --cwd=packages/ai run generate-models

# 5. Type check
bun run check:ts

# 6. Full test suite
bun run ci:check:full

# 7. Smoke test
bun run ci:test:smoke

# 8. Gate scripts
bun scripts/check-public-legacy-zero.ts
bun scripts/verify-g002-gates.ts
bun scripts/rebrand-inventory.ts --strict
bun test packages/coding-agent/test/default-jwc-definitions.test.ts
```

## Phase 8: Legacy Compatibility

### PI_SCOPE_ALIASES reverse shim

In `packages/coding-agent/src/extensibility/pi-scope-aliases.ts`:

Add `"jawcode"` to `PI_SCOPE_ALIASES` array. The shim maps old scopes to current internal modules.
Keep `"gajae-code"` in the alias list so existing `@gajae-code/*` plugins still resolve.

### npm deprecation

After successful publish of `@jawcode/*`:

```bash
npm deprecate "@gajae-code/coding-agent@*" "Moved to @jawcode/coding-agent"
npm deprecate "@gajae-code/utils@*" "Moved to @jawcode/utils"
# etc.
```

### package.json `gajae-code` (legacy wrapper)

Update `packages/gajae-code/package.json` dep to `@jawcode/coding-agent`.
Consider adding npm deprecation notice to redirect to `jawcode`.

## Verification

```bash
# Verify version output
./bin/jwc.sh --version
# Expected: jwc/1.0.x

# Verify smoke
bun run ci:test:smoke

# Verify no stale @gajae-code in dist
grep -c '@gajae-code' packages/jwc/dist/jwc.bundle.js
# Expected: 0 (or only in PI_SCOPE_ALIASES / compat strings)
```
