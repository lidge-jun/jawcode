# WP7 — 20.025 compaction / snapcompact caps + session-branch scoping (IMPORT)

> Card: `struct_har/chase/20.025_omp_chase_compaction_snapcompact_session_scope.md` · Tier ① · Decision A IMPORT.
> Source: OMP `ca9f2847e..b6c9747d4` (v16.2.5→v16.2.9). 1:1 port ❌ — JWC-native redesign.

## Scope decision (6 OMP features → 1 JWC slice)

OMP's 6 behavioral surfaces split into "applies to JWC" vs "OMP-only session architecture":

| OMP feature | OMP anchor | JWC applicability | judgement |
|---|---|---|---|
| bounded edit-tool oldText/newText snapshots | `9e4e0f669` | **JWC has the exact unbounded structure** — `EditToolDetails`/`EditToolPerFileResult` carry full `oldText`/`newText` (replace.ts:1157-1158, patch.ts:1831-1832, edit/index.ts:155-156 aggregator); persisted in tool-result `details`; never sent to LLM; only consumed by ACP event-mapper diff (acp-event-mapper.ts:574-601) | **IMPORT** |
| perFileResults aggregate snapshot budget | `398796949` | Same gap — JWC `aggregateApplyPatchResults`/hashline multi build `perFileResults[]` with per-entry `oldText`/`newText`, no shared cap | **IMPORT** (folded into same slice) |
| snapcompact frame caps (payloads/unknown-window/keep-newest) | `88308f105`/`156dfd846`/`39688620f` | JWC has **no `packages/snapcompact`** package; no snapcompact frame concept | DEFER ③ (no JWC surface) |
| hashline aggregate cap | `c21cb6325` | JWC hashline `execute.ts` does NOT carry oldText/newText in perFileResults (only diff/meta) — no leak | DEFER ③ (no JWC surface) |
| pruned-snapshot marker single-path aggregation | `3ced3a923` | depends on snapcompact aggregation — absent in JWC | DEFER ③ |
| shake-elision auto-compaction recovery | `5b026d304` | OMP snapcompact/shake-elision internal — absent in JWC | DEFER ③ |
| branch-scoped compaction elision / no ctrl-c rewrite | `cc2cf5c7d`/`e8b2c5d05` | JWC has **no `session-loader.ts`** and no supersede-sweep elision architecture (grep: 0 supersede/elision in session layer) | DEFER ③ (OMP-only session-loader arch) |
| mid-run key-identity message matching | `3aa47d2ab` | OMP compaction-by-key — needs separate audit vs JWC append-only (20.009 _fin already covers integrity) | DEFER ③ (covered by 20.009) |

**Net: 1 JWC slice** — bound edit-tool snapshot persistence (`9e4e0f669` + `398796949` aggregate).

## Ground Truth (JWC, file:line)

- `packages/coding-agent/src/edit/renderer.ts:47-86` — `EditToolPerFileResult` / `EditToolDetails` both carry optional `oldText`/`newText` (full pre/post file content).
- `packages/coding-agent/src/edit/modes/replace.ts:1157-1158` — single replace result sets `oldText: rawContent, newText: finalContent`.
- `packages/coding-agent/src/edit/modes/patch.ts:1831-1832` — single patch result sets `oldText, newText`.
- `packages/coding-agent/src/edit/index.ts:155-156` — multi-file aggregator copies `oldText`/`newText` into each `perFileResults` entry, then `details.perFileResults: [...perFileResults]` (191).
- `packages/coding-agent/src/modes/acp/acp-event-mapper.ts:574-601` — sole **runtime** consumer: emits ACP `diff` ToolCallContent from `oldText`/`newText`; returns `undefined` when both absent (graceful degradation). NOTE (A-audit): `test/edit-per-file-diff-content.test.ts` also reads these fields directly — small-edit (≤32KB) pass-through must stay byte-identical so those tests keep passing.
- Persistence: tool-result `details` flow into session entries (`session-manager.ts` appendCustomMessageEntry), so unbounded snapshots bloat per-turn JSONL.

## Design (JWC-native, diff-level)

New file `packages/coding-agent/src/edit/snapshot-details.ts`:
- `MAX_EDIT_SNAPSHOT_TEXT_CHARS = 32_768`.
- `pruneSnapshot<T extends {oldText?;newText?}>(d)`: if `oldText.length + newText.length <= cap` return as-is; else return shallow copy with both omitted.
- `pruneOversizedEditSnapshots(details)`: overload (`EditToolPerFileResult` first, then `EditToolDetails`); prune top-level, then if `perFileResults` present apply `capPerFileSnapshots`.
- `capPerFileSnapshots(entries)`: left-to-right shared budget; per-entry pruneSnapshot first; if surviving bytes bust running aggregate, strip + stamp `snapshotsPruned: true`.
- Add optional `snapshotsPruned?: boolean` to `EditToolPerFileResult` in renderer.ts (JWC-named, additive).

Apply sites (wrap details construction) — **4 sites** (A-audit Euler caught a 4th):
- `replace.ts:~1149` return — wrap `details` in `pruneOversizedEditSnapshots(...)`.
- `patch.ts:~1826` return — wrap `details`.
- `edit/index.ts` `aggregateApplyPatchResults` (multi-file `perFileResults`, return ~185) — wrap final `details` (covers perFileResults aggregate via capPerFileSnapshots).
- `edit/index.ts` `executeSinglePathEntries` (multi-run single-path aggregate, return ~259-272 — sets top-level `oldText: firstOldText` / `newText: lastNewText`) — wrap final `details`. **(added per A-audit)**
- Export from `edit/index.ts` (`export * from "./snapshot-details"`).

JWC adaptation vs OMP: JWC hashline does NOT carry oldText/newText → skip hashline renderSection apply sites (OMP had them). Pure additive; ACP/diff degrades to no-diff for >32KB edits (text content still flows).

## Invariants

- LLM payload unchanged (details never sent to LLM — provider serializers send `content` only).
- Edits ≤32KB combined: byte-identical behavior (ACP diff preserved).
- Edits >32KB: `oldText`/`newText` dropped from persisted details; `diff`/`path`/`firstChangedLine`/`op`/`move`/`diagnostics`/`meta` preserved.
- Multi-file batch: shared aggregate budget; early entries keep snapshots, later over-budget entries stamped `snapshotsPruned: true`.
- No JWC naming violations; no new `as any` beyond existing.

## Acceptance

| # | criterion | evidence |
|---|---|---|
| 1 | small edit passes through unchanged | unit: oldText/newText retained when combined ≤32KB |
| 2 | oversized single edit drops snapshots, keeps metadata | unit: >32KB → oldText/newText undefined, diff/path kept |
| 3 | many-file batch shares aggregate budget | unit: 5 equal entries busting cumulatively → first N keep, rest snapshotsPruned |
| 4 | applied at all 4 sites (replace/patch/aggregateApplyPatch/executeSinglePathEntries) | grep apply sites wrapped |
| 5 | tsgo clean, biome clean, naming 0 | check:types EXIT 0, biome, naming grep |

## Verification

```bash
bun test packages/coding-agent/test/edit-snapshot-details.test.ts
cd packages/coding-agent && bun run check:types   # tsgo --noEmit EXIT 0
bunx biome check --write packages/coding-agent/src/edit/snapshot-details.ts <apply sites>
git -C devlog/_omp_chase/oh-my-pi show 9e4e0f669 398796949   # source resolve
```

## PABCD

- P: this plan.
- A: independent explorer (gpt-5.4) audits scope split (is the 1-slice/5-defer judgement defensible? are apply sites complete? consumer-contract safe?).
- B: implement snapshot-details.ts + wrap apply sites + renderer field + test.
- C: bun test + tsgo + biome + naming + diff --check.
- D: attest with evidence.

## Depends / feeds

- Relates: 20.009 _fin (append-only integrity — covers mid-run key identity), 10.040 _fin (compaction/resident memory bounds).
- Defers ③: snapcompact package, session-loader supersede elision, branch scoping, shake-elision (no JWC surface).
