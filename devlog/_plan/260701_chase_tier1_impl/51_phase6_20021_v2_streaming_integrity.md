# WP6 — 20.021 v2 streaming integrity (partial-json leakage) — IMPORT

> Goal `f8909338-255` WP6. Card `struct_har/chase/20.021_omp_chase_v2_streaming_integrity.md` (Tier ①, Decision A = IMPORT).
> Source: OMP `0fc6d136..ca9f2847e`. 1:1 port ❌ — JWC-native redesign.

## Gap (ground truth, file:line)

JWC `packages/agent/src/proxy.ts` stores streaming `partialJson` directly on the
typed `ToolCall` object via `as any` casts:

- `proxy.ts:279-280` — `toolcall_start` seeds `partialJson: ""` on the block (`satisfies ToolCall & { partialJson: string } as ToolCall`).
- `proxy.ts:286-287` — `toolcall_delta` does `(content as any).partialJson += delta` then parses it.
- `proxy.ts:302` — `toolcall_end` does `delete (content as any).partialJson`.
- `proxy.ts:175-186` — the `catch` block pushes `partial` as the `error` event **with no partialJson cleanup**.

When a stream ends without `toolcall_end` (abort/error/early done), the non-spec
`partialJson` string survives on the final `AssistantMessage` tool-call block,
corrupting downstream serialization and replay. JWC has **no** `scrubPartialJson`
and **no** proxy partial-json tests.

## Source mapping (5 OMP commits → triage)

| OMP commit | what it does | WP6 verdict |
|---|---|---|
| `9c795f886` | side-channel `Map<number,string>` keyed by contentIndex; drop 4 `as any`; 4 contract tests | **IMPORT** (core) |
| `cfa0cd84b` | scrub partialJson on error/done; finalize errorMessage before scrub | **IMPORT (adapt)** — add JWC `scrubPartialJson` + correct ordering |
| `357c29224` | symbol-based streaming state + `block-symbols` util + migrate ALL providers | **DEFER** — symbol carrier exists for OMP renderers that read partialJson mid-stream; JWC has no such requirement. Side-channel Map already removes leakage. Large cross-provider refactor = ③ backlog. |
| `08e1ea727` | provider-native replay reuse of remote compaction across models | **DEFER** — JWC already owns remote compaction (`compaction/openai.ts`, `compaction.ts`, `remote-compaction.test.ts`) with its own design; not a leakage gap. ③ backlog. |
| `102d6d54a` | 704-line `compaction-v2-streaming.ts` + models.json + settings schema | **DEFER** — large new feature, JWC remote-compaction already present; out of "small & safe" IMPORT scope. ③ backlog. |

## Design (diff-level, JWC-native)

Single slice WP6-A — eliminate partial-json leakage via a side-channel Map.

`packages/agent/src/proxy.ts`:

1. In `streamProxy`, allocate `const partialJsonByIndex = new Map<number, string>();`
   before the SSE loop, and thread it into `processProxyEvent(model, event, partial, partialJsonByIndex)`.
2. `processProxyEvent` signature gains `partialJsonByIndex: Map<number, string>`.
3. `toolcall_start`: drop `partialJson: ""`; emit clean `satisfies ToolCall`; `partialJsonByIndex.set(contentIndex, "")`.
4. `toolcall_delta`: `const acc = (partialJsonByIndex.get(contentIndex) ?? "") + delta; partialJsonByIndex.set(contentIndex, acc); content.arguments = parseStreamingJson(acc) || {};`.
5. `toolcall_end`: `partialJsonByIndex.delete(contentIndex)` (no more `delete (content as any)`).
6. Because the Map is the ONLY store, no field is ever written to the typed
   block → no scrub needed for the happy path. For defense-in-depth on
   error/abort, the Map is local to the async IIFE and is GC'd when the stream
   ends; the typed block is already clean. (We do NOT port `scrubPartialJson`
   because there is nothing on the block to scrub once the side-channel Map is
   the sole carrier — this is the JWC-native simplification of cfa0cd84b.)

All `as any` casts on partialJson are removed.

## Invariants

- The typed `ToolCall` block never carries a non-spec `partialJson` field at any
  point (start/delta/end/error).
- `content.arguments` still updates live from accumulated partial JSON during
  streaming (renderer behavior unchanged).
- Multiple concurrent tool calls (distinct contentIndex) accumulate independently.

## Acceptance

| # | criterion | evidence |
|---|---|---|
| 1 | partialJson never on final block (normal completion) | new test |
| 2 | partialJson never on final block when toolcall_end skipped (stream error) | new test |
| 3 | arguments parse correctly from streamed deltas | new test |
| 4 | concurrent interleaved tool calls isolate state | new test |
| 5 | no `as any` partialJson casts remain | grep |
| 6 | agent tsgo exit 0, biome clean, focused tests pass | command output |

## Verification

```bash
bun test packages/agent/test/proxy-toolcall-partial-json.test.ts
cd packages/agent && bun run check:types   # exit 0
bunx biome check --write packages/agent/src/proxy.ts packages/agent/test/proxy-toolcall-partial-json.test.ts
git diff --check
grep -n "as any).partialJson\|partialJson: string" packages/agent/src/proxy.ts   # expect 0
```

## PABCD

- P: this doc.
- A: independent explorer (gpt-5.4) — confirm leakage gap real, Map approach correct, no JWC regression, symbol/compaction defer justified.
- B: implement WP6-A in proxy.ts + new test file (adapt OMP's 4 contract tests to JWC types/imports).
- C: tsgo + focused tests + biome + naming + diff --check.
- D: attest, close card 20.021 → _fin/20/, update 6 indexes.

## Depends / feeds

- Feeds: 20.025 (compaction/snapcompact) may revisit the deferred 102d6d54a v2-streaming compaction.
- Cross-link: GJC 10.055 (codex replay stability) — already closed in _fin/10/.
