# 060 Patch outline — `/SEARCHENGINE` MVP

> 상태: 구현 전 설계 ✅
> 목적: 실제 패치 시 손댈 파일과 순서를 고정한다.

## Files to change

1. `packages/coding-agent/src/slash-commands/builtin-registry.ts`
   - add imports:
     - `setPreferredSearchProvider` from `../web/search/provider`
     - `isSearchProviderPreference`, `type SearchProviderId` from `../web/search/types`
   - add `normalizeSearchEngineArg()` helper
   - add `searchengine` builtin command; case-insensitive builtin lookup is optional polish, not MVP
   - **spec MUST declare `allowArgs: true`** — without it the TUI dispatcher gate
     (`:1382`) refuses the args form and `/searchengine chatgpt` silently falls
     through to LLM chat ([cmd_audit P1](../../_fin/260613_cmd_audit/00_audit_slash_command_logic.md)
     — the exact `/model` bug repaired in `492913de`). Regression test must
     assert `command.allowArgs === true` like model-onboarding-guidance does.
2. `packages/coding-agent/test/slash-commands/searchengine-slash.test.ts` or existing slash surface test
   - command status
   - lowercase command dispatch
   - alias canonicalization
   - invalid arg no mutation

## Optional case-insensitive builtin lookup

Not required for MVP. If desired later, implement at builtin lookup boundary only:

```ts
const command = BUILTIN_SLASH_COMMAND_LOOKUP.get(parsed.name) ?? BUILTIN_SLASH_COMMAND_LOOKUP.get(parsed.name.toLowerCase());
```

Do not lowercase in `parseSlashCommand()`; that function is shared parsing, not builtin policy.

## Slash helper sketch

```ts
function normalizeSearchEngineArg(raw: string): SearchProviderId | "auto" | undefined {
  const value = raw.trim().toLowerCase();
  if (!value || value === "status") return undefined;
  if (["active", "native", "default"].includes(value)) return "auto";
  if (["chatgpt", "openai", "codex"].includes(value)) return "codex";
  if (["claude", "anthropic"].includes(value)) return "anthropic";
  if (["google", "gemini"].includes(value)) return "gemini";
  if (["ddg", "duck", "duckduckgo"].includes(value)) return "duckduckgo";
  return isSearchProviderPreference(value) ? value : undefined;
}
```

## Command behavior sketch

```ts
const current = runtime.settings.get("providers.webSearch");
const raw = command.args.trim();
if (!raw || raw.toLowerCase() === "status") {
  await runtime.output(formatSearchEngineStatus(current, runtime.session.model?.provider));
  return commandConsumed();
}
const next = normalizeSearchEngineArg(raw);
if (!next) return usage(searchEngineUsage(`Unknown search engine: ${raw}`), runtime);
runtime.settings.set("providers.webSearch", next);
setPreferredSearchProvider(next);
await runtime.notifyConfigChanged?.();
await runtime.output(`Search engine set to ${next}. Fallback remains DuckDuckGo.`);
return commandConsumed();
```

## Test harness note

The existing slash tests often mock `InteractiveModeContext`; this command is easier to test through `lookupBuiltinSlashCommand("searchengine")` or the adapted TUI dispatcher with a runtime containing:

- `settings.get` / `settings.set` spies
- `session.model.provider`
- `output` spy
- `notifyConfigChanged` spy

For dispatch coverage, use `executeBuiltinSlashCommand("/searchengine chatgpt", runtime)` and assert the editor clears / status output occurs.

## Non-MVP

- No `/searchengine off` until product decides whether disabling the `web_search` tool means tool deactivation, provider null, or per-turn refusal.
- No credential probing on status by default.
- No Exa removal.
- No `web_search` parameter schema changes.

---

## 구현 완료 기록 (260613)

블로커 리서치(Sonnet) 확인 사항과 실제 랜딩 형태:

- **`SETTING_HOOKS`에 `providers.webSearch` 훅 없음** (`settings.ts:889-923`) — `settings.set`이
  런타임 setter를 자동 호출하지 않으므로 **이중 기록(dual-write)이 필수** (스케치대로 랜딩).
  settings 셀렉터 UI 경로(`selector-controller.ts:655-658`)와 동일 패턴.
- **시작 시 1회 초기화** (`sdk.ts:861-863`) — 세션 중 변경의 유일한 반영 수단이 슬래시 핸들러의
  setter 호출임을 확인. `resolveProviderChain`의 기본 인자는 호출 시 평가라 캐싱 게이트 없음.
- **케이스 민감 확정**: `parseSlashCommand`·lookup 모두 exact-match. MOC 결정대로 대문자
  `SEARCHENGINE`을 명시 alias로 등재 (혼합 케이스는 비지원 — 060 optional polish 그대로 연기).
- **TUI 디스패처가 `handleTui`를 무조건 우선**하는 것을 발견 — `/model`의 P1 수리(`allowArgs`)만으로는
  TUI 인자형이 셀렉터로 빠져 인자가 버려졌다. 후속 처리: 디스패처의 어댑터를
  `adaptTuiSlashRuntime()`으로 추출하고 `/model handleTui`가 인자 존재 시 `handle`로 위임.
  `/searchengine`은 handle-only라 어댑터 자동 적용.
- status 표시용으로 `nativeSearchProviderFor()` getter를 `provider.ts`에 신설 (모듈 내부
  `MODEL_PROVIDER_TO_SEARCH` 비수출 유지).
- 테스트: `test/slash-commands/searchengine-slash.test.ts` 7케이스 (allowArgs 회귀 · 대문자 alias ·
  status 무변이 · chatgpt→codex 정규화+notify · 정식 id 직통 · auto 복원 · 무효 인자 무변이).
  슬래시 스위트 48 pass · tsc 0.
