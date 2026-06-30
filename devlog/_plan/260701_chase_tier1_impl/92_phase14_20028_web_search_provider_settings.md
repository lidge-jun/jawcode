# WP14 — 20.028 web-search provider settings (IMPORT)

> Goal `f8909338-255` · work-phase 14 · one FULL PABCD cycle.
> Card: struct_har/chase/20.028_omp_chase_web_search_provider_settings.md (OMP reference-only, Decision A = IMPORT).
> Source: OMP `ca9f2847e..b6c9747d4` (v16.2.5→v16.2.9) web-search cluster. **1:1 port ❌ — JWC redesign.**

## Triage (research-confirmed, 2026-07-01)

| # | OMP feature | anchor | JWC status | decision |
|---|---|---|---|---|
| 1 | DDG scrape HTML frontend (not Instant Answer API) | `755a61de0` | ALREADY SHIPPED — `providers/duckduckgo.ts` scrapes `html.`+`lite.` endpoints | CONFIRM (no-op) |
| 2 | DDG native-browser-aligned requests | `09061ed80` | **PARTIAL** — JWC has rotated desktop UAs + basic `Accept`/`Accept-Language`/`Content-Type`, but lacks OMP's `Sec-Ch-Ua*`, `Sec-Fetch-*`, `Referer`, `Cache-Control`, `Priority`, `Upgrade-Insecure-Requests` headers + blank `b` form param (audit Mill, duckduckgo.ts:187-188,192) | **ADOPT** |
| 3 | honor explicit `--provider auto` override | `ba6b64bf8` | ALREADY SHIPPED — `resolveProviderChain` distinguishes `undefined`(settings preferred) vs `"auto"`(bypass); `executeSearch` passes `params.provider` straight through (index.ts:169) | CONFIRM (no-op) |
| 4 | **apply search provider settings in standalone CLI** | `3560d108d` | **GAP** — `runSearchCommand` never applies configured `providers.webSearch`; `gjc q "..."` without `--provider` ignores user's preferred provider (SDK path sdk.ts:885 + slash/selector apply it, CLI does not) | **ADOPT** |
| 5 | DDG result cap unchanged | `6f8f76be4` | n/a documented non-change; JWC cap = `MAX_NUM_RESULTS=20` | CONFIRM (no-op) |
| 6 | gemini api-key search (developer API when OAuth absent) | `530113eb7` (+`6e166274c`) | JWC gemini search is OAuth-only (CloudCode) | **DEFER** |

**DEFER rationale (#6):** 456-line credential-path rework (developer API request serialization, Google Search grounding, dual OAuth/api-key streaming). Security-sensitive (card Decision G = security reviewer); overlaps 10.062 (Gemini UA) + 20.024 (MCP oauth). Beyond the "DDG-scrape + provider settings" IMPORT scope; adopting a large credential path without a dedicated security pass in this cycle is the wrong risk tradeoff. Cross-ref note added to card; revisit in a gemini-credential cluster pass.

## Design (JWC-authored ADAPT of OMP `09061ed80` + `3560d108d`)

### Slice A — native-browser-aligned DuckDuckGo request headers (OMP `09061ed80`)
`packages/coding-agent/src/web/search/providers/duckduckgo.ts` `fetchAndParse`:
- Add the browser-aligned request headers OMP sends, adapted to JWC's structure (JWC rotates UA per attempt + has html+lite endpoints; OMP touched only the html path). Keep JWC's per-attempt UA rotation; add the static browser-fingerprint headers + blank `b` form param so the html endpoint POST matches native DuckDuckGo browser submission:
```ts
// in fetchAndParse, html-endpoint body:
const body = new URLSearchParams({ q: query });
if (df) body.set("df", df);
if (endpoint === "html") body.set("b", ""); // match native DDG HTML form (OMP 09061ed80)

// request headers (merge with existing UA rotation):
headers: {
	"User-Agent": userAgent,
	Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
	"Accept-Language": "en,en-US;q=0.9",
	"Cache-Control": "max-age=0",
	"Content-Type": "application/x-www-form-urlencoded",
	Priority: "u=0, i",
	"Sec-Ch-Ua": '"Google Chrome";v="124", "Chromium";v="124", "Not)A;Brand";v="24"',
	"Sec-Ch-Ua-Mobile": "?0",
	"Sec-Ch-Ua-Platform": '"macOS"',
	"Sec-Fetch-Dest": "document",
	"Sec-Fetch-Mode": "navigate",
	"Sec-Fetch-Site": "same-origin",
	"Sec-Fetch-User": "?1",
	"Upgrade-Insecure-Requests": "1",
	Referer: endpoint === "html" ? "https://html.duckduckgo.com/" : "https://lite.duckduckgo.com/",
},
```
- Keep the existing rotated UA list (do NOT collapse to a single UA — JWC's rotation is a deliberate anti-block superset). `Sec-Ch-Ua` brand version stays generic (124) to match the rotated Chrome UA major; it is a hint, not a hard correctness coupling.
- Backend behavior only; no SSRF surface change (same endpoints, same POST). Parser/fixtures unchanged.

### Slice B — apply configured provider settings in standalone search CLI (OMP `3560d108d`)
`packages/coding-agent/src/cli/web-search-cli.ts` `runSearchCommand`:
- Before resolving the implicit provider chain, load settings and apply the configured preferred web-search provider, mirroring the SDK path (sdk.ts:884-886) so `gjc q "..."` honors `providers.webSearch`.
- JWC has no `applyProviderGlobalsFromSettings` helper (OMP-specific); inline the minimal, search-only apply:
```ts
import { getProjectDir } from "@jawcode-dev/utils";
import { Settings } from "../config/settings";
import { setPreferredSearchProvider } from "../web/search/provider";
import { isSearchProviderPreference } from "../web/search/types";
// ... inside runSearchCommand, after validation, before initTheme():
const settings = await Settings.init({ cwd: getProjectDir() });
const configuredProvider = settings.get("providers.webSearch");
if (typeof configuredProvider === "string" && isSearchProviderPreference(configuredProvider)) {
	setPreferredSearchProvider(configuredProvider);
}
```
- An explicit `--provider` flag still wins: it is passed as `params.provider` into `runSearchQuery` → `resolveProviderChain(authStorage, params.provider, ...)`, which overrides the module-global preferred provider. Settings only fills the `undefined` (no-flag) case — exactly OMP's intent.

### Slice C — focused tests
DDG headers: extend/observe via `test/tools/web-search-duckduckgo.test.ts` fixtures or a focused fetch-shape assertion (the existing DDG test stubs fetch; assert the html-endpoint request carries `b=""` + `Sec-Fetch-*`/`Referer`).
CLI settings: `packages/coding-agent/test/web/search/cli-provider-settings.test.ts` (NEW), JWC-adapted from OMP `cli-provider-settings.test.ts`:
- settings `providers.webSearch = "<id>"` + no `--provider` flag → `setPreferredSearchProvider` receives the configured id (assert via `resolveProviderChain` default or a spy on the exported setter).
- explicit `--provider auto` flag → still bypasses configured preferred (param overrides global).
- absent/`auto` settings → falls back to `auto` default.

## Invariants
- Explicit `--provider` CLI flag always overrides settings-configured preferred provider.
- Settings only fills the no-flag case; never silently bypasses an explicit choice.
- No new omp/pi/oh-my-pi literals in added lines (source-citation comments `OMP 3560d108d` allowed).
- DDG/scrape backend untouched (already shipped); no SSRF surface change.

## Acceptance
| check | expectation |
|---|---|
| `gjc q "x"` with configured `providers.webSearch` | preferred provider applied before chain resolution |
| `gjc q --provider auto "x"` | bypasses configured preferred |
| focused test | green |
| `bun run check:types` | EXIT 0 |
| naming scan | 0 new omp/pi literals (added lines) |

## Verification
- `bun test test/web/search/cli-provider-settings.test.ts`
- `cd packages/coding-agent && bun run check:types` (tsgo EXIT 0)
- `bunx biome check --write <files>`
- naming scan + `git diff --check`

## PABCD plan
- P: this doc.
- A: gpt-5.4 explorer audit — confirm #1/#2/#3/#5 already-shipped claims with file:line, validate #4 gap + #6 defer rationale, check Settings.init/getProjectDir/isSearchProviderPreference availability + signatures, no-inline-import compliance.
- B: implement Slice A+B, independent reviewer PASS, atomic commits.
- C: focused test + tsgo + naming + diff-check.
- D: attest → IDLE; card Done-Gate triage note (reference-only card stays OPEN per OMP convention), slice-map + goal checkpoint.

## Depends / feeds
- Cross-ref 10.043 (_fin web-search hardening), 10.062 (Gemini UA), 20.024 (MCP oauth) for the deferred #6.
