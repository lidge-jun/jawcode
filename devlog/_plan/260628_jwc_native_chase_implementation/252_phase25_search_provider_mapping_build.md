# Phase 25 Build — 10.043-B search provider mapping guard

## Files changed

- `packages/coding-agent/test/tools/web-search-duckduckgo.test.ts`
- `struct_har/chase/10.043_gjc_chase_web_search_insane_security.md`

## Behavior pinned

- Local registry provider aliases `ollama`, `llama.cpp`, and `lm-studio` resolve to DuckDuckGo in auto web-search mode even when OpenAI/Codex OAuth exists.
- Hosted OpenAI provider string positive controls remain unchanged in the existing suite.
- No provider resolver API or runtime selection behavior was changed.

## Residual risk

- `provider: "openai"` with a local OpenAI-compatible `baseUrl` cannot be distinguished by JWC's current resolver signature and remains deferred.
- `10.043-C` remains open.
