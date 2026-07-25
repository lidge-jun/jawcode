# opencodex Anthropic Prompt Caching Optimization

## Objective
Port jawcode's Anthropic prompt-caching strategy to opencodex. jawcode uses up to 4 cache_control breakpoints with TTL support; opencodex currently only marks tools + system with a fixed 5-min ephemeral.

## Phases

| Phase | Description | Status | Cycle |
|-------|-------------|--------|-------|
| 10 | B-stage: Wire `buildRequest` to use new caching system, remove old `withPromptCache`/`EPHEMERAL_CACHE_CONTROL` refs | pending | P1 |
| 20 | B-stage: Pass `config.cacheRetention` from server into adapter, add tests | pending | P1 |

## Non-goals
- OpenAI prompt_cache_key changes (Codex manages this)
- Bedrock cachePoint (out of scope for opencodex)
- Cross-protocol cache key derivation
