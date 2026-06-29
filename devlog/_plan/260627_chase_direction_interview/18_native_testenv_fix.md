# Native test-env fix — catalog natives → workspace:* (user-authorized)

> Unblocks the runtime test suite that was broadly broken all session. User authorized the
> catalog alignment (2026-06-27). This is the dependency-config fix devlog 16 said needed a
> maintainer decision.

## Root cause (from devlog 16)

The root `package.json` catalog pinned `@jawcode-dev/natives` to **`1.0.2`** while the workspace
package `packages/natives` had advanced to **`1.0.6`** (sentinel `nV1_0_4`, built `.node` exports
`piNativesV1_0_4` — internally consistent). The catalog `1.0.2` resolved dependents to the
**published 1.0.2**, whose bundled `.node` is internally broken (loader expects `__piNativesV1_0_2`
but the `.node` exposes `piNativesV1_0_0`). So every coding-agent test that loads
`@jawcode-dev/utils → natives` failed at native load. Only `natives` was mismatched; tui/utils/ai/
coding-agent catalog `1.0.2` correctly matched their workspace versions (1.0.2).

## Fix

1. `package.json` catalog: `"@jawcode-dev/natives": "1.0.2"` → `"workspace:*"` (use the local,
   correctly-built workspace package, not the broken published 1.0.2).
2. `bun install --force` → bun.lock re-resolved natives to `@jawcode-dev/natives@workspace:packages/natives`.
3. Removed the stale physical copies under `packages/{utils,tui,coding-agent,agent}/node_modules/
   @jawcode-dev/natives` (the lockfile pointed to workspace but the old 1.0.2 copies persisted),
   then `bun install` re-linked from the workspace.

## Verification

- `bun test .../goals/goal-tool.test.ts` → native loads (14 pass, 1 unrelated schema-count fail);
  the `Failed to load pi_natives` error is **gone**.
- `bun test assistant-message-cache.test.ts thinking-collapse.test.ts` → **9 pass / 0 fail** —
  this **runtime-validates** the overnight tsc-only close of **10.013** (content-block cache +
  collapse coexistence + no regression all confirmed live).

## Impact

The remaining 7 chase cards (10.002, 10.007, 10.012, 10.021, 10.023, 20.005, 20.006) can now be
closed with **real runtime tests** instead of tsc-only. Proceeding to close them properly.

## Commit scope

- `package.json` (catalog) + `bun.lock` + this devlog. No push.
