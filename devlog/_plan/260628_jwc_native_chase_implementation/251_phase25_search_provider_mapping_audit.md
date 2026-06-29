# Phase 25 Audit — 10.043-B search provider mapping guard

## Result

Backend final plan audit: PASS.

## Findings

- Upstream `6527ee01` guards direct `provider: "openai"` -> hosted Codex mapping when an active model context has a local `baseUrl`.
- JWC `resolveProviderChain()` currently receives only `activeModelProvider?: string`, not active model `baseUrl` or wire API context.
- Tests-only hardening is appropriate for local registry provider aliases because `ollama`, `llama.cpp`, and `lm-studio` are absent from JWC `MODEL_PROVIDER_TO_SEARCH` and should fall through to DuckDuckGo.
- Exact upstream `provider: "openai"` + local `baseUrl` denial remains deferred until JWC introduces an active model context into resolver inputs.

## Evidence

- Plan: `devlog/_plan/260628_jwc_native_chase_implementation/250_phase25_search_provider_mapping_plan.md`
- Backend audit verdict: PASS from `cli-jaw dispatch --agent Backend`
