# Phase 25 Plan — 10.043-B search provider mapping guard

## Summary

Record and test JWC's current web-search provider resolver contract against GJC commit `6527ee01`. Upstream fixed a richer resolver that sees active model `baseUrl`; JWC's resolver currently receives only `activeModelProvider`, so this slice must not port upstream logic wholesale. Instead, it hardens the JWC-native contract: unknown/custom/local provider names fall back to DuckDuckGo, keyed standalone providers are never auto-selected by credential presence, and OpenAI/Codex hosted mapping is only triggered by explicit hosted provider strings.

## Source facts

- Source card: `struct_har/chase/10.043_gjc_chase_web_search_insane_security.md`
- Upstream anchor: `6527ee01 fix(web-search): apply local-baseUrl guard to direct provider-id mapping`
- Upstream changed:
  - `packages/coding-agent/src/web/search/provider.ts`
  - `packages/coding-agent/test/web/search/provider-resolution.test.ts`
- JWC owner:
  - `packages/coding-agent/src/web/search/provider.ts`
  - `packages/coding-agent/test/tools/web-search-duckduckgo.test.ts`

## Decision

JWC does not currently have `ActiveSearchModelContext` in `resolveProviderChain()`. It cannot distinguish `provider: "openai"` backed by `https://api.openai.com` from `provider: "openai"` backed by a local OpenAI-compatible `baseUrl`. Adding that context would be a wider API/behavior change and needs a separate product decision.

For this slice, preserve JWC logic and add regression tests proving:

- custom/unknown active model providers do not map to hosted Codex even when OpenAI OAuth exists.
- local-provider aliases used by JWC's model registry (`ollama`, `llama.cpp`, `lm-studio`) do not map to hosted Codex.
- keyed standalone providers are not auto-selected just because their env key exists.
- hosted provider strings (`openai`, `openai-codex`) still map to Codex when OAuth is available.

## Modify

- `packages/coding-agent/test/tools/web-search-duckduckgo.test.ts`
  - Add explicit test coverage for local provider aliases falling back to DuckDuckGo:
    - `ollama`
    - `llama.cpp`
    - `lm-studio`
  - Keep existing hosted OpenAI mapping tests as positive controls.

- `struct_har/chase/10.043_gjc_chase_web_search_insane_security.md`
  - Add Phase 25 partial evidence for `10.043-B`.
  - Record that upstream `6527ee01` is not directly portable without expanding JWC resolver context.
  - Record that this partially satisfies `10.043-B`: local registry provider aliases are pinned, while the exact upstream `provider: "openai"` + local `baseUrl` denial remains deferred until JWC passes active model context into provider resolution.
  - Keep the card active because `10.043-C` remains open.

## New

- `devlog/_plan/260628_jwc_native_chase_implementation/251_phase25_search_provider_mapping_audit.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/252_phase25_search_provider_mapping_build.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/253_phase25_search_provider_mapping_check.md`

## Non-goals

- Do not add `ActiveSearchModelContext` or baseUrl-aware resolver API in this slice.
- Do not add an `openai-compatible` search provider adapter.
- Do not change provider selection behavior beyond focused tests/documentation unless audit finds an actual JWC bug.
- Do not close `10.043`; `10.043-C` remains open.

## Verification

- `bun test packages/coding-agent/test/tools/web-search-duckduckgo.test.ts`
- `cd packages/coding-agent && bun run check:types`
- `git diff --check -- packages/coding-agent/test/tools/web-search-duckduckgo.test.ts struct_har/chase/10.043_gjc_chase_web_search_insane_security.md devlog/_plan/260628_jwc_native_chase_implementation/250_phase25_search_provider_mapping_plan.md devlog/_plan/260628_jwc_native_chase_implementation/251_phase25_search_provider_mapping_audit.md devlog/_plan/260628_jwc_native_chase_implementation/252_phase25_search_provider_mapping_build.md devlog/_plan/260628_jwc_native_chase_implementation/253_phase25_search_provider_mapping_check.md`

## Commit plan

One atomic commit:

- `test(web-search): pin native provider mapping guards`
