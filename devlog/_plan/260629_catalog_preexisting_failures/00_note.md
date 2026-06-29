# Pre-existing catalog test failures resolved (#404, #489)

While hardening the Kiro provider, the full `packages/ai` suite showed 3 failing
tests unrelated to Kiro. They were genuine catalog bugs, now fixed.

## #404 — MiniMax-M3 display casing

`getBundledModel("minimax*", "minimax-m3").name` was the plan-specific upstream
label `"MiniMax M3 (3x usage)"`, but the catalog should surface a stable
`"MiniMax-M3"`. Fixed in [models.ts](/Users/jun/Developer/new/700_projects/jawcode/packages/ai/src/models.ts) `applyBundledCompatDefaults`:
normalize the bundled display name to `MiniMax-M3` for the `minimax-m3` id at
load time (id/transport/pricing untouched). This rides the same compat-defaults
layer that already patches stale committed `models.json` snapshots, so it
survives regeneration.

## #489 — opencode-go qwen3.7-max transport downgrade

`qwen3.7-max` is served over `anthropic-messages` at `https://opencode.ai/zen/go`,
but dynamic discovery tagged every id `openai-completions` at `/v1`, and the
merge let the dynamic row clobber the catalog transport (gateway 401
"not supported for format oa-compat"). Fixed in
[model-manager.ts](/Users/jun/Developer/new/700_projects/jawcode/packages/ai/src/model-manager.ts):
the static catalog is now authoritative for `api` and its api-specific `baseUrl`
through every merge path (models.dev, cache, dynamic), the cold-start fast path
repairs a poisoned-transport fresh cache before returning, and `mergeDynamicModel`
preserves the static transport while still enriching cost/context fields.

## Verification

- `packages/ai`: `bun run check:types` clean; full `bun test` 1348 pass, 0 fail.
- opencodex unaffected: `./tests/` 766 pass, 0 fail.
