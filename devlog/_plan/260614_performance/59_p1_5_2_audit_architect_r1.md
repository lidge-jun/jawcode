PASS

[LOW] ARCH-A1 `57_p1_5_2_audit_synthesis_r0.md:28` / `53_p1_5_2_resident_cache_plan.md:31-37,44-46` — Handled. §4.0 orders resolver exports in `blob-store.ts` before any sentinel switch; §4.2 keeps durable load on `resolveImageDataUrlSync` / `resolveImageDataSync` (`session-manager.ts:1296-1305` still uses those today). B-stage constraint: do not merge step 2 until `resolveResidentImageDataUrlSync` / `resolveResidentImageDataSync` exist (they are absent in `blob-store.ts` now).

[LOW] ARCH-A2 `57_p1_5_2_audit_synthesis_r0.md:29` / `53_p1_5_2_resident_cache_plan.md:46-48,99-124` — Handled. Single-patch helper + callsite migration is explicit; table covers persist/reader/fork paths. Residual: grep shows 14 live `#residentBlobStore` / `prepareEntryForResidentSync(..., this.#residentBlobStore)` sites (`2195,3017,3207,3616,3644,3690` plus materialize sites `2688,2702,3007,3007,3317,3337,3348,3398,3452`); checklist row `updateResidentMessages()` has no symbol in jaw — map to the message-update `prepareEntryForResidentSync` block at `session-manager.ts:3207-3210`.

[LOW] ARCH-A3 `57_p1_5_2_audit_synthesis_r0.md:30` / `53_p1_5_2_resident_cache_plan.md:48,84-92` — Handled. §4.0 forbids split ownership while any `#residentBlobStore` callsite remains; `EphemeralBlobStore` is present (`blob-store.ts:98+`). Current ownership is still `readonly #residentBlobStore = new MemoryBlobStore()` and `persist ? BlobStore(getBlobsDir()) : #residentBlobStore` (`session-manager.ts:2111,2119`).

[LOW] ARCH-A4 `57_p1_5_2_audit_synthesis_r0.md:31` / `53_p1_5_2_resident_cache_plan.md:119-124` — Handled. `cloneJsonSemantic` + materialized `captureState` / store-reset `restoreState` are required; no local helper exists yet.

[LOW] ARCH-A5 `57_p1_5_2_audit_synthesis_r0.md:32` / `53_p1_5_2_resident_cache_plan.md:155-181` — Handled as B-stage reminder. Planned four root tests are still missing; `resident-retention.test.ts` remains the only resident suite.

[LOW] ARCH-A6 `57_p1_5_2_audit_synthesis_r0.md:33` / `53_p1_5_2_resident_cache_plan.md:126-131` — Handled. Optional `ModelChangeEntry` fields + third `appendModelChange` arg after plumbing; `appendModelChange(model, role?)` at `session-manager.ts:3115` stays compatible.

[LOW] ARCH-A7 `57_p1_5_2_audit_synthesis_r0.md:34` / `53_p1_5_2_resident_cache_plan.md:183-216` — Handled. Focused `bun test` list, biome paths, and `bun --cwd=packages/coding-agent run check` / `bun run check` match integration surface; compaction clamp target aligns with existing `searchStart` logic (`session-manager.ts:692-704`).

The single point most likely to break first if implemented as written: a partial `session-manager.ts` migration—changing `materializeResidentValueSync` / helper signatures to `{ text, image }` + session context without updating every `#residentBlobStore` callsite in the same commit, or switching image sentinel materialization to resident resolvers before those exports land.
