DONE

Read-only P1.5.2 B-stage verification completed by inspection only.

- `blob-store.ts` implements fail-closed resident image resolvers: `resolveResidentImageDataUrlSync()` and `resolveResidentImageDataSync()` throw `ResidentBlobMissingError` on missing resident blobs, while durable persisted image resolvers remain non-throwing. `MemoryBlobStore.clear()` and `EphemeralBlobStore.clear()/dispose()` support lifecycle reset/cleanup.
- `session-manager.ts` splits resident stores into `{ text, image }`: persistent sessions use temp-backed `EphemeralBlobStore` for resident text and durable `#blobStore` for resident images; in-memory sessions use `MemoryBlobStore` for both resident text/image ownership.
- Resident materialization/externalization paths use the split stores and context-aware fail-closed materialization for text, image URL, and image data sentinels.
- Lifecycle reset/re-externalize paths are present for restore/load/new session, fork/branch/move-style transitions, full rewrite/persist, close/dispose, append/update, and reader APIs.
- `captureState()` returns a detached JSON-semantic snapshot with resident sentinels still bounded; `restoreState()` materializes the snapshot before resetting and re-externalizing into the current resident stores.
- Optional model-change metadata is implemented on `ModelChangeEntry` and `appendModelChange()` (`previousModel`, `reason`, `thinkingLevel`) without changing current model semantics.
- Focused tests cover the required surfaces:
  - `session-resident-cache.test.ts`: bounded resident state, reader/context materialization, split text/image handling for identical bytes.
  - `session-resident-lifecycle.test.ts`: reopen behavior, durable image materialization, temp text cleanup, compaction clamp preservation, fork/branch re-externalization.
  - `session-resident-ownership.test.ts`: fail-closed resident image errors, durable persisted missing image compatibility, restore snapshot aliasing.
  - `resident-materialization.test.ts`: no sentinel leakage through readers/context, optional model-change provenance, detached JSON-semantic snapshots.
- `60_p1_5_2_b_summary.md` records sufficient B-stage evidence: focused resident tests passed (25 pass / 157 expects), focused biome OK, and package check passed.

No files were edited by verifier. No tests, lint, formatters, typecheck, package-wide gates, or project-wide commands were run by verifier.
