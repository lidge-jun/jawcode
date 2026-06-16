# 270 — Expose JWC in Manager CLI selector

> PABCD slice. Repo for implementation: cli-jaw. Classification: C2.
> Current doc role: cross-repo API/frontend contract kept in jawcode for porting jawcode/JWC into cli-jaw.

## Problem

JWC exists in the cli-jaw registry but is not a primary, obvious Manager choice. The old implementation framing treated this as only a `PRIMARY_CLIS` array edit. That is insufficient: the phase contract is the full path from jawcode package evidence to cli-jaw registry API to Manager selector UI.

## API contract

```text
jawcode package evidence
  - `packages/jwc/package.json` (`jawcode`, bin `jwc`, export `./sdk`)
  - `packages/jwc/src/sdk.ts`
→ cli-jaw registry backend
  - `src/cli/registry.ts`
  - `src/cli/registry-live.ts`
  - `src/routes/settings.ts` → `GET /api/cli-registry`
→ Manager frontend selector
  - `public/manager/src/settings/pages/components/agent/agent-meta.ts`
  - Settings > Agent CLI dropdown
```

Verified cli-jaw evidence from checkout:

- `src/cli/registry.ts:146-157` defines `jwc` with `binary: 'jwc'`, `experimental: true`, `defaultModel: 'claude-fable-5'`, `defaultEffort: 'high'`, efforts, and models.
- `src/cli/registry-live.ts:4-16` returns a structured clone of `CLI_REGISTRY` with live augmentation.
- `src/routes/settings.ts:310-311` exposes `GET /api/cli-registry` via `buildLiveCliRegistry()`.
- `public/manager/src/settings/pages/components/agent/agent-meta.ts:28` currently omits `jwc` from `PRIMARY_CLIS`.

## Required documentation/implementation contract

1. JWC must be visible through the registry API and primary selector, not buried in overflow-only discovery.
2. The registry entry key is `jwc`.
3. The user-facing label should be normalized to `JWC` where the UI displays runtime identity.
4. Runtime truth comes from cli-jaw registry/API; `CLI_META` icon/description is frontend decoration only.
5. `PRIMARY_CLIS` may be part of the frontend implementation, but editing it alone does not satisfy this phase.

## Frontend acceptance sketch

- Settings/Agent CLI dropdown shows `JWC` in primary choices near `claude-e`/peer engines.
- The selector still coexists with `claude-e`, `ai-e`, `codex`, and other runtimes.
- Registry-derived model/effort defaults remain available for settings rows.
- `JWC` is not discoverable only by collapsed overflow.

## Negative acceptance

- This phase is **not** complete if docs or implementation say only “add `jwc` to `PRIMARY_CLIS`.”
- This phase is **not** complete if Manager hardcodes JWC metadata but `/api/cli-registry` does not expose the runtime consistently.

## Verification

```bash
# cli-jaw checkout
curl -s localhost:<manager-port>/api/cli-registry | jq '.jwc'
# Browser: Settings > Agent > Active CLI dropdown shows JWC as a primary option.
```

## Not in scope

- Default CLI switch (slice 280).
- Code mode UI (slice 300).
- Existing Jaw mode runtime attach (slice 305).
