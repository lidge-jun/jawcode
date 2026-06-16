# 020 Plan — `/SEARCHENGINE` slashline

> 상태: 스캐폴딩 ✅
> 목표: web search provider를 세션 중 즉시 확인/전환한다.

## Command shape

Canonical command: `/searchengine`
Aliases: `/search`, `/search-engine`. Uppercase `/SEARCHENGINE` in planning prose is emphasis, not an MVP dispatch requirement; canonical implementation stays lowercase.

```text
/searchengine
/searchengine status
/searchengine auto
/searchengine chatgpt
/searchengine openai
/searchengine codex
/searchengine anthropic
/searchengine gemini
/searchengine duckduckgo
/searchengine exa
```

## Alias normalization

| input | stored `providers.webSearch` |
|---|---|
| `auto`, `active`, `native` | `auto` |
| `chatgpt`, `openai`, `codex` | `codex` |
| `claude`, `anthropic` | `anthropic` |
| `google`, `gemini` | `gemini` |
| `ddg`, `duck`, `duckduckgo` | `duckduckgo` |
| existing provider ids | same id |

## Handler pseudocode

```ts
function normalizeSearchEngineArg(raw: string): SearchProviderId | "auto" | undefined {
  const value = raw.trim().toLowerCase();
  if (!value || value === "status") return undefined;
  if (["active", "native"].includes(value)) return "auto";
  if (["chatgpt", "openai", "codex"].includes(value)) return "codex";
  if (["claude", "anthropic"].includes(value)) return "anthropic";
  if (["google", "gemini"].includes(value)) return "gemini";
  if (["ddg", "duck", "duckduckgo"].includes(value)) return "duckduckgo";
  return isSearchProviderPreference(value) ? value : undefined;
}
```

Handler steps:

1. No args/status: print current `providers.webSearch`, active model provider, and aliases.
2. Normalize arg.
3. If invalid: print usage, do not mutate.
4. Persist `runtime.settings.set("providers.webSearch", normalized)`.
5. Call `setPreferredSearchProvider(normalized)`.
6. Call `runtime.notifyConfigChanged?.()`.
7. Output concise confirmation and fallback explanation.

## Output examples

```text
Search engine: auto
Active model provider: openai-codex → native search: codex
Fallback: duckduckgo
Set with: /SEARCHENGINE chatgpt|auto|duckduckgo|anthropic|gemini|exa
```

```text
Search engine set to codex (ChatGPT/OpenAI native web_search). Fallback remains DuckDuckGo.
```

## Tests

- `normalizeSearchEngineArg("chatgpt") === "codex"`.
- Invalid value does not call settings setter.
- Handler persists `providers.webSearch` and calls `setPreferredSearchProvider`.
- Status output includes current setting and aliases.

## Non-goals

- Do not add provider-specific credentials flow here; `/login` and `/provider` own auth.
- Do not remove Exa.
- Do not change `web_search` tool schema.
