# WP6 — 20.021 v2 streaming integrity (partial-json leakage) — IMPORT

> Goal `f8909338-255` WP6. Card `struct_har/chase/20.021_omp_chase_v2_streaming_integrity.md` (Tier ①, Decision A = IMPORT).
> Source: OMP `0fc6d136..ca9f2847e`. 1:1 port ❌ — JWC-native redesign.
> **A-phase audit (Turing gpt-5.4): FAIL on Map-only approach → plan corrected to scrub-only. See "Audit correction".**

## Gap (ground truth, file:line)

JWC `packages/agent/src/proxy.ts` stores streaming `partialJson` on the typed
`ToolCall` block:

- `proxy.ts:279-280` — `toolcall_start` seeds `partialJson: ""`.
- `proxy.ts:286-287` — `toolcall_delta` accumulates `(content as any).partialJson` and parses it.
- `proxy.ts:302` — `toolcall_end` does `delete (content as any).partialJson` (happy-path cleanup only).
- `proxy.ts:176-181` — the `catch` (error/abort) block pushes `partial` as the `error` event **with no partialJson cleanup**.

When a stream ends without `toolcall_end` (abort/error/early termination), the
non-spec `partialJson` string survives on the final/error `AssistantMessage`
tool-call block, so the finalized message reads as still-streaming and corrupts
downstream serialization/replay. JWC has **no** scrub and **no** proxy
partial-json tests.

## Audit correction (why scrub-only, not Map/symbol)

A-phase auditor (Turing) confirmed the leakage gap is real (PASS) but **blocked**
the original Map-only design: JWC `packages/coding-agent` has live consumers that
read `content.partialJson` OFF THE BLOCK mid-stream via `"partialJson" in content`:

- `packages/coding-agent/src/modes/controllers/event-controller.ts:475`
- `packages/coding-agent/src/modes/utils/ui-helpers.ts:474`
- `packages/coding-agent/src/modes/utils/session-transcript-replay.ts:413`

These convert block `partialJson` → `__partialJson` for streaming tool previews
(e.g. Bash inline env). A side-channel `Map` (OMP `9c795f886`) or a symbol carrier
(OMP `357c29224`) would remove the carrier these readers depend on — a regression.
OMP solved that by migrating all readers to symbol accessors; in JWC that is a
cross-package refactor of 3 consumer sites + tool-execution dedup logic.

Therefore the JWC-native IMPORT = **keep the string-key block carrier (consumers
unchanged) and scrub it at terminal points** so it never leaks into the finalized
message. This is the essence of OMP `cfa0cd84b`.

## Source mapping (5 OMP commits → triage, corrected)

| OMP commit | what it does | WP6 verdict |
|---|---|---|
| `cfa0cd84b` | scrub partialJson at terminal (error/done); finalize errorMessage before scrub | **IMPORT (adapt)** — JWC `scrubPartialJson` deleting the string-key field, called on the error/abort path before pushing the error event |
| `9c795f886` | side-channel `Map<number,string>`; drop 4 `as any` | **DEFER** — would remove the block carrier JWC consumers read mid-stream. ③ backlog (needs consumer migration). |
| `357c29224` | symbol-based streaming state + `block-symbols` util + migrate ALL providers + all consumers | **DEFER** — cross-package consumer refactor; JWC has no isolated requirement once scrub closes the leak. ③ backlog. |
| `08e1ea727` | provider-native replay reuse of remote compaction | **DEFER** — JWC already owns remote compaction (`compaction/openai.ts`, `compaction.ts`, `remote-compaction.test.ts`); not a leakage gap. ③ backlog. |
| `102d6d54a` | 704-line `compaction-v2-streaming.ts` + models.json + settings | **DEFER** — large feature; JWC remote-compaction present; out of "small & safe" scope. ③ backlog. |

## Design (diff-level, JWC-native) — WP6-A scrub-only

`packages/agent/src/proxy.ts`:

1. Add a private helper after `streamProxy`:
   ```ts
   /**
    * Delete the streaming `partialJson` field from any tool-call blocks that
    * still carry it (e.g. when the stream ended without a `toolcall_end` on
    * abort/error), so the finalized AssistantMessage never reads as still-streaming.
    */
   function scrubPartialJson(partial: AssistantMessage): void {
       for (const block of partial.content) {
           if (block?.type === "toolCall") delete (block as { partialJson?: string }).partialJson;
       }
   }
   ```
2. In the `catch` block, call `scrubPartialJson(partial)` AFTER setting
   `partial.stopReason`/`partial.errorMessage` and BEFORE `stream.push({ type: "error", ... })`
   (mirrors `cfa0cd84b` ordering so the error message is finalized before scrub).
3. Leave the happy-path `toolcall_end` delete (`proxy.ts:302`) intact — it already
   scrubs on normal per-tool completion. The new scrub covers the
   no-`toolcall_end` terminal paths.
4. Streaming-time consumers and `content.arguments` live parsing are unchanged.

No consumer migration, no Map, no symbol, no `as any` removal (the field stays a
real string-key carrier the renderers read).

## Invariants

- The finalized/error `AssistantMessage` never carries `partialJson` on any
  tool-call block.
- During streaming, `"partialJson" in content` remains true for in-progress tool
  calls so `coding-agent` preview consumers keep working.
- `content.arguments` still updates live from accumulated partial JSON.

## Acceptance

| # | criterion | evidence |
|---|---|---|
| 1 | partialJson absent on final block after normal completion | new test |
| 2 | partialJson absent on error-event block when toolcall_end skipped (stream error mid-tool) | new test |
| 3 | partialJson present DURING streaming (consumer contract preserved) | new test |
| 4 | arguments parse correctly from streamed deltas | new test |
| 5 | agent tsgo exit 0, biome clean, focused tests pass | command output |

## Verification

```bash
bun test packages/agent/test/proxy-toolcall-partial-json.test.ts
cd packages/agent && bun run check:types   # exit 0
bunx biome check --write packages/agent/src/proxy.ts packages/agent/test/proxy-toolcall-partial-json.test.ts
git diff --check
grep -n "scrubPartialJson" packages/agent/src/proxy.ts   # defined + called in catch
```

## PABCD

- P: this doc (corrected after A-phase FAIL).
- A: Turing (gpt-5.4) FAIL on Map-only → corrected to scrub-only (non-breaking).
- B: implement WP6-A scrub + new test file.
- C: tsgo + focused tests + biome + naming + diff --check.
- D: attest, close card 20.021 → _fin/20/, update 6 indexes.

## Depends / feeds

- Feeds: 20.025 (compaction/snapcompact) may revisit deferred 102d6d54a/08e1ea727.
- Cross-link: GJC 10.055 (codex replay stability) — closed in _fin/10/.
- ③ backlog: Map/symbol carrier migration (9c795f886 + 357c29224) — needs coding-agent consumer update.
