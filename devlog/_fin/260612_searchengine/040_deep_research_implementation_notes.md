# 040 Deep research — implementation notes

> 상태: 리서치 진행 ✅
> 범위: product source mutation 없이 현재 코드 기준으로 `/SEARCHENGINE` 구현 가능성/위험을 구체화한다.

## 1. Slash command wiring

Primary file: `packages/coding-agent/src/slash-commands/builtin-registry.ts`.

Relevant facts:

- Builtins are declared in `BUILTIN_SLASH_COMMAND_REGISTRY`.
- Alias lookup is exact string matching through `BUILTIN_SLASH_COMMAND_LOOKUP`.
- `parseSlashCommand()` preserves command case; it does **not** lowercase the command name.
Therefore user-facing command support can stay canonical-lowercase (`/searchengine`). Uppercase `/SEARCHENGINE` in discussion/docs is emphasis for importance, not a required separate command surface. Case-insensitive builtin lookup remains an optional polish item, not MVP scope. Minimal builtin shape:

```ts
{
  name: "searchengine",
  aliases: ["search", "search-engine"],
  description: "Select web search provider",
  inlineHint: "[auto|chatgpt|duckduckgo|anthropic|gemini|exa]",
  allowArgs: true,
  handle: async (command, runtime) => { ... }
}
```

Because TUI dispatch adapts `handle` automatically when `handleTui` is absent, one handler can serve TUI and ACP-style builtin dispatch.

## 2. Runtime + persistence seam

Existing primitives:

- `runtime.settings.set("providers.webSearch", normalized)` persists to global config and queues save.
- `setPreferredSearchProvider(normalized)` updates the process-global in-memory search preference.
- `runtime.notifyConfigChanged?.()` is the existing pattern used by `/model` and `/provider` after config mutation.

Important: `Settings.set()` has no current hook for `providers.webSearch`. The settings selector manually calls `setPreferredSearchProvider()` in `selector-controller.ts`. A slash command must do the same or the current process can keep using the previous provider until restart/reload.

Two implementation choices:

| choice | tradeoff | recommendation |
|---|---|---|
| Slash command calls both `settings.set()` and `setPreferredSearchProvider()` | Small, matches selector-controller pattern | MVP |
| Add a `SETTING_HOOKS["providers.webSearch"]` hook | More central, requires importing web search runtime into config layer | Later cleanup only if duplication grows |

## 3. Status output details

Status should be informative but not trigger heavy provider loads or credential refreshes.

Safe status fields:

- persisted setting: `runtime.settings.get("providers.webSearch")`
- active model provider: `runtime.session.model?.provider`
- alias table: static strings
- chain policy: static explanation (`auto` => active native if available, then DuckDuckGo)

Potentially unsafe/expensive status fields:

- calling `resolveProviderChain()` loads provider modules and calls `isAvailable()`; most checks are cheap, but it still expands surface and can touch settings/env/authStorage.
- calling provider `search()` is out of scope.

Recommendation: MVP status should not probe credentials. A later `status --probe` can resolve availability if needed.

## 4. Provider behavior already present

`resolveProviderChain()` already implements the core desired policy:

1. Explicit preference (`providers.webSearch != auto`) wins **only if available**.
2. `auto` maps the active model provider to native search when credentials exist.
3. DuckDuckGo is always appended as terminal fallback.

That means `/SEARCHENGINE auto` already means “active provider native search if supported/credentialed, else DDG”. No new routing engine is needed.

## 5. ChatGPT/OpenAI native search path

ChatGPT native search is represented by provider id `codex`.

Observed implementation:

- `providers/codex.ts` calls `https://chatgpt.com/backend-api/codex/responses`.
- request uses `tools: [{ type: "web_search", search_context_size: "high" }]` and `tool_choice: { type: "web_search" }`.
- availability is `authStorage.hasOAuth("openai-codex")`.
- actual request gets OAuth through `authStorage.getOAuthAccess("openai-codex", sessionId, ...)`.
- model override is `PI_CODEX_WEB_SEARCH_MODEL`; tests cover default, fallback, override, citation extraction.

So the human-facing alias should be:

- `/SEARCHENGINE chatgpt` -> stored `codex`
- `/SEARCHENGINE openai` -> stored `codex`
- `/SEARCHENGINE codex` -> stored `codex`

## 6. Exa position

Exa is not the global default in the current chain. It appears in `SEARCH_PROVIDER_ORDER`, but `resolveProviderChain()` does not iterate that order for auto-selection; it only uses explicit preference or active-model native provider, then DuckDuckGo.

Exa can still become primary when:

- user sets `providers.webSearch=exa`, and
- `EXA_API_KEY` exists, and
- `exa.enabled !== false`, and
- `exa.enableSearch !== false`.

Therefore the fix is not “remove Exa”; it is “make switching away from Exa immediate and obvious”.

## 7. Minimal test targets

Add focused tests rather than broad web tests:

1. Normalization unit tests:
   - `chatgpt/openai/codex -> codex`
   - `ddg/duck/duckduckgo -> duckduckgo`
   - `active/native/auto -> auto`
   - invalid value returns undefined and does not mutate.
2. Slash handler test:
   - `/searchengine chatgpt` dispatches and stores the canonical provider; optional polish can separately cover uppercase builtin lookup.
   - `settings.set("providers.webSearch", "codex")` is called.
   - runtime output confirms `codex` and mentions DuckDuckGo fallback.
3. Status test:
   - `/searchengine` prints current setting and alias list.
4. Provider chain unit test if currently absent:
   - `auto + activeModelProvider=openai-codex + authStorage.hasOAuth("openai-codex")` produces `[codex, duckduckgo]`.
   - `auto + no native creds` produces `[duckduckgo]`.
   - explicit unavailable provider falls back to `[duckduckgo]`.

## 8. Concrete implementation checklist

1. Import `setPreferredSearchProvider` from `../web/search/provider` and `isSearchProviderPreference` from `../web/search/types` to avoid the broad `../tools` barrel.
2. Add pure helper `normalizeSearchEngineArg(raw: string)` near other parser helpers.
3. Add `searchengineUsage(runtime, reason?)` or static usage string.
4. Add builtin registry entry after `/tools` or near `/provider`.
5. Keep no-arg/status read-only.
6. Persist + runtime-update + notify on valid provider.
7. Add tests in `test/slash-commands/session-slash-surface.test.ts` or a focused new `searchengine-slash.test.ts`.

## Verdict

통합 가능성 높음. 현재 core provider layer는 이미 요구사항의 70–80%를 갖고 있고, 남은 것은 operator UX다. MVP는 slash command + alias/status 문서화로 충분하며, provider 재작성이나 `web_search` tool schema 변경은 오히려 위험하다.
