# WP1-B — 10.054 local provider role resolution + unavailable fallback (IMPORT)

> PABCD P phase plan · source GJC `c90762eb`(role resolution) `f31a3a0c`(missing-registry guard) `f8f4c2ab`(unavailable fallback) · 판정 IMPORT (JWC식 재설계, gjc 리터럴 금지)
> WP1-A(8b3b861+f8838a4)에서 분리된 후속. local-provider CLI 표면 위에 세션/슬래시 통합을 쌓는다.

## Ground truth (조사 완료)
- JWC `slash-commands/builtin-registry.ts:178` `resolveModelCommandSelection`은 동기 단일 함수 (GJC와 구조 다름: JWC는 `resolveCanonicalModel`+`modelsAreEqual` 사용). `:677`에서 호출.
- JWC `config/model-registry.ts`에 필요한 메서드 전부 존재: `refreshProvider`(:1061), `getDiscoverableProviders`(:2425), `getProviderDiscoveryState`(:2432), `resolveCanonicalModel`(:2391). `ProviderDiscoveryState`(:502) = {provider,status,optional,stale,fetchedAt?,models[],error?}. `ProviderDiscoveryStatus`에 unavailable/unauthenticated/empty 포함.
- JWC `config/model-resolver.ts:39` `parseModelString` export 존재.
- JWC `session/agent-session.ts`: retry-fallback 인프라 완비 — `#classifyErrorForRetry`(:8274, union에 first_event_timeout 없음/GJC보다 단순), `#isRetryableError`(:8224), `#tryRetryModelFallback`(:8461), `#findRetryFallbackCandidates`(:8408), `formatRetryFallbackSelector`(:551), `#modelRegistry.find`, `#isRetryFallbackSelectorSuppressed`, `#resolveRetryFallbackRole`, `#activeRetryFallback`. retry 실행부 `:8629` currentSelector→`#tryRetryModelFallback`.
- `Model`(ai/types.ts:880) = {provider:Provider, baseUrl:string, ...}. `Provider = KnownProvider|string`; KnownProvider에 ollama/lm-studio 포함.

## Scope (IN / OUT)
IN:
- MODIFY `slash-commands/builtin-registry.ts` — `/model` 선택을 async 2단계로: (1) available에서 해석 (2) 실패 시 provider-qualified selector면 discoverable provider refresh 후 재해석, 그래도 실패면 discovery-state 기반 구체적 실패 메시지. `f31a3a0c` optional-chaining guard(`modelRegistry?.getDiscoverableProviders?.()`) 포함.
- MODIFY `session/agent-session.ts` — `local_unavailable` 분류 추가: `isLocalModelEndpoint(model)`(provider==ollama/lm-studio/llama.cpp or baseUrl hostname이 localhost/127./10./192.168./172.16-31/::1/.local) && availability-error 메시지면 분류. `#isRetryableError`/retry 경로에서 `requireNonLocal:true`로 non-local fallback 후보가 있을 때만 retry. `#tryRetryModelFallback`/`#hasRetryFallbackCandidate`에 `requireNonLocal` 옵션.
- NEW test `test/agent-session-retry-fallback.test.ts` (또는 기존 확장) — local_unavailable → non-local fallback, fallback 후보 없으면 surface, malformed baseUrl는 unavailable 아님.
OUT:
- gjc/gajae 리터럴·`@gajae-code/*` 금지. `GJC_MODEL_ASSIGNMENT_TARGETS` 등 기존 JWC 식별자는 건드리지 않음(이미 JWC 코드).
- models.json catalog 변경 금지(WP2/WP3). CLI 코어(WP1-A) 재변경 금지.
- 다른 13 카드 표면 금지.

## Design (diff-level)
1. **builtin-registry.ts**:
   - ADD `interface ModelCommandSelection`, `ModelCommandResolution = {ok:true,selection}|{ok:false,failure:{message}}`.
   - ADD `parseProviderQualifiedSelector(selector)` via `parseModelString(splitExplicitThinkingSelector(selector).baseSelector)`.
   - RENAME 기존 `resolveModelCommandSelection` body → `resolveModelCommandSelectionFromAvailable(runtime, selector, availableModels)` (JWC canonical 로직 보존).
   - ADD async `resolveModelCommandSelection(runtime, selector): Promise<ModelCommandResolution>` — fromAvailable 시도→provider-qualified+discoverable면 `refreshProvider(provider,"online")` 후 재시도→`formatDiscoverableProviderFailure`. `getDiscoverableProviders?.()`/`getProviderDiscoveryState?.()` optional-chain(f31a3a0c).
   - ADD `formatDiscoverableProviderFailure(selector,provider,modelId,runtime)` — discovery state status별 메시지.
   - `:677` 호출부 → `await` + `resolution.ok` 분기.
2. **agent-session.ts**:
   - ADD `type RetryErrorClassification` (기존 union + `local_unavailable`); `#classifyErrorForRetry` 반환형 교체.
   - ADD module-scope `isLocalModelEndpoint(model)`.
   - ADD `#isLocalProviderAvailabilityErrorMessage(err)`.
   - `#classifyErrorForRetry`: overflow 체크 직후 `if (isLocalModelEndpoint(this.model) && this.#isLocalProviderAvailabilityErrorMessage(err)) return "local_unavailable";`.
   - `#isRetryableError`: `local_unavailable`면 `#hasRetryFallbackCandidate({currentSelector, requireNonLocal:true})`.
   - ADD `#hasRetryFallbackCandidate(options)`.
   - `#tryRetryModelFallback(currentSelector, options?)`에 `requireNonLocal` 추가 + 후보 루프에서 local 후보 skip.
   - retry 실행부(:8629 인근): `localUnavailable = classification==="local_unavailable"`; `#tryRetryModelFallback(currentSelector, {requireNonLocal: localUnavailable})`.

## Invariants
- gjc/gajae 리터럴 0 (신규/수정 라인 기준).
- local provider 미구성/비-local 모델 → 기존 retry 동작 무회귀 (additive: 새 분류는 isLocalModelEndpoint일 때만 진입).
- malformed baseUrl은 availability 아님(config 문제로 surface) — GJC 주석 보존.
- non-local fallback 후보 없으면 local_unavailable은 retryable 아님(무한 로컬 재시도 방지).

## Acceptance
| # | criterion | verify |
|---|---|---|
| 1 | local_unavailable 분류가 local endpoint + availability err에만 적용 | unit test |
| 2 | local_unavailable → non-local fallback 후보 있으면 retry, 없으면 surface | fallback test |
| 3 | malformed baseUrl는 local_unavailable 아님 | unit test |
| 4 | /model provider-qualified 미발견 시 discoverable refresh 후 재시도 | (registry-state 기반 메시지) test 또는 타입+수동 |
| 5 | missing modelRegistry guard 비크래시 | optional-chain |
| 6 | gjc 리터럴 0 / 타입·린트 | rg + tsgo + biome |

## Verification 명령
```bash
bun test packages/coding-agent/test/agent-session-retry-fallback.test.ts
rg -i "gjc|gajae|@gajae-code" <touched lines>
cd packages/coding-agent && bun run check:types
bunx biome check <files>
git diff --check
```

## PABCD plan
- P(이 문서) → A(독립 리뷰어가 GJC 3 commit vs JWC 분류기 차이(first_event_timeout 부재)·retry 실행부 정합성·registry 메서드 시그니처 검증) → B(구현+테스트) → C(focused test+check:ts+diff) → D(요약·카드 _fin 이전 + WP1 전체 종료 판정).

## Depends / feeds
- depends: WP1-A(local-provider CLI, 8b3b861+f8838a4)
- feeds: 카드 10.054 closure(_fin/10), 그 다음 WP2(10.062)

## A-phase audit (self-conducted, 2026-07-01) — VERDICT: PASS
- 독립 explorer 디스패치는 429 rate-limit로 실패 → 메인이 JWC 실코드 대조로 직접 감사 수행.
- 검증 완료(실현성/블로커/회귀/네이밍 PASS):
  - `#classifyErrorForRetry`(:8274) 반환 union은 GJC보다 단순(`first_event_timeout` 없음) — 계획이 이미 반영, `isContextOverflow` 직후 삽입 유효.
  - `#isRetryableError`(:8224), `#tryRetryModelFallback`(:8461), `#findRetryFallbackCandidates`(:8408), `formatRetryFallbackSelector`(:551), `#resolveRetryFallbackRole`/`#isRetryFallbackSelectorSuppressed`/`#modelRegistry.find`/`#activeRetryFallback` 전부 존재.
  - retry 실행부 `#handleRetryableError`(:8574): `retryClassification` 상단 계산, `#tryRetryModelFallback(currentSelector)` `:8632` → `{requireNonLocal: localUnavailable}` 추가 안전.
  - `resolveModelCommandSelection` 호출자 유일(`:677`), `async (command, runtime)` 핸들러 내부 → `await` 합법.
  - `ProviderDiscoveryStatus`(:500) = idle|ok|empty|cached|unavailable|unauthenticated. `formatDiscoverableProviderFailure`는 unavailable/unauthenticated/empty 명시 분기 + idle/cached는 generic fallthrough로 처리.
  - `parseModelString`(model-resolver.ts:39) → {provider,id,thinkingLevel?}. KnownProvider(types.ts:139-148)에 ollama/lm-studio 포함, llama.cpp는 `Provider=KnownProvider|string`로 타입 유효.
- Fold-in: `formatDiscoverableProviderFailure`에서 idle/cached status는 GJC의 trailing generic 메시지로 처리(명시 분기 불필요).
