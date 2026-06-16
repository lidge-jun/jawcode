FAIL

## Summary

P1.5.2 implementation in `blob-store.ts` and `session-manager.ts` matches the plan: split `{ text, image }` resident stores, fail-closed resident image resolvers, lifecycle reset/re-externalize on the documented paths, `captureState()` bounded sentinels, and `restoreState()` materialize-then-reset-then-re-externalize. Recorded B evidence (`bun run check`, 25 focused tests) is credible for what was run. C acceptance fails because several plan §4.4–4.5 / §6 acceptance criteria are not covered by the new focused suite; gaps are verification contract holes, not proven runtime bugs.

## Findings (blocking for C)

### C-P152-1 — HIGH — `newSession()` resident isolation untested

Plan §4.4 requires `newSession()` clears old resident text data; no focused test calls `SessionManager.newSession()` with prior large resident payload.

Fix constraint: add a focused test proving `newSession()` resets old resident entries and stale captured entries fail closed after reset.

### C-P152-2 — HIGH — `moveTo()` resident lifecycle untested

Plan §4.4 requires `moveTo()` preserves materialized content while rewriting the moved session file; no focused test calls `moveTo`.

Fix constraint: add a focused lifecycle case with large resident entry, `await session.moveTo(newCwd)`, materialized reader content, and bounded state.

### C-P152-3 — MEDIUM — `setSessionFile()` resident reset untested

Plan §4.4 requires `setSessionFile()` / `open()` reset and repopulate resident stores. Reopen is covered, direct switching between two files is not.

Fix constraint: add a two-file `MemorySessionStorage` test switching files via `setSessionFile` with distinct large payloads.

### C-P152-4 — MEDIUM — snapshot after store reset/different session partially covered

Current snapshot test proves detachment with live store still owning bytes, but not the organic captured snapshot after reset/different-session failure mode.

Fix constraint: extend the `newSession()` test to capture after append, transition through reset, and assert `ResidentBlobMissingError` with kind/session context on old sentinel-backed entry.

## Route decision

Route to B. Root cause is an implementation/test coverage gap in the B-stage focused suite, not a bad plan or ambiguous spec. The code path likely already exists; the required fix is adding focused tests that lock the plan acceptance criteria and rerunning the focused gates.
