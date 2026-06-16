# 010 Research — current web_search implementation

> 상태: 스캐폴딩 ✅
> 기준 리포: `700_projects/jawcode`

## Files inspected

| 파일 | 관찰 |
|---|---|
| `packages/coding-agent/src/web/search/index.ts` | `web_search` tool, schema, `executeSearch()`, `runSearchQuery()`, active model provider 전달 |
| `packages/coding-agent/src/web/search/provider.ts` | lazy provider registry, active-model native mapping, fallback chain |
| `packages/coding-agent/src/web/search/types.ts` | `SearchProviderId` union과 preference guard |
| `packages/coding-agent/src/config/settings-schema.ts` | `providers.webSearch` enum + UI options |
| `packages/coding-agent/src/sdk.ts` | startup에서 setting → `setPreferredSearchProvider()` 초기화 |
| `packages/coding-agent/src/modes/controllers/selector-controller.ts` | settings UI 변경 시 runtime setter 호출 |
| `packages/coding-agent/src/web/search/providers/codex.ts` | ChatGPT/OpenAI native `web_search` tool via Codex Responses backend |
| `packages/coding-agent/src/web/search/providers/exa.ts` | Exa API provider, env key 필요, explicit provider로 유지 가능 |

## Existing provider chain

`resolveProviderChain(authStorage, preferredProvider, activeModelProvider)` 동작:

1. `preferredProvider !== "auto"`이면 해당 provider가 available일 때 chain에 넣음.
2. `auto`이고 active model provider가 있으면 native search mapping을 찾고 available이면 chain에 넣음.
3. 항상 DuckDuckGo를 terminal fallback으로 append.

Active model mapping:

| active model provider | search provider |
|---|---|
| `openai`, `openai-codex`, `openai-responses` | `codex` |
| `anthropic` | `anthropic` |
| `google`, `google-gemini-cli`, `google-antigravity`, `gemini` | `gemini` |
| `moonshot`, `kimi-code`, `kimi` | `kimi` |
| `zai` | `zai` |
| `perplexity` | `perplexity` |
| `synthetic` | `synthetic` |

## Important implication

사용자가 원하는 “활성 프로바이더로 바꿔끼우기”는 대부분 이미 `auto`로 구현되어 있다. 남은 gap은:

- 현재 상태를 쉽게 보는 slashline 부재.
- `chatgpt` 같은 인간 친화 alias 부재.
- Exa를 피하고 ChatGPT native search로 고정하는 빠른 표면 부재.
- provider별 지원 범주를 한눈에 보여주는 UX 부재.

## Exa position

Exa provider는 삭제하지 않는다. 다만 기본 경로에서 밀어내고, explicit 선택 대상으로만 남기는 것이 안전하다. 현재 provider order에도 DuckDuckGo/Tavily/Perplexity/Brave/Jina/Kimi/Anthropic/Gemini/Codex/ZAI 뒤에 Exa가 위치하므로, `auto`에서는 active native 또는 DuckDuckGo fallback이 핵심이다.

## Implementation seams

- Slash command registry: `packages/coding-agent/src/slash-commands/builtin-registry.ts`
- Existing command patterns: `/model`, `/effort`, `/provider`
- Runtime mutation primitives: `runtime.settings.set("providers.webSearch", value)` + `setPreferredSearchProvider(value)` + `runtime.notifyConfigChanged?.()`
- Type guard: `isSearchProviderPreference(value)`

## Risk

`setPreferredSearchProvider()` currently stores process-global module state. Slash command must update settings and runtime preference together; otherwise current session and persisted config diverge.
