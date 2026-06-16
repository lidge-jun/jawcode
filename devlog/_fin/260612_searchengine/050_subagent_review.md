# 050 Subagent review — searchengine plan

> 상태: 리뷰 반영 ✅
> 리뷰어: `3-SearchSlashAudit`, `4-SearchProviderAudit`

## Slash audit findings

`3-SearchSlashAudit` verdict: feasible, `WATCH`.

Key points accepted:

- `/SEARCHENGINE` is feasible as a builtin slash command.
- Current builtin slash lookup is case-sensitive; uppercase input fails without either lookup normalization or explicit uppercase alias.
- The handler must persist canonical `providers.webSearch` values only; human aliases stay local to command parsing.
- `settings.ts` currently has no `providers.webSearch` hook, so the command must update both:
  - `runtime.settings.set("providers.webSearch", canonical)`
  - `setPreferredSearchProvider(canonical)`
- Import preference runtime pieces directly from web search modules rather than through the broad `../tools` barrel when possible:
  - `../web/search/provider` for `setPreferredSearchProvider`
  - `../web/search/types` for `isSearchProviderPreference` / provider ids

## Case-handling decision

User clarified that `/SEARCHENGINE` was written uppercase for emphasis; implementation can be lowercase. Therefore the MVP does **not** require uppercase aliasing or global builtin case-insensitive lookup.

Recommended implementation: ship canonical `/searchengine` plus lowercase aliases (`/search`, `/search-engine`). Keep builtin lookup normalization as optional later polish, not a dependency of this feature.

## Provider audit findings

`4-SearchProviderAudit` completed but produced only a compact receipt in the retained output. Main-session code inspection covers the provider-chain facts:

- `auto` already means active-model native search when available, then DuckDuckGo.
- `codex` is the ChatGPT/OpenAI native search provider.
- Exa is not auto-selected by the current resolver; it becomes primary only by explicit preference and available API key/settings.
- The missing product surface is command UX/status/aliases, not provider plumbing.

## Test refinements from review

Add tests for:

1. Uppercase command dispatch (`/SEARCHENGINE chatgpt`).
2. Canonical persistence (`chatgpt` stores `codex`).
3. Runtime preference setter call or observable provider preference update.
4. Invalid arg does not mutate settings.
5. Status output does not require credentials/probing.

## Updated recommendation

Implement `/searchengine` as a small builtin command. Do not rewrite `web_search`, do not delete Exa, and do not add provider credentials flows. The safest MVP is slash UX over the existing `providers.webSearch` setting and resolver chain.
