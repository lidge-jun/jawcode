# P1.5.2 resident cache lifecycle/manual session-manager merge plan

Date: 2026-06-15
Phase: PABCD P-stage plan for the final P1.5 upstream Optimization Suite v3 lane.

## 1. Objective

Complete P1.5.2 without replacing `session-manager.ts` wholesale. Preserve the already-landed P1.5.1 input render priority patch and the completed P1.5.5/P1.5.4/P1.5.3 lanes. The implementation must make resident session blobs fail-closed, bounded for persistent sessions, and safe across reload/fork/branch/move/state-restore paths.

## 2. Current-state facts from local inspection

- `packages/coding-agent/src/session/blob-store.ts` already contains `EphemeralBlobStore` and `ResidentBlobMissingError`, but only `resolveTextBlobSync()` throws `ResidentBlobMissingError` on missing resident data.
- `packages/coding-agent/src/session/session-manager.ts` already externalizes large resident text/image/provider image URL values into a resident sentinel and materializes readers through `materializeResidentEntrySync()`.
- `session-manager.ts` currently uses a single `MemoryBlobStore` as `#residentBlobStore` for all resident kinds, including persistent sessions. That pins the resident bytes in process memory after loading or appending large history.
- The current reader materialization path calls `resolveImageDataUrlSync()` / `resolveImageDataSync()` for resident image sentinels. Those functions are persistence-oriented and return the unresolved `blob:sha256:` ref when missing, so resident images fail open.
- Existing coverage lives in `packages/coding-agent/test/session-manager/resident-retention.test.ts`; the parent verification matrix names the missing upstream-style suite as `session-resident-cache`, `session-resident-lifecycle`, `session-resident-ownership`, and `resident-materialization` coverage.

## 3. Non-goals and invariants

- Do not replace `packages/coding-agent/src/session/session-manager.ts` wholesale.
- Do not change P1.5.1 TUI render priority files/tests.
- Do not change P1.5.3 pruning, P1.5.4 diff/secrets, or P1.5.5 profiling code except documentation status rows if needed.
- Preserve the existing compaction `searchStart` hydration clamp and all session persistence hardening.
- Preserve persisted JSONL compatibility: persisted `blob:sha256:` image references still use the global durable `BlobStore` and continue to resolve via the existing non-throwing persistence resolvers during load.
- Resident sentinels are runtime/cache internals. If a resident blob is missing while materializing a reader, throw `ResidentBlobMissingError`; do not return raw `blob:sha256:` refs to providers.

## 4. File-level change plan
### 4.0 Implementation order

1. Add fail-closed resident image resolvers in `blob-store.ts`. Do not change `session-manager.ts` sentinel materialization until those exports exist.
2. Switch only resident sentinel materialization to the fail-closed resident resolvers. Durable persisted blob migration must keep using the existing non-throwing resolvers.
3. Migrate every prepare/materialize helper and callsite from the single-store signature to `{ text, image }` stores plus session context in the same patch as the store split; do not land split ownership while any `#residentBlobStore` callsite remains.
4. Port resident-store ownership: persistent text residents use a temp-backed `EphemeralBlobStore`; persistent image residents use the durable `#blobStore`; in-memory sessions use memory-backed stores. This matches the upstream ownership model while preserving local historical image blob behavior.
5. Add lifecycle reset/re-externalize helpers and wire them through file/session transition paths.
6. Add detached snapshot/restore cloning. Do not introduce a build-session context cache in this slice; context freshness is preserved by on-demand materialization.
7. Add optional model-change provenance after resident plumbing is green; keep it metadata-only and backward compatible.


### 4.1 MODIFY `packages/coding-agent/src/session/blob-store.ts`

Add fail-closed resident image resolvers beside `resolveTextBlobSync()`:

```ts
export function resolveResidentImageDataUrlSync(
  blobStore: BlobStore,
  data: string,
  context?: { kind?: "imageUrl"; sessionId?: string; sessionFile?: string },
): string
```

Behavior:
- If `data` is not a blob ref, return it unchanged.
- If the resident blob is present, return `buffer.toString("utf8")`.
- If missing, throw `new ResidentBlobMissingError(hash, context?.kind ?? "imageUrl", context?.sessionId, context?.sessionFile)`.

```ts
export function resolveResidentImageDataSync(
  blobStore: BlobStore,
  data: string,
  context?: { kind?: "imageData"; sessionId?: string; sessionFile?: string },
): string
```

Behavior:
- If `data` is not a blob ref, return it unchanged.
- If present, return `buffer.toString("base64")`.
- If missing, throw `ResidentBlobMissingError` with `kind` defaulting to `"imageData"`.

Keep the existing `resolveImageDataUrlSync()` and `resolveImageDataSync()` semantics unchanged for durable persisted blobs.

### 4.2 MODIFY `packages/coding-agent/src/session/session-manager.ts`

Imports:
- Add `EphemeralBlobStore`, `resolveResidentImageDataSync`, and `resolveResidentImageDataUrlSync` from `./blob-store`.
- Keep `resolveImageDataSync` / `resolveImageDataUrlSync` for persisted durable blob migration.

Resident store ownership:
- Replace the single `readonly #residentBlobStore = new MemoryBlobStore();` with upstream-aligned split ownership:
  - Persistent sessions: text residents use an `EphemeralBlobStore` rooted under a unique temp/cache dir; image residents alias the durable `#blobStore` so existing image blob writes, persisted image refs, and historical load paths stay compatible.
  - In-memory sessions: text and image residents use `MemoryBlobStore` instances; `#blobStore` remains backed by the in-memory image store so `putBlob()` and historical blob-ref tests stay in-memory.
- Keep the durable `#blobStore` pointing at `new BlobStore(getBlobsDir())` for persistent sessions.
- Add small private helpers mirroring the upstream template rather than inventing divergent lifecycle APIs:
  - `#resetResidentTextBlobStore(): void`
  - `#disposeResidentTextBlobStore(): void`
  - `#reexternalizeFileEntriesForResidentStore(): void`
  - `#residentStores()` returns `{ text, image }` for helper calls.
  - No `#bumpAllRevisions()` or context-cache revision fields are added in this slice because jawcode currently materializes readers on demand and has no local `cloneSessionContext()` cache to invalidate.

Resident externalization/materialization:
- Change `externalizeResidentValueSync()` / `prepareEntryForResidentSync()` to accept `{ text: BlobStore; image: BlobStore }` instead of a single store.
- Text sentinel writes use the text resident store.
- `image_url` sentinel and image block `data` sentinel writes use the image resident store.
- Change `materializeResidentValueSync()` / `materializeResidentEntrySync()` / `materializeResidentEntriesSync()` to accept resident stores plus `{ sessionId, sessionFile }` context.
- For sentinel materialization:
  - `kind === "imageUrl"` uses `resolveResidentImageDataUrlSync(stores.image, ref, context)`.
  - `kind === "imageData"` uses `resolveResidentImageDataSync(stores.image, ref, context)`.
  - `kind === "text"` uses `resolveTextBlobSync(stores.text, ref, context)`.
- Keep the materialization cache key kind-qualified (`${kind}:${ref}`) so identical bytes can materialize as both UTF-8 text and base64 image data.

Callsite migration checklist:
| Current callsite | Required migration |
|---|---|
| `setSessionFile()` load path | Reset text resident store, resolve durable blob refs, prepare loaded entries into current resident stores, rebuild index. |
| `#newSessionSync()` | Reset resident stores before replacing entries. |
| `captureState()` | JSON-semantic clone resident entries while keeping resident sentinels bounded and detached from live entry objects. |
| `restoreState()` | Materialize the cloned snapshot through the current stores before resetting, then prepare the materialized entries into current resident stores and rebuild the index. |
| `fork()` | Materialize resident-backed entries before header replacement/rewrite; re-externalize after the new session is active. |
| `moveTo()` | Preserve materialized entries across path move and rewrite; keep durable image store semantics unchanged. |
| `_persist()` hot/cold paths | Materialize with current stores before durable persistence; append only persisted/truncated entries to disk. |
| `#appendEntry()` / `updateResidentMessages()` | Prepare into current resident stores after helper signature migration. |
| Reader APIs (`getEntry`, `getEntries`, `getBranch`, `getChildren`, `getLeafEntry`, `buildSessionContext`) | Materialize with current stores and session context; never expose sentinels. |
| `createBranchedSession()` / in-memory branch path | Materialize branch entries before writing, then prepare active branch entries into current resident stores. |
| `forkFrom()` | Resolve durable blobs, prepare source history into resident stores, then rewrite the new fork with re-externalized residents. |


Lifecycle/reset paths:
- Before replacing `#fileEntries` with unrelated session data (`setSessionFile()`, `#newSessionSync()`, `restoreState()`), reset resident stores so stale residents cannot satisfy a new session.
- In paths that preserve resident-backed entries but rewrite a new file/session (`fork()`, `moveTo()`, `createBranchedSession()`, `forkFrom()`), materialize the source entries before writing, then re-externalize them into the current resident stores for the new active session.
- In `close()`, after the writer is closed, dispose resident stores for persistent sessions so temp dirs are not leaked.
- Preserve `#needsFullRewriteOnNextPersist`, `#flushed`, `#ensuredOnDisk`, artifact manager invalidation, breadcrumbs, and the current writer-close ordering.

State cloning/context discipline:
- Introduce a local `cloneJsonSemantic<T>(value: T): T` helper using `JSON.parse(JSON.stringify(value))` for session-entry-shaped data. Use it only where session snapshots or context arrays need a detached JSON-safe copy.
- Update `captureState()` to snapshot `fileEntries` as detached JSON-semantic clones that keep resident sentinels bounded; do not materialize full resident payloads into captured state.
- Update `restoreState()` to materialize the cloned snapshot with the still-owned resident stores before resetting, then prepare the materialized entries for the current resident stores and rebuild indexes. This prevents stale object aliasing while preserving rollback of resident-backed snapshots.
- Jawcode has no local `cloneSessionContext()` function and this slice must not add a build-session context cache. The upstream `cloneSessionContext`/cache-discipline requirement maps locally to `buildSessionContext()` and reader APIs materializing from current resident stores on demand, plus sentinel-free context tests after append/restore/open.

Model-change provenance:
- Extend `ModelChangeEntry` with optional metadata fields while preserving old JSONL readers:
  - `previousModel?: string`
  - `reason?: string`
  - `thinkingLevel?: string | null`
- Extend `appendModelChange(model, role?)` to accept an optional third metadata object `{ previousModel?: string; reason?: string; thinkingLevel?: string | null }`.
- Do not require all callsites to pass metadata in this lane. Add coverage that old entries still load and new optional metadata is preserved when provided.

### 4.3 ADD `packages/coding-agent/test/session-resident-cache.test.ts`

Coverage:
- Persistent `SessionManager.create()` with large text/image/provider image payload keeps `captureState().fileEntries` bounded.
- Reader APIs (`getEntry()`, `getEntries()`, `getBranch()`, `getChildren()`, `getLeafEntry()`, `buildSessionContext()`) materialize full data.
- Durable JSONL contains blob refs / truncation where expected and does not leak full resident image/provider URL content.
- Same-byte text/image payloads materialize independently as UTF-8 text and base64 image.

### 4.4 ADD `packages/coding-agent/test/session-resident-lifecycle.test.ts`

Coverage:
- `buildSessionContext()` compaction clamp regression: create two compaction entries where the later compaction has a stale `firstKeptEntryId` from before the previous compaction, then assert context hydration starts only after the previous compaction and does not rehydrate old messages.
- `newSession()` clears old resident text data; old resident sentinels cannot be materialized through a new session.
- `setSessionFile()` / `open()` reset and repopulate resident stores for the selected file.
- Session resume smoke: create a persisted resident-heavy session, close it, reopen it with `SessionManager.open()`, and assert durable image residents materialize, persisted oversized text remains safely truncated, and `captureState().fileEntries` remains bounded.
- `fork()` and `createBranchedSession()` re-externalize resident entries for the new session file without leaking full large content into resident state.
- `moveTo()` preserves materialized content while rewriting the moved session file.
- `close()` disposes/removes persistent resident text temp cache dirs; image residents remain durable blob-store owned.

### 4.5 ADD `packages/coding-agent/test/session-resident-ownership.test.ts`

Coverage:
- Manually captured resident snapshots throw `ResidentBlobMissingError` after their owning resident store is reset/restored into a different session context.
- Missing resident `imageData` and `imageUrl` sentinels fail closed with `ResidentBlobMissingError` and include `kind` plus session context.
- Durable persisted image blob refs still use non-throwing load-time resolution for historical JSONL compatibility.

### 4.6 ADD `packages/coding-agent/test/resident-materialization.test.ts`

Coverage:
- Build-session context and reader materialization never expose `__gjcResidentBlob` sentinels.
- Optional model-change provenance persists and reloads without affecting current model selection semantics.
- Snapshot/restore uses detached JSON-semantic entries: mutating a restored session entry does not mutate the captured snapshot or another session manager.

Test ownership:
- Keep existing broad regression fixtures in `packages/coding-agent/test/session-manager/resident-retention.test.ts`.
- New root-level `session-resident-*.test.ts` files cover one concern each: cache bounding, lifecycle reset/re-externalize, ownership/fail-closed errors.
- `resident-materialization.test.ts` covers sentinel-free reader/context output, snapshot detachment, and model metadata compatibility.
- Do not duplicate the long fixture assertions across every file; share local helper builders within each test file only when that keeps failures readable.


### 4.7 MODIFY docs/plan status only if implementation diverges

- Update `devlog/_plan/260614_performance/23_p1_5_upstream_v3_merge_plan.md` only if the B-stage implementation proves any status row inaccurate.
- Add B/C/D receipts under the same `devlog/_plan/260614_performance/` sequence after this plan.

## 5. Verification plan

Focused tests:

```bash
bun test \
  packages/coding-agent/test/session-resident-cache.test.ts \
  packages/coding-agent/test/session-resident-lifecycle.test.ts \
  packages/coding-agent/test/session-resident-ownership.test.ts \
  packages/coding-agent/test/resident-materialization.test.ts \
  packages/coding-agent/test/session-manager/resident-retention.test.ts
```

Focused formatter/lint:

```bash
bun biome check \
  packages/coding-agent/src/session/blob-store.ts \
  packages/coding-agent/src/session/session-manager.ts \
  packages/coding-agent/test/session-resident-cache.test.ts \
  packages/coding-agent/test/session-resident-lifecycle.test.ts \
  packages/coding-agent/test/session-resident-ownership.test.ts \
  packages/coding-agent/test/resident-materialization.test.ts \
  packages/coding-agent/test/session-manager/resident-retention.test.ts \
  devlog/_plan/260614_performance/53_p1_5_2_resident_cache_plan.md
```

Session resume smoke is covered by `packages/coding-agent/test/session-resident-lifecycle.test.ts` in the focused test command above; no separate E2E API-key smoke is required for this lane.

Package gate:

```bash
bun --cwd=packages/coding-agent run check
```

C-stage gate after B verification:

```bash
bun run check
```

## 6. Acceptance criteria

- Persistent resident text sessions no longer pin all resident text bytes in a process-wide `MemoryBlobStore`; text residents use temp-backed `EphemeralBlobStore` ownership and close-time cleanup is directly tested.
- Persistent resident images remain durable-blob-store owned, while resident image sentinel materialization is kind-correct and fail-closed when cache/blob data is missing.
- Session lifecycle transitions reset or re-externalize resident stores deliberately; stale stores cannot satisfy unrelated sessions.
- `buildSessionContext()` preserves the existing compaction hydration clamp and does not rehydrate stale pre-compaction messages.
- `buildSessionContext()` and reader APIs materialize on demand from current resident stores and never expose `__gjcResidentBlob` sentinels after append/restore/open.
- Snapshot/restore and optional model-change metadata are covered without regressing legacy JSONL compatibility.
- Existing resident-retention coverage and all new P1.5.2 tests pass, including the `SessionManager.open()` resident resume smoke in `session-resident-lifecycle.test.ts`.
- `bun --cwd=packages/coding-agent run check` and final C-stage `bun run check` pass before D closure.
