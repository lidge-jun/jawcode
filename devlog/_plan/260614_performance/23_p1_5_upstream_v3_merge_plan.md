# P1.5 — upstream Optimization Suite v3 merge

> Status: ⬜ planned / 🔶 P1.5.1 patched locally (260615, focused tests pass)
> Prerequisite for: P2.2, P3, P4
> Trigger: gap analysis (260615) found upstream perf deltas since `251aa000` (v2 merge), but several v3 symbols are already partially present in jawcode.
> Upstream clone: `devlog/_upstream_gjc/` @ `269387ba`

## 1. Objective

Merge upstream gajae-code Optimization Suite v3 (3 lanes + input render priority + profiling infra) into jawcode before proceeding with P2–P4. These patches modify the same files P2–P4 targets; merging first avoids conflict compounding.

## 2. Gap summary

| Sub | Upstream commit | PR | Lane | Files | Impact |
|-----|----------------|-----|------|-------|--------|
| **P1.5.1** | `19bba222` | #593 | Input render priority | `tui/src/tui.ts` | **체감 직격** — 타이핑 렌더 우선순위, nextTick 기반 expedited render |
| **P1.5.2** | `5283f4e6` | #548 | v3 Lane 1: session resident cache | `session-manager.ts`, `blob-store.ts` | 큰 세션 resume RSS 방어, `EphemeralBlobStore`, resident ownership |
| **P1.5.3** | `78ed07c3` | #557 | v3 Lane 2: compaction token/trim | `compaction/openai.ts`, `compaction/pruning.ts` | staleness-aware pruning, token estimation cache |
| **P1.5.4** | `f40f0d66` | #558 | v3 Lane 3: serialization/diff | `secrets-obfuscator.ts`, diff oracle, LCS | 클론/비교 CPU, `cloneJsonSemantic` |
| **P1.5.5** | `94c563d3` | #584 | Profiling corpus + FFI policy | bench/, test/, docs/ | 측정 인프라 — P2-P4 작업 전 baseline 필수 |

### 추가 upstream 패치 (성능 인접)

| Upstream commit | PR | 내용 | 병합 판단 |
|----------------|-----|------|----------|
| `98366608` | #612 | session resume + rust-analyzer warmup hardening | P1.5.2와 같이 |
| `8e8e784f` | #570 | task notification vs context maintenance race | 선별 — 직접 성능은 아니지만 안정성 |

## 3. Current-code gap evidence (260615 refresh)

```
P1.5.1 input prio
  Before patch: inputRenderPending / commitExpeditedRender were missing from jawcode tui.ts.
  260615 local patch: packages/tui/src/tui.ts now has #inputRenderPending, #commitExpeditedRender(), forced-render cancellation, and #handleInput() tags input renders with source="input".
  Tests added: packages/tui/test/input-render-latency.test.ts, packages/tui/test/input-render-redteam.test.ts.
  Focused gate: bun test packages/tui/test/input-render-latency.test.ts packages/tui/test/input-render-redteam.test.ts → 9 pass / 27 assertions.

P1.5.2 resident cache
  Already present: packages/coding-agent/src/session/blob-store.ts has EphemeralBlobStore and ResidentBlobMissingError; session-manager.ts has resident sentinel externalization/materialization and the compaction searchStart clamp.
  Missing: session-manager EphemeralBlobStore integration, fail-closed resident image resolvers, split text/image resident stores, resident lifecycle ownership for capture/restore/fork/move/session switch, cloneSessionContext/cloneJsonSemantic cache discipline, model-change provenance fields, and resident-cache tests.

P1.5.3 compaction pruning
  Already present: staleness-aware pruning, ToolResultMeta, createPrunedNotice, prunedEntries, native token-counting path.
  Missing: upstream resultDigest() / digest-aware truncated notices and some staleness edge-case parity (selector stripping, Add File patch headers, failed rename grouping, search-key defaults).
  Do not wholesale port upstream pruning.ts: current jawcode's countMessageTokensNative/Encoding path is intentional.

P1.5.4 serialization/diff/secrets
  Already present: packages/coding-agent/src/secrets/* and packages/coding-agent/test/secrets-obfuscator.test.ts through the regex/object tests; packages/coding-agent/test/core/diff-oracle.test.ts exists.
  Missing: later upstream secrets-obfuscator adversarial/sorted-cache test blocks; hindsight LCS test; any remaining diff-oracle deltas.
  Incorrect old claim: upstream test imports ../src/secrets/obfuscator and ../src/secrets/regex, not packages/coding-agent/src/session/secrets-obfuscator.ts.

P1.5.5 profiling corpus
  Already present: packages/coding-agent/bench/context-optimization.bench.ts covers a different context-optimization suite.
  Missing: perf-corpus-schema.ts, perf-corpus.bench.ts, session-memory.bench.ts, perf-threshold.ledger.ts, perf-corpus.test.ts, docs/perf-profiling-corpus.md, and docs/native-ffi-optimization-policy.md.
```

## 4. Missing focused files after refresh

```
packages/coding-agent/test/session-resident-cache.test.ts
packages/coding-agent/test/session-resident-lifecycle.test.ts
packages/coding-agent/test/session-resident-ownership.test.ts
packages/coding-agent/test/resident-materialization.test.ts
packages/coding-agent/bench/perf-corpus-schema.ts
packages/coding-agent/bench/perf-corpus.bench.ts
packages/coding-agent/bench/session-memory.bench.ts
packages/coding-agent/bench/perf-threshold.ledger.ts
packages/coding-agent/test/perf-corpus.test.ts
packages/coding-agent/test/hindsight-mental-models-lcs.test.ts
packages/agent/test/pruning-staleness.test.ts (Add File parity coverage to add in P1.5.3)
docs/perf-profiling-corpus.md
docs/native-ffi-optimization-policy.md
```

## 5. Merge order and conflict risk

### P1.5.1 — Input render priority (LOW code conflict, HIGH scroll-model sensitivity)

Target: `packages/tui/src/tui.ts`

Upstream adds:
- `#inputRenderPending` field
- `#commitExpeditedRender()` method — input source renders via `process.nextTick`, cancelling pending frame-budget timer
- Coalesced to one expedited render per event-loop turn (no repaint storms)
- `#handleInput()` must call `requestRender(false, "input")`

Conflict risk: **low for the scheduling delta**, but **high if cherry-picked wholesale**. Current jawcode `tui.ts` contains B2-lite viewport fill, sticky gap, viewport repaint, and commit-lane behavior that is not upstream and must not be overwritten.

Merge strategy: surgical scheduling port only. Do not port upstream line-normalization/truncation caches or multiplexer repaint policy as part of P1.5.1.

260615 patch status: **patched locally** in `packages/tui/src/tui.ts`; tests added in `packages/tui/test/input-render-latency.test.ts` and `packages/tui/test/input-render-redteam.test.ts`; focused test command passes.

### P1.5.2 — Session resident cache (HIGH conflict)

Target: `packages/coding-agent/src/session/session-manager.ts` (550 diff lines)

Upstream/current delta:
- Already present: `EphemeralBlobStore` and `ResidentBlobMissingError` in `blob-store.ts`; resident sentinel externalization/materialization; compaction `searchStart` hydration clamp.
- Missing: fail-closed resident image resolvers (`resolveResidentImageDataSync` / `resolveResidentImageDataUrlSync`), split resident text/image stores, persistent-session `EphemeralBlobStore` ownership, resident lifecycle reset/dispose/re-externalize paths, `cloneSessionContext()` / `cloneJsonSemantic` cache discipline, revision invalidation, model-change provenance fields (`previousModel`, `reason`, `thinkingLevel`), and tests.

Conflict risk: **high**. Current `session-manager.ts` has independent compaction progress / threshold persistence / hydration hardening. The current `searchStart` clamp is ahead of the compared upstream snapshot and must be preserved.

Merge strategy: manual delta port. First port fail-closed resident image resolvers and resident tests, then the lifecycle/cache ownership in a separate review. Do not replace `session-manager.ts` wholesale.

### P1.5.3 — Compaction token/trim (MEDIUM conflict)

Target: `packages/agent/src/compaction/pruning.ts` (480 diff lines)

Upstream/current delta:
- Already present: `ToolResultMeta`, `createPrunedNotice()`, staleness-aware pruning, `prunedEntries`, native token-counting via optional `Encoding`.
- Missing: `resultDigest()` and digest-aware truncated notices for bash/search/grep summaries; selected staleness parity fixes.

Conflict risk: **medium**. The upstream file uses `estimateEntryTokens(entry)` while jawcode intentionally supports `countMessageTokensNative(message, encoding)`. A wholesale port would regress the native-counting path.

Merge strategy: port digest-aware notices and targeted staleness edge fixes only, preserving jawcode's `Encoding`/native token-counting contract.

### P1.5.4 — Serialization/diff (LOW conflict)

Upstream/current delta:
- Already present: `packages/coding-agent/src/secrets/obfuscator.ts`, `packages/coding-agent/src/secrets/regex.ts`, `packages/coding-agent/test/secrets-obfuscator.test.ts`, and `packages/coding-agent/test/core/diff-oracle.test.ts`.
- Missing: upstream `secrets-obfuscator.test.ts` describe blocks after the regex/object tests; `packages/coding-agent/test/hindsight-mental-models-lcs.test.ts`; any remaining diff-oracle delta.

Conflict risk: **low to medium**. This is mostly test/additive work, but the old plan path `packages/coding-agent/src/session/secrets-obfuscator.ts` is wrong.

Merge strategy: append upstream missing tests to existing files; verify imports stay under `src/secrets/*`.

### P1.5.5 — Profiling corpus (LOW conflict, dependency caveat)

Mostly new files:
- `packages/coding-agent/bench/perf-corpus-schema.ts`
- `packages/coding-agent/bench/perf-corpus.bench.ts`
- `packages/coding-agent/bench/session-memory.bench.ts`
- `packages/coding-agent/bench/perf-threshold.ledger.ts` (upstream dependency required by `perf-corpus.bench.ts`)
- `packages/coding-agent/test/perf-corpus.test.ts`
- `docs/perf-profiling-corpus.md`
- `docs/native-ffi-optimization-policy.md`

Conflict risk: **low**, but not "none": `perf-corpus.bench.ts` imports the `perf-threshold.ledger.ts` module via `./perf-threshold.ledger`, and schema/docs strings need an explicit keep-upstream-vs-jwc rebrand decision.

Merge strategy: additive copy + deliberate rebrand of user-visible names/temp prefixes; keep `context-optimization.bench.ts` unchanged because it measures a different suite.

## 6. Recommended execution order

```
P1.5.1 (input render prio) ← patched first; 체감 즉시 개선, focused tests pass
P1.5.5 (profiling infra)   ← additive, but include perf-threshold.ledger.ts dependency and perf-corpus.test.ts
P1.5.4 (serialization/diff) ← mostly missing tests
P1.5.3 (compaction token)   ← targeted resultDigest/staleness delta, no wholesale port
P1.5.2 (session resident)   ← highest conflict, session-manager.ts manual merge
```

Rationale: easy wins first, measurement infra before heavy merges, highest-conflict last when the rest is stable.

## 7. Verification per sub-phase

| Sub | Verification |
|-----|-------------|
| P1.5.1 | `bun test packages/tui/test/input-render-latency.test.ts packages/tui/test/input-render-redteam.test.ts` + TUI type/format gate |
| P1.5.2 | `bun test packages/coding-agent/test/session-resident-*.test.ts packages/coding-agent/test/resident-materialization.test.ts` + session resume smoke |
| P1.5.3 | `bun test packages/agent/test/pruning-redteam.test.ts packages/agent/test/pruning-staleness.test.ts packages/agent/test/pruning-staleness-redteam.test.ts` |
| P1.5.4 | `bun test packages/coding-agent/test/secrets-obfuscator.test.ts packages/coding-agent/test/core/diff-oracle.test.ts packages/coding-agent/test/hindsight-mental-models-lcs.test.ts` |
| P1.5.5 | `bun test packages/coding-agent/test/perf-corpus.test.ts` + `bun packages/coding-agent/bench/perf-corpus.bench.ts` + `bun --smol --expose-gc packages/coding-agent/bench/session-memory.bench.ts` |
| **All** | `bun run check && bun run test` |

## 8. P2-P4 dependency map (updated)

```
P1.5.1 (input prio)    ──→ P2.2 (prepared-line cache)
P1.5.2 (session cache)  ──→ P3   (session resume double-load)
P1.5.3 (compaction)     ──→ P4   (token counting cache)
P1.5.5 (profiling)      ──→ P2-P4 전체 (baseline measurement)

P2.1 (markdown reuse)   ──→ 독립 (upstream 무관, 바로 착수 가능)
P2.3 (ctrl+t lazy)      ──→ 독립 (upstream 무관, 바로 착수 가능)
```
