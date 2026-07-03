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

1. Add helper for integer compact units used by the current rounded K/M/B bands:

```ts
function compactIntegerUnit(n: number, unit: number): string {
  return Math.min(Math.round(n / unit), 1000 - 1).toString();
}
```

2. Use `compactIntegerUnit()` only for the integer K/M/B bands (`10_000..1_000_000`, `10_000_000..1_000_000_000`, and `>=10_000_000_000`) so values below the next suffix never format as `1000K`, `1000M`, or `1000B`. Keep the existing `trim1()` decimal bands (`1_000..10_000`, `1_000_000..10_000_000`, `1_000_000_000..10_000_000_000`) unchanged.
3. Add byte helper:

```ts
function formatByteUnit(bytes: number, unit: number): string {
  const tenths = Math.min(Math.round((bytes / unit) * 10), 1024 * 10 - 1);
  return (tenths / 10).toFixed(1);
}
```

4. Use byte helper in `formatBytes()` for KB/MB/GB bands.

NEW `packages/utils/test/format.test.ts`:

- `formatNumber(999_499) === "999K"` and `formatNumber(999_999) === "999K"`.
- `formatNumber(999_999_999) === "999M"` and exact threshold values remain `1M`, `1B`.
- `formatBytes(1024 * 1024 - 1) === "1023.9KB"` and threshold values remain `1.0MB`, `1.0GB`.

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

- Change legacy `SEARCH_HARD_TIMEOUT_MS` to 300_000 and add `SEARCH_API_TIMEOUT_MS = 15_000`, `SEARCH_LLM_TIMEOUT_MS = 120_000`, `SearchTimeoutClass = "api" | "llm"`, `TIMEOUT_CLASS_MS`.
- Change configured timeout state from always-set number to optional override.
- Change `setSearchHardTimeoutMs(ms)` to accept `number | undefined`, clear on non-finite/non-positive values, and return `void` (or keep return only if current callsites require it; A-stage must verify).
- Add `SearchTimeoutSettingSource` and `applyConfiguredSearchTimeout(settings)` so schema defaults do not silently reinstall uniform timeout.
- Change `withHardTimeout(signal, msOrClass?: number | SearchTimeoutClass)` so explicit numbers win; configured override wins over class defaults; omitted uses legacy ceiling.

MODIFY provider callsites under `packages/coding-agent/src/web/search/providers/`:

- API-class: `brave.ts`, `duckduckgo.ts`, `exa.ts`, `jina.ts`, `parallel.ts`, `searxng.ts`, `synthetic.ts`, `tavily.ts`, `zai.ts`, and `packages/coding-agent/src/web/kagi.ts` use `withHardTimeout(..., "api")` unless they already pass an explicit timeout.
- LLM-class: `perplexity.ts` use `"llm"` for LLM-mediated calls; `anthropic.ts`, `codex.ts`, `gemini.ts`, `xai.ts` preserve explicit `timeoutMs` behavior where present and otherwise use `"llm"`.
- Kimi: preserve its current semantics unless A-stage confirms GJC's explicit 30s budget is directly compatible with JWC's provider implementation.

MODIFY `packages/coding-agent/src/web/search/provider.ts`:

- Add `clearResolvedChainCache()` export.
- Add a WeakMap cache keyed by `AuthStorage` object and by tuple `(preferredProvider, activeModelProvider, generation)` where `generation` comes from `authStorage.getGeneration?.()` when available, otherwise a stable sentinel.
- Cache provider-id chains, not mutable provider arrays, then materialize instances via `getSearchProvider()` on return.
- Clear cache when `setPreferredSearchProvider()` changes global preference.
- Preserve current active-model-gated semantics: no credential scanning for keyed standalone providers, DuckDuckGo remains terminal fallback.

MODIFY `packages/coding-agent/src/web/search/index.ts`:

- Add configurable `DDG_HEDGE_DELAY_MS` default, `setDdgHedgeDelayMs(ms?: number)` test hook.
- In `executeSearch()`, when provider chain has a non-primary DuckDuckGo fallback, start a DuckDuckGo search in the background after a short delay while the primary is still running.
- If the primary succeeds first, abort/cancel/ignore the hedge.
- If the primary fails after the hedge has settled, reuse the hedged DuckDuckGo result instead of starting DuckDuckGo cold.
- Preserve user cancellation: `throwIfAborted(signal)` still exits immediately and must not turn into provider fallback.
- Preserve final error formatting and source/citation formatting.
- Replace the current `WebSearchTool.execute()` settings timeout wiring (`settings.get("web_search.timeout")` → `setSearchHardTimeoutMs(...)`) with `applyConfiguredSearchTimeout(this.#session.settings)` or equivalent source-aware logic so schema defaults do not override class defaults.

NEW `packages/coding-agent/test/web/search/speed-improvements.test.ts`:

- Per-class timeout constants order: API < LLM <= legacy.
- Explicit `web_search.timeout` override applies only when settings source `has("web_search.timeout")` is true; unset clears override and leaves class defaults active.
- Explicit millisecond argument to `withHardTimeout()` wins over configured/class defaults.
- `resolveProviderChain()` skips repeated availability probes for the same storage/context/generation and re-probes after `clearResolvedChainCache()` or generation change.
- Hedged DuckDuckGo: with fake provider chain `[slow failing primary, duckduckgo]`, DuckDuckGo starts before primary failure and final result is DuckDuckGo without a second DuckDuckGo call.
- Primary success aborts/ignores hedge without surfacing warnings.

## Verification plan

Run focused tests:

```bash
bun test packages/utils/test/glob.test.ts packages/utils/test/format.test.ts
bun test packages/coding-agent/test/edit-read-file.test.ts
bun test packages/coding-agent/test/web/search/speed-improvements.test.ts packages/coding-agent/test/tools/web-search-hard-timeout.test.ts packages/coding-agent/test/web/search/abort-and-timeout.test.ts
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
- `formatNumber()` never rounds below-threshold values into the next suffix, while exact thresholds still advance suffixes.
- `formatBytes()` never rounds below-threshold byte values into the next unit, while exact thresholds still advance units.
- `readEditFileText()` preserves UTF-8 BOM for normal files; non-BOM and notebook behavior remain unchanged.
- Web-search API-class providers, including Kagi's shared helper in `packages/coding-agent/src/web/kagi.ts`, use short class timeouts; LLM-mediated providers use longer class timeouts or explicit provider timeout where already supported; and user-configured timeout override semantics are tested through the actual `WebSearchTool.execute()` settings path.
- `resolveProviderChain()` caches chain resolution per AuthStorage/context/generation without changing provider ordering or DuckDuckGo terminal fallback semantics.
- DuckDuckGo hedge improves slow-primary fallback without breaking cancellation, primary success, or final formatting.
