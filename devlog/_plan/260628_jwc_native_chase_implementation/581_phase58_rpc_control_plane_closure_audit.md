# 581 Phase 58 audit — 10.038 RPC control plane v2 closure (independent)

> Independent read-only sub-agent audit of plan `580`. Verdict: **closeable:true**.

## Confirmed (file:line)
- token-cost fail-closed: `test/unattended-budget-redteam.test.ts:85` (`unsupported_budget_metric`
  refusal without constructing a controller) + `:109` (token/cost/combined breach via `reconcile()`).
  Enforcement `unattended-run-controller.ts:189-191` (unsupported metric throw) + `:307-315` (cost breach).
- listen guard `rpc-mode.ts:699-701`: `if (await isUnixSocketAlive) throw "already in use"` then
  `fs.rm(force)` only when NOT alive → refuses to clobber a live socket, cleans a stale file.
- Python parity: `python/jwc-rpc/tests/{test_registry,test_client_uds,test_client,test_protocol}.py`
  → C no-drift defensible.
- prior phases: `test/rpc-get-state-payload.test.ts` (p20), `test/rpc-fastlane.test.ts` (p27),
  `test/rpc-listen-socket-guard.test.ts` + `test/rpc-listen-platform.test.ts` present.

## Bun 1.3.11 block
The subprocess clobber-refusal test EXISTS in source (`rpc-listen-socket-guard.test.ts:63-87`,
`Bun.spawnSync`) — proving no code gap; it merely cannot run on this machine (needs Bun ≥ 1.3.14).
The in-process `isUnixSocketAlive` unit (missing/live/stale) runs fine. The new
`rpc-listen-startup-guard.test.ts` adds a runtime-version-independent recovery/preservation guard.
Risk **LOW**.

## Verdict
No missing behavior or test gap. All sub-slices have verified evidence. Test-only closure legitimate.
