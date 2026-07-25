# 10_plan — P-stage draft: `10.071` search/utils/edit safety

Status: draft-for-critic
Cycle: PABCD phase 10 of `devlog/_plan/260703_chase_hardening_goal_passthrough/00_moc.md`
Source chase card: `struct_har/chase/10.071_gjc_chase_search_utils_edit_safety.md`
Work class: C3, cross-package hardening (`packages/coding-agent` + `packages/utils`)

## Loop-spec header

- Loop archetype: verifier defines done. The target behaviors are concrete safety/perf regressions with deterministic unit tests.
- Trigger: GJC chase range `79b42377..db7938e1` added generic hardening for web search latency/fallback, glob exclude performance, compact formatting boundaries, and UTF-8 BOM preservation.
- Goal: import/adapt the parts JWC still lacks without changing product policy or public workflow behavior.
- Non-goals: no provider/model catalog policy changes; no new web-search provider; no networked/live web tests; no broad rewrite of the search provider registry; no adoption of GJC branding/import paths; no change to edit max-file-size policy in this phase.
- Verifier: focused Bun tests for web-search timing/cache/hedge behavior, glob excludes, format boundary values, and edit BOM preservation; then `git diff --check`, `bun run check:tools`, and `bun run check:ts` because signatures/imports change.
- Stop condition: all listed focused tests pass, check gates pass, B verifier reports DONE, C gates pass.
- Memory artifact: this plan, A/B/C/D receipts beside it, and implementation commit hashes.
- Expected terminal states: done (all four behavior clusters implemented/tested), noop (JWC already satisfies a cluster after direct evidence), blocked (test harness cannot deterministically assert search hedge/cache), needs-human (provider behavior semantics conflict with JWC policy), budget-exhausted (partial clusters with explicit remaining gap).
- Escalation condition: if search hedge/cache requires changing `SearchProvider` public interfaces or auth-storage semantics beyond this package, return to P/A before coding.

## Current-state evidence

- `packages/utils/src/glob.ts:172-181` constructs `new Glob(excludePattern)` inside the per-entry scan loop; GJC precompiles excludes once.
- `packages/utils/src/format.ts:33-40` can round `999_999` to `1000K` / `999_999_999` to `1000M`; GJC clamps compact units below the next suffix.
- `packages/utils/src/format.ts:53-57` can round `1024 * 1024 - 1` to `1024.0KB`; GJC clamps byte units below the next suffix.
- `packages/coding-agent/src/edit/read-file.ts:10-24` reads normal files via `Bun.file(...).text()` and serializes raw `content`, so a UTF-8 BOM stripped by Bun is not restored.
- `packages/coding-agent/src/web/search/providers/utils.ts:46-109` has one global 60s hard timeout and no per-class timeout override/`applyConfiguredSearchTimeout()` helper.
- `packages/coding-agent/src/web/search/provider.ts:206-236` resolves provider chains every call and has no per-AuthStorage/generation cache.
- `packages/coding-agent/src/web/search/index.ts:171-212` tries providers strictly serially; DuckDuckGo fallback is not hedged while a slow primary is still running.
- Existing tests: `packages/utils/test/glob.test.ts` and `packages/utils/test/format.test.ts` are missing; web-search tests exist under `packages/coding-agent/test/web/search/` and `packages/coding-agent/test/tools/`; edit tests exist but no BOM read/serialize regression was found.

## Implementation plan

### Cluster A — glob exclude precompile

MODIFY `packages/utils/src/glob.ts`:

Before:

```ts
for await (const entry of glob.scan(scanOptions)) {
  const normalized = entry.replace(/\\/g, "/");
  let excluded = false;
  for (const excludePattern of effectiveExclude) {
    const excludeGlob = new Glob(excludePattern);
    if (excludeGlob.match(normalized)) {
      excluded = true;
      break;
    }
  }
  if (!excluded) allResults.push(normalized);
}
```

After:

```ts
const excludeGlobs = effectiveExclude.map(pattern => new Glob(pattern));
...
const normalized = entry.replace(/\\/g, "/");
if (excludeGlobs.some(excludeGlob => excludeGlob.match(normalized))) continue;
allResults.push(normalized);
```

NEW `packages/utils/test/glob.test.ts`:

- temp-dir test for custom `exclude: ["dist/**"]` preserving included files.
- temp-dir test proving default `node_modules` excludes still apply when custom excludes are present.

### Cluster B — compact formatting boundary clamp

MODIFY `packages/utils/src/format.ts`:

1. Add helper for integer compact units used only by bounded below-next-suffix integer bands:

```ts
function compactIntegerUnit(n: number, unit: number): string {
  return Math.min(Math.round(n / unit), 1000 - 1).toString();
}
```

2. Use `compactIntegerUnit()` only for bounded integer transitions (`10_000..1_000_000` K-before-M and `10_000_000..1_000_000_000` M-before-B) so values below the next supported suffix never format as `1000K` or `1000M`. Keep the existing `trim1()` decimal bands (`1_000..10_000`, `1_000_000..10_000_000`, `1_000_000_000..10_000_000_000`) unchanged. Leave the unbounded `>=10_000_000_000` B branch on current `Math.round(n / 1_000_000_000)` behavior unless a later phase adds T suffixes.
3. Add byte helper:

```ts
function formatByteUnit(bytes: number, unit: number): string {
  const tenths = Math.min(Math.round((bytes / unit) * 10), 1024 * 10 - 1);
  return (tenths / 10).toFixed(1);
}
```

4. Use byte helper only for bounded byte transitions (KB-before-MB and MB-before-GB). Leave the unbounded GB branch on current `(bytes / (1024 * 1024 * 1024)).toFixed(1)` behavior unless a later phase adds TB suffixes.

NEW `packages/utils/test/format.test.ts`:

- `formatNumber(999_499) === "999K"` and `formatNumber(999_999) === "999K"`.
- `formatNumber(999_999_999) === "999M"` and exact threshold values remain `1M`, `1B`.
- Very large values preserve current unbounded behavior: `formatNumber(1_000_000_000_000) === "1000B"` unless a later phase adds T suffixes.
- `formatBytes(1024 * 1024 - 1) === "1023.9KB"` and threshold values remain `1.0MB`, `1.0GB`.
- Very large byte values preserve current unbounded behavior: `formatBytes(1024 ** 4) === "1024.0GB"` unless a later phase adds TB suffixes.

### Cluster C — edit UTF-8 BOM preservation

MODIFY `packages/coding-agent/src/edit/read-file.ts`:

- Add `MAX_UTF8_BOM`/`UTF8_BOM` bytes and `fileHasUtf8Bom(file: Bun.BunFile)` helper.
- For non-notebook files, read through one `const file = Bun.file(absolutePath)`, then `const text = await file.text()`.
- Return `text` unchanged when it already starts with `\uFEFF`; otherwise, if the first three bytes match UTF-8 BOM, prepend `\uFEFF` so downstream replacement serialization preserves the marker.
- Keep notebook behavior untouched; notebooks still go through `readEditableNotebookText()` and `serializeEditedNotebookText()`.

NEW `packages/coding-agent/test/edit-read-file.test.ts` or add to the nearest edit helper test if A-stage identifies one:

- create a temp UTF-8 BOM file, call `readEditFileText()`, assert returned text starts with `\uFEFF`.
- pass the returned/replaced text through `serializeEditFileText()` and write it back through the existing edit path if practical; otherwise assert serialization preserves the leading `\uFEFF` for normal files.
- non-BOM file remains unchanged.

### Cluster D — web-search timeouts, chain cache, and hedged DuckDuckGo fallback

MODIFY `packages/coding-agent/src/web/search/providers/utils.ts`:

- Keep `SEARCH_HARD_TIMEOUT_MS` at JWC's current 60_000 omitted/default ceiling, and add opt-in `SEARCH_API_TIMEOUT_MS = 15_000`, `SEARCH_LLM_TIMEOUT_MS = 120_000`, `SearchTimeoutClass = "api" | "llm"`, `TIMEOUT_CLASS_MS`. Do not adopt GJC's 300_000 omitted default in JWC; unclassified no-arg `withHardTimeout(signal)` callsites must retain today's 60s safety ceiling.
- Change configured timeout state from always-set number to optional override.
- Change `setSearchHardTimeoutMs(ms)` to accept `number | undefined`, clear on non-finite/non-positive values, and return `void` (or keep return only if current callsites require it; A-stage must verify).
- Add `SearchTimeoutSettingSource` and `applyConfiguredSearchTimeout(settings)` so schema defaults do not silently reinstall uniform timeout.
- Change `withHardTimeout(signal, msOrClass?: number | SearchTimeoutClass)` so explicit numbers win; configured override wins over class defaults; class arguments use class defaults; omitted still uses the existing 60s legacy ceiling.

MODIFY provider callsites under `packages/coding-agent/src/web/search/providers/`:

- API-class: `brave.ts`, `duckduckgo.ts`, `exa.ts`, `jina.ts`, `parallel.ts`, `searxng.ts`, `synthetic.ts`, `tavily.ts`, `zai.ts`, and `packages/coding-agent/src/web/kagi.ts` use `withHardTimeout(..., "api")` unless they already pass an explicit timeout.
- LLM-class: `perplexity.ts` use `"llm"` for LLM-mediated calls; `anthropic.ts`, `codex.ts`, `gemini.ts`, `xai.ts` preserve explicit `timeoutMs` behavior where present and otherwise use `"llm"`.
- Kimi: preserve current transport semantics explicitly by passing a documented numeric ceiling compatible with its existing 30s API budget (for example 60_000, matching current JWC no-arg behavior), not the 15s API class and not an accidental omitted default.
- Shared no-arg users outside provider callsites, especially `packages/coding-agent/src/web/parallel.ts`, are intentionally not changed by the class rollout and must continue to observe the 60s omitted default.

MODIFY `packages/coding-agent/src/web/search/provider.ts`:

- Add `clearResolvedChainCache()` export.
- Add a WeakMap cache keyed by `AuthStorage` object and by tuple `(preferredProvider, activeModelProvider, generation)` where `generation` comes from `authStorage.getGeneration?.()` when available, otherwise a stable sentinel.
- Cache provider-id chains, not mutable provider arrays, then materialize instances via `getSearchProvider()` on return.
- Clear cache when `setPreferredSearchProvider()` changes global preference.
- Preserve current active-model-gated semantics: no credential scanning for keyed standalone providers, DuckDuckGo remains terminal fallback.

MODIFY `packages/coding-agent/src/web/search/index.ts`:

- Add configurable `DDG_HEDGE_DELAY_MS` default, `setDdgHedgeDelayMs(ms?: number)` test hook.
- Define the hedge rule precisely: if the provider chain contains DuckDuckGo at any non-zero index, schedule exactly one DuckDuckGo hedge after `DDG_HEDGE_DELAY_MS` while the first non-DDG primary attempt is still running. The hedge is reused only after all earlier non-DDG providers attempted before DuckDuckGo fail; if another pre-DDG provider succeeds, the hedge is ignored/aborted. Do not start a new hedge after each provider.
- If the primary succeeds first, abort/cancel/ignore the hedge.
- If the primary fails after the hedge has settled, reuse the hedged DuckDuckGo result instead of starting DuckDuckGo cold.
- Preserve user cancellation: `throwIfAborted(signal)` still exits immediately and must not turn into provider fallback.
- Preserve final error formatting and source/citation formatting.
- Replace the current `WebSearchTool.execute()` settings timeout wiring (`settings.get("web_search.timeout")` → `setSearchHardTimeoutMs(...)`) with `applyConfiguredSearchTimeout(this.#session.settings)` or equivalent source-aware logic so schema defaults do not override class defaults.
- Update exposed timeout copy in `webSearchSchema` description, `providers/base.ts` parameter descriptions, and `settings-schema.ts` `web_search.timeout` description so user/model-facing text reflects class defaults plus explicit override instead of advertising one uniform 60s fast ceiling.

NEW `packages/coding-agent/test/web/search/speed-improvements.test.ts`:

- Per-class timeout constants order: API < LLM <= legacy.
- Explicit `web_search.timeout` override applies only when settings source `has("web_search.timeout")` is true; unset clears override and leaves class defaults active.
- Explicit millisecond argument to `withHardTimeout()` wins over configured/class defaults.
- `resolveProviderChain()` skips repeated availability probes for the same storage/context/generation and re-probes after `clearResolvedChainCache()` or generation change.
- Add a static callsite assertion test or fixture-backed review test that every named provider/Kagi timeout callsite uses `withHardTimeout(..., "api" | "llm")` or a documented explicit numeric timeout; Kimi and existing explicit `timeoutMs` providers are allowed exceptions.
- Hedged DuckDuckGo: with fake provider chain `[slow failing primary, duckduckgo]`, DuckDuckGo starts before primary failure and final result is DuckDuckGo without a second DuckDuckGo call.
- Longer hedge chain: with fake provider chain `[slow failing primary, second slow failing provider, duckduckgo]`, exactly one DuckDuckGo hedge starts while the first provider is still running and is reused only after both pre-DDG providers fail.
- Primary success aborts/ignores hedge without surfacing warnings.

## Verification plan

Run focused tests:

```bash
bun test packages/utils/test/glob.test.ts packages/utils/test/format.test.ts
bun test packages/coding-agent/test/edit-read-file.test.ts
bun test packages/coding-agent/test/web/search/speed-improvements.test.ts packages/coding-agent/test/tools/web-search-hard-timeout.test.ts packages/coding-agent/test/web/search/abort-and-timeout.test.ts packages/coding-agent/test/tools/web-search-parallel.test.ts
```

Then gates:

```bash
git diff --check
bun run check:tools
bun run check:ts
```

C-stage will run affected focused tests plus `bun run check`.

## Acceptance criteria

- `globPaths()` precompiles effective exclude globs once per call and preserves default `node_modules`/`.git` behavior with custom excludes.
- `formatNumber()` never rounds below-threshold values into the next supported suffix (K→M, M→B), exact thresholds still advance suffixes, and very large values above the supported B range preserve current unbounded B behavior unless a later phase adds T suffixes.
- `formatBytes()` never rounds below-threshold values into the next supported byte unit (KB→MB, MB→GB), exact thresholds still advance units, and very large values above the supported GB range preserve current unbounded GB behavior unless a later phase adds TB suffixes.
- `readEditFileText()` preserves UTF-8 BOM for normal files; non-BOM and notebook behavior remain unchanged.
- Web-search API-class providers, including Kagi's shared helper in `packages/coding-agent/src/web/kagi.ts`, use short class timeouts; LLM-mediated providers use longer class timeouts or explicit provider timeout where already supported; Kimi uses an explicit transport timeout compatible with its existing 30s API budget; no-arg non-provider callsites such as `packages/coding-agent/src/web/parallel.ts` retain the 60s omitted default; and user-configured timeout override semantics are tested through the actual `WebSearchTool.execute()` settings path.
- `resolveProviderChain()` caches chain resolution per AuthStorage/context/generation without changing provider ordering or DuckDuckGo terminal fallback semantics.
- DuckDuckGo hedge improves slow-primary fallback for two-provider and longer pre-DDG chains without breaking cancellation, primary success, or final formatting.
