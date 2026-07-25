# WP5 — Card 20.009: append-only context integrity (IMPORT)

> Goal `f8909338-255` · PABCD work-phase 5 · Card `struct_har/chase/20.009_omp_chase_append_only_context_integrity.md`
> OMP source: `cc0c67be..0fc6d136` (v16.1.13→v16.1.20), 8 commits. decision=**IMPORT**. JWC-native reimplementation, 1:1 port FORBIDDEN.

## Why (non-dev summary)

JWC의 append-only 컨텍스트는 프로바이더 prompt-cache 적중률을 높이려고 대화 prefix 바이트를 안정적으로 유지해요. 그런데 (1) 이미 동기화된 메시지가 in-place로 재작성되면(per-turn pruning, 이미지 strip 등) JWC는 **로그 전체를 비우고 다시 쌓아서** 로컬 백엔드(llama.cpp/Ollama)에서 매 턴 수만 토큰을 재-prefill해요(#3406). (2) digest가 tool-result 메타데이터·providerPayload를 안 봐서 그 필드만 바뀌면 못 잡아요. (3) 모델이 가끔 빈 이름 tool call(`name:""`)을 뱉으면 모든 프로바이더가 400을 던져 세션이 막혀요(#3458). 독립 audit(Hegel gpt-5.4) 결과 8커밋 전부 JWC에 실재 갭이라, JWC 구조(seed-prefix 모드 포함)에 맞춰 3 슬라이스로 재구현해요.

## Independent audit (explorer Hegel, gpt-5.4) — 8 commits

| # | OMP commit | subject | verdict | JWC anchor |
|---|---|---|---|---|
| 1 | `65a974aa9` | preserve append-only prefix on in-place rewrites | **MISSING-GAP** | `append-only-context.ts` syncMessages clears whole log (:219) |
| 2 | `cce627ee4` | include tool-result metadata in digests | **MISSING-GAP** | `#computeDigest` lacks toolCallId/toolName/isError (:314) |
| 3 | `5b9e009a8` | bound stable prefix by log length | **MISSING-GAP** | syncMessages trusts #lastSyncCount (:243) |
| 4 | `2b68785e8` | include provider payloads in digests | **MISSING-GAP** | `#computeDigest` lacks providerPayload (:314) |
| 5 | `a2471339a` | test: subagent append-only rewrites | **MISSING-GAP (test)** | no subagent-rewrite regression test |
| 6 | `7d8f1ed02` | drop malformed (empty-name) tool calls | **MISSING-GAP** | transform-messages.ts no sanitizer (:114) |
| 7 | `8d0667d40` | match malformed calls to results positionally | **MISSING-GAP** | transform-messages.ts (:237) |
| 8 | `c35319f99` | clear malformed queues at turn boundaries | **MISSING-GAP** | transform-messages.ts (:217) |

JWC divergence (why not 1:1 port): JWC `syncMessages` carries seed-fork logic (`#seededPrefixCount`, `messagesToSync`, seed-prefix invariant throws) that OMP lacks. JWC digest is whole-array (`#computeDigest(messages[])`) vs OMP per-message. So the prefix-preservation must be re-derived inside JWC's seed-aware flow, and digest payload expansion applies to JWC's existing whole-array function.

## Implementation — 3 slices (atomic commits)

### Slice WP5-A — stable-prefix preservation on in-place rewrite (#1, #3)

MODIFY `packages/agent/src/append-only-context.ts`:
- `AppendOnlyLog`: add `truncate(count: number)` — `if (count<0) count=0; if (count>=this.#entries.length) return; this.#entries.length = count;`
- `AppendOnlyContextManager`: replace `#syncedDigest: number` with `#messageDigests: number[]` (per-message). Add `#messageDigest(msg): number` (single-message digest; extract the per-message body of current `#computeDigest`). Keep `#computeDigest(messages[])` ONLY if still referenced; otherwise remove (check seedNormalizedMessages/syncMessages callers and migrate them to push per-message digests).
- Rewrite `syncMessages` to JWC-native 3-case flow, preserving the seed-prefix block:
  1. Compute `messagesToSync` exactly as today (seed-prefix prepend logic unchanged).
  2. **Compaction**: `if (messagesToSync.length < this.#lastSyncCount)` → seed-fork throws (unchanged), else `log.clear(); #lastSyncCount=0; #messageDigests=[]`.
  3. **In-place rewrite**: `if (#lastSyncCount > 0)` compute `stableCount = Math.min(#longestStablePrefix(messagesToSync), this.log.length)` (5b9e009a8 bound). If `stableCount < #lastSyncCount`: seed-fork → if `stableCount < #seededPrefixCount` throw "seed prefix changed" (preserve existing invariant), else `log.truncate(stableCount); #lastSyncCount=stableCount; #messageDigests.length=stableCount`.
  4. **Append tail**: `for (let i=#lastSyncCount; i<messagesToSync.length; i++){ log.append(m); #messageDigests.push(#messageDigest(m)); }` then `#lastSyncCount = messagesToSync.length`.
- Add `#longestStablePrefix(messages): number` = `bound=Math.min(#lastSyncCount, messages.length); for i<bound if #messageDigest(messages[i]) !== #messageDigests[i] return i; return bound;`
- Update `#syncedDigest=0` resets (invalidateForModelChange/resetSyncCursor/reset/seedNormalizedMessages) to `#messageDigests=[]` / per-message rebuild. `seedNormalizedMessages` must populate `#messageDigests` with per-message digests of cloned messages.
- ⚠️ seed-prefix invariant: keep the existing "seed prefix changed" throw when divergence is inside the seeded region (`stableCount < #seededPrefixCount`). This preserves JWC fork semantics that OMP doesn't have.

MODIFY `packages/agent/test/append-only-context.test.ts`: existing "detects in-place rewrite..." tests still pass (assert final content) — keep. ADD: "preserves byte-stable prefix when a deep message is rewritten" (msg[0] stable across rewrite of msg[1] — assert log identity of [0] retained, i.e. truncate not clear), "preserves prefix when tail rewritten", "rewriting first message re-syncs from scratch", "direct log.clear() then sync clamps to log length" (5b9e009a8). Subagent rewrite regression (#5 a2471339a) added here via seeded-fork rewrite test.

### Slice WP5-B — digest payload expansion (#2, #4)

MODIFY `packages/agent/src/append-only-context.ts` `#messageDigest` payload (after WP5-A):
- add `tcid: m.toolCallId ?? m.tool_call_id ?? null` (was tool_call_id only), `tn: m.toolName ?? m.name ?? null` (was name), `err: m.isError ?? null`, `pp: m.providerPayload ?? null`. Keep r/c/tc/id.
- Rationale: JWC Message uses camelCase `toolCallId`/`toolName`/`isError` (`packages/ai/src/types.ts:619`/`:620`/`:623`) + `providerPayload` (:576/:586/:611); current digest only hashed wire snake_case so JWC in-place metadata rewrites were invisible.

ADD tests: digest detects a rewrite that changes only `isError`, only `providerPayload`, only `toolName` (same text content) → prefix correctly truncated at that message.

### Slice WP5-C — malformed empty-name tool-call sanitization (#6, #7, #8)

MODIFY `packages/ai/src/providers/transform-messages.ts`:
- Add `isMalformedToolCallName(name?): boolean` = `!name || name.trim().length === 0`.
- Add `sanitizeMalformedToolCalls(messages: Message[]): Message[]`: JWC-native, scoped to assistant→toolResult windows (8d0667d40 positional/occurrence matching + c35319f99 turn-boundary clearing). Walk messages; collect malformed `toolCall` block ids per assistant turn; drop those blocks, drop `toolResult` with matching `toolCallId`, drop assistant turns left empty. Idempotent. Must reconcile with JWC content-block model (`block.type === "toolCall"`, `block.name`, `block.id`; toolResult is `msg.role === "toolResult"` with `msg.toolCallId`).
- Call `messages = sanitizeMalformedToolCalls(messages)` as the FIRST line inside `transformMessages` (before toolCallIdMap build at :37), so the rest of the pipeline never sees malformed calls.
- ⚠️ JWC integration: JWC already has `pendingAbortedToolCalls`/orphan handling (:217/:237). Sanitizer runs BEFORE those, removing malformed pairs so the abort/orphan pass is unaffected.

ADD test file `packages/ai/test/transform-messages-malformed-tool-calls.test.ts`: empty-name call + its result dropped; whitespace-name dropped; assistant turn with only malformed call removed; valid calls untouched; idempotent re-run; two malformed calls in one turn matched to two results positionally.

## Verification gate

- `bun test packages/agent/test/append-only-context.test.ts packages/ai/test/transform-messages-malformed-tool-calls.test.ts` green (+ any existing transform-messages tests).
- `cd packages/agent && bun run check:types` exit 0; `cd packages/ai && bun run check:types` exit 0.
- `bunx biome check --write` changed files.
- naming: added lines brand-literal (gjc/gajae/omp/pi) 0.
- `git diff --check` clean. OMP SHAs (65a974aa9/cce627ee4/5b9e009a8/2b68785e8/a2471339a/7d8f1ed02/8d0667d40/c35319f99) resolve.
- Regression: run full `packages/agent` + `packages/ai` append-only/transform/replay tests to confirm no prefix-cache or replay regression.

## PABCD

- P: this plan. A: explorer Hegel(gpt-5.4) 8-commit gap analysis → all MISSING-GAP, JWC-native required; (adversarial re-audit during A). B: 3 atomic slices. C: test+tsc(2 pkgs). D: evidence.

## Decisions recorded (card Done Gate)

- All 8 IMPORT as JWC-native reimplementation (no 1:1 port). #5 folded into WP5-A tests. Seed-prefix invariant preserved (JWC-specific).

## Feeds / depends

- depends: 10.051 (_fin GJC agent composer/toolcall integrity — overlap checked, no duplicate). feeds: 20.021 (v2 streaming integrity, next work-phase), 20.025 (compaction/session-scope).
