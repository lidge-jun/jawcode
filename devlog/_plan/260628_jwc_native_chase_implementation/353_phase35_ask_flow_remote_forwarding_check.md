# 353 Phase 35 check — ask-flow remote forwarding verification

> All gates green; `10.028` done-gates fully met.

## Tests
- `notifications-ask-bridge.test.ts` → 3 pass (race semantics).
- `notifications-server.test.ts` → onRemoteResolved test pass (8 total in file).
- `tools/ask.test.ts` → remote-bridge integration 2 pass; existing ask tests unaffected.
- Full regression `bun test test/notifications-*.test.ts test/notify-cli.test.ts test/tools/ask.test.ts`
  → **104 pass / 0 fail / 416 expect()** across 15 files.

## Static analysis
- `bun run check:types` (`tsgo --noEmit`) → exit 0 (covers ask.ts, sdk.ts, server.ts, ask-bridge.ts,
  tools/index.ts).
- `bunx biome check` on all 9 changed files → clean (3 auto-formatted).
- `git diff --check` → exit 0.

## 10.028 done-gate — ALL MET
| Gate | Evidence |
|---|---|
| protocol + loopback server module | `server.ts` (phase 33) |
| `.jwc/state/notifications` discovery, masked/no-log token | phase 33 + lifecycle (phase 34) |
| missing/wrong token rejected at connect | phase 33 test |
| `action_needed` answered remotely → `action_resolved` | ask-bridge + server (phase 35 tests) |
| local answer wins race; later remote rejected | registry + bridge (phase 35 + 33 tests) |
| discovery removed on session shutdown | session-lifecycle stop cleanup (phase 34) |

→ Card `10.028` closes to `_fin/10`.
