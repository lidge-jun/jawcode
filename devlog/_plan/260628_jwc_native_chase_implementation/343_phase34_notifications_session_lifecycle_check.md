# 343 Phase 34 check — session lifecycle wiring verification

> All gates green.

## Tests
- `bun test test/notifications-session-lifecycle.test.ts` → **4 pass / 0 fail / 10 expect()**
  (disabled-skip, subagent-skip, enabled-start+discovery+cleanup, start-failure isolation).
- Full notifications regression `bun test test/notifications-*.test.ts test/notify-cli.test.ts`
  → **64 pass / 0 fail / 243 expect()** across 13 files (prior 60 + 4 new, no regression).

## Static analysis
- `bun run check:types` (`tsgo -p tsconfig.json --noEmit`) → **exit 0** — covers the `sdk.ts` edit.
- `bunx biome check` on session-lifecycle.ts/index.ts/sdk.ts/test → clean.
- `git diff --check` → exit 0.

## Residual / scope
- The live `sdk.ts` call is exercised at type level (check:types) and via the unit-tested helper;
  a full end-to-end live-session run is not automated here (would require booting an AgentSession),
  but the helper is failure-isolated (start error → null, never throws) so worst case is a no-op.
- `10.028` remaining done-gate: ask-flow forwarding (`ask` tool → `enqueueAction` → `action_resolved`
  reaches the live ask gate) = phase 35. After that the card closes.
