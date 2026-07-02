# Phase 10 — close 10.069 provider/search/docs/model support

## Decision

Close `10.069` as a mixed evidence card:

- ADAPT/already-covered: Claude usage 429 retry and `Retry-After` handling exist in JWC.
- ADAPT/already-covered: Tavily provider implementation and docs/env-var references exist in JWC.
- REJECT/no-adopt: GJC's Aside backend was added and then reverted upstream.
- TRACK elsewhere: generated Claude model catalog updates and DeepSeek prompt-cache usage remain provider-catalog/usage concerns, not a direct manual docs/code patch in this card.

## Source anchors

`git -C devlog/_gjc_chase/gajae-code show --stat --oneline 74d4eed9 3be90193 8b73c824 c521b7c9 cbe17440`

- `74d4eed9 fix(ai): keep generic long retry-after rate limits retryable (#1370)`
- `3be90193 fix(ai): surface Anthropic hard 429 before stream watchdog (#1369)`
- `8b73c824 feat(web-search): document Tavily provider selection (#1324)`
- `c521b7c9 feat: add Claude Sonnet 5 model support (#1333)`
- `cbe17440 fix(ai): map DeepSeek prompt cache usage (#1330)`

## JWC evidence

- `packages/ai/src/usage/claude.ts`
- `packages/ai/test/claude-usage-retry.test.ts`
- `packages/utils/src/fetch-retry.ts`
- `packages/coding-agent/src/web/search/providers/tavily.ts`
- `docs/tools/web_search.md`
- `docs/environment-variables.md`
- `struct_har/chase/_fin/10/10.036_gjc_chase_ai_provider_auth_model_catalog.md`
- `struct_har/chase/_fin/20/20.023_omp_chase_ai_providers_catalog_service_tier.md`

## Patch

- Move `struct_har/chase/10.069_gjc_chase_provider_search_docs_model_support.md` to `_fin/10`.
- Update follow/gap/MOC indexes from open to `_fin`.
- Update `_fin` indexes with the new completed card row.

## Verification

Run:

```bash
bun test packages/ai/test/claude-usage-retry.test.ts
git diff --check
```
