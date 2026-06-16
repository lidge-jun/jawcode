# P1.5.2 B-stage implementation summary

## Changed files

- `packages/coding-agent/src/session/blob-store.ts`
  - Added fail-closed resident image resolvers `resolveResidentImageDataUrlSync()` and `resolveResidentImageDataSync()`.
  - Added `MemoryBlobStore.clear()` for lifecycle reset parity with `EphemeralBlobStore.clear()`.
- `packages/coding-agent/src/session/session-manager.ts`
  - Split resident ownership into text/image stores.
  - Persistent sessions use temp-backed `EphemeralBlobStore` for resident text and durable `#blobStore` for resident images.
  - In-memory sessions use memory-backed resident stores.
  - Migrated resident prepare/materialize helpers and all resident callsites to `{ text, image }` stores plus session context.
  - Resident image sentinel materialization now throws `ResidentBlobMissingError`; durable persisted image load keeps non-throwing compatibility.
  - Added resident lifecycle reset/re-externalize paths for load, new session, restore, fork, move, branch, forkFrom, close, rewrite, persist, and readers.
  - Added detached JSON-semantic snapshot cloning and optional model-change provenance fields.
- `packages/coding-agent/test/session-resident-cache.test.ts`
- `packages/coding-agent/test/session-resident-lifecycle.test.ts`
- `packages/coding-agent/test/session-resident-ownership.test.ts`
- `packages/coding-agent/test/resident-materialization.test.ts`
- `devlog/_plan/260614_performance/53_p1_5_2_resident_cache_plan.md`
  - Updated during B to match the implemented capture/restore contract: `captureState()` keeps bounded detached resident sentinels; `restoreState()` materializes before reset/re-externalization.

## Verification run in B

```bash
bun test packages/coding-agent/test/session-resident-cache.test.ts packages/coding-agent/test/session-resident-lifecycle.test.ts packages/coding-agent/test/session-resident-ownership.test.ts packages/coding-agent/test/resident-materialization.test.ts packages/coding-agent/test/session-manager/resident-retention.test.ts
# 25 pass / 157 expect() calls

bun biome check packages/coding-agent/src/session/blob-store.ts packages/coding-agent/src/session/session-manager.ts packages/coding-agent/test/session-resident-cache.test.ts packages/coding-agent/test/session-resident-lifecycle.test.ts packages/coding-agent/test/session-resident-ownership.test.ts packages/coding-agent/test/resident-materialization.test.ts packages/coding-agent/test/session-manager/resident-retention.test.ts devlog/_plan/260614_performance/53_p1_5_2_resident_cache_plan.md
# OK

bun --cwd=packages/coding-agent run check
# biome check . PASS; tsgo -p tsconfig.json --noEmit PASS
```

## Residual notes

- Oversized text remains safely truncated after process-close/reopen because text residents are temp-backed by design. Durable image blobs continue to materialize after reopen.
- No build-session context cache was introduced; reader/context freshness remains on-demand materialization.
