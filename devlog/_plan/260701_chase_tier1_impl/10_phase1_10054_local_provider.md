# WP1 — 10.054 local OpenAI-compatible provider discovery + fallback (IMPORT)

> PABCD P phase plan · source GJC `fa995807` · 판정 IMPORT (JWC식 재설계, gjc 리터럴 금지)
> 의존 없음 (클러스터 A 진입점). 후속 10.062/20.023이 이 provider 표면 위에 쌓임.

## Ground truth (조사 완료)
- GJC 소스 5 commit: `3e226b3c`(discovery) `3971c33f`(diagnostics) `c90762eb`(role 해석) `f8f4c2ab`(fallback) `f31a3a0c`(registry guard) + 테스트 `68a94513`/`522867c0`.
- GJC 파일: `cli/local-provider-smoke.ts`(~640 export 다수), `commands/local-provider.ts`(@gajae-code/utils/cli Command), `slash-commands/builtin-registry.ts`, `session/agent-session.ts`.
- JWC 현황: local-provider 명령 **없음**. `@jawcode-dev/utils/cli` Command 체계 존재(grep.ts/commit.ts 패턴). ai providers에 `ollama.ts`·`openai-completions-compat.ts`·`openai-responses-shared.ts` 등 OpenAI-compatible 기반 존재.

## Scope (IN / OUT)
IN:
- NEW `packages/coding-agent/src/cli/local-provider-smoke.ts` — discovery/status/smoke/diagnose 코어 (JWC 네이밍, `.jwc` config, ModelsConfig는 JWC 타입 사용).
- NEW `packages/coding-agent/src/commands/local-provider.ts` — `@jawcode-dev/utils/cli` Command 래퍼.
- MODIFY `slash-commands/builtin-registry.ts` — `/model` 류에 local provider role 해석 + missing-registry guard.
- MODIFY `session/agent-session.ts` — unavailable local provider fallback 경로.
- NEW test `test/local-provider-smoke.test.ts` + agent-session fallback test.
OUT:
- gjc 리터럴/`@gajae-code/*` import 금지 → JWC 네이밍.
- models.json 구조 대규모 변경 금지 (config 읽기만; provider catalog 변경은 WP2/WP3).
- 다른 14 카드 표면 금지.

## Design (diff-level, A phase에서 정밀화)
1. `local-provider-smoke.ts`: GJC export 시그니처(getLocalOpenAICompatConfig, runLocalProviderDiscover/Status/Smoke + *Command 래퍼) 재구현. 타입은 JWC `ModelsConfig` 재사용, `@gajae-code/utils` → `@jawcode-dev/utils` 대응.
2. `commands/local-provider.ts`: actions=[status,diagnose,discover,models,smoke], default=status. JWC Command/Flags/Args.
3. `builtin-registry.ts`: local provider role-model 해석 + 레지스트리 누락시 안전 폴백(f31a3a0c).
4. `agent-session.ts`: 구성된 local provider 도달 불가 시 graceful fallback(f8f4c2ab).

## Invariants
- gjc/gajae 리터럴 0 (키·help·식별자 전부 jwc/.jwc).
- local provider 미구성 시 기존 동작 무회귀 (additive only).
- 도달 불가 endpoint → 명확한 진단 + fallback, 크래시 금지.

## Acceptance
| # | criterion | verify |
|---|---|---|
| 1 | `local-provider` 명령 등록·status 동작 | focused test |
| 2 | discovery가 OpenAI-compat /models 파싱 | smoke test |
| 3 | unavailable fallback 비크래시 | agent-session fallback test |
| 4 | missing registry guard | builtin-registry test |
| 5 | gjc 리터럴 0 | `rg -i "gjc|gajae" 신규파일` = 0 |
| 6 | 타입/린트 | `bun run check:ts` (워크스페이스 focused) |

## Verification 명령
```bash
bun test packages/coding-agent/test/local-provider-smoke.test.ts
bun test packages/coding-agent/test/agent-session-retry-fallback.test.ts
rg -i "gjc|gajae|@gajae-code" packages/coding-agent/src/cli/local-provider-smoke.ts packages/coding-agent/src/commands/local-provider.ts
git -C . diff --check
```

## PABCD plan
- P(이 문서) → A(독립 explorer/Backend가 GJC 5 commit 정밀 분석 + JWC ModelsConfig 타입 적합성·블로커 검증) → B(구현+테스트) → C(focused test+check:ts+diff --check) → D(요약·_fin 이전).

## Depends / feeds
- depends: 없음
- feeds: WP2(10.062), WP3(20.023) provider 표면
