# 010_gjc_C03_model_preset_fallback_selection

> Range: `4a80bac9..3ddf26079` (subset)
> Cluster: C03 — sticky model fallback, durable default selection, /model role overrides, codex preset reasoning, model cache, GPT-5.6 prompt cap
> Sol priority: P1
> Model-related: yes
> Card target: 10.091_model_preset_fallback_selection
> Worker: GW3

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `e0b4b0ee7` | fix: keep managed fallback local failures outside provider authority (#2433) | `packages/agent/src/agent-loop.ts`<br>`packages/agent/test/managed-attempt-transaction.test.ts` |
| 2 | `06f9ef013` | fix(coding-agent): recover in-TUI from missing model-profile credentials (#2290) | `packages/coding-agent/src/config/model-profile-activation.ts`<br>`packages/coding-agent/src/main.ts` |
| 3 | `f56d6b2c5` | fix(coding-agent): reuse model cache for list-models (#2259) | `packages/ai/test/model-manager-cache.test.ts`<br>`packages/coding-agent/src/main.ts` |
| 4 | `236ecf14c` | fix: enforce Codex GPT-5.6 prompt cap (#2260) | `packages/ai/src/context-cap-policy.ts`<br>`packages/ai/src/index.ts` |
| 5 | `289134891` | fix(ci): format model profile tests (#2193) | `packages/coding-agent/test/model-profile-activation.test.ts`<br>`packages/coding-agent/test/model-profiles-catalog.test.ts` |
| 6 | `f30323b2e` | fix(coding-agent): lower codex preset reasoning (#2190) | `packages/coding-agent/src/config/model-profiles.ts`<br>`packages/coding-agent/src/internal-urls/docs-index.generated.ts` |
| 7 | `5c76e5556` | fix(coding-agent): apply /model role overrides immediately (#2161) | `packages/coding-agent/src/modes/controllers/selector-controller.ts`<br>`packages/coding-agent/test/model-selector-controller-batch.test.ts` |
| 8 | `dffb55bb5` | test(coding-agent): compare retry models semantically | `packages/coding-agent/test/agent-session-retry-fallback.test.ts` |
| 9 | `17c5f668a` | fix(session): restore failed default selection | `packages/agent/src/agent.ts`<br>`packages/agent/src/types.ts` |
| 10 | `b12fb2573` | fix(coding-agent): serialize prompt and model admission (#2204) | `packages/agent/src/agent.ts`<br>`packages/coding-agent/src/session/agent-session.ts` |
| 11 | `08c58a87a` | fix(coding-agent): keep login reachable without model credentials | `packages/coding-agent/src/cli/args.ts`<br>`packages/coding-agent/src/main.ts` |
| 12 | `bceb66bab` | feat(models): sticky model fallback chains for presets and overrides (#2196) | `packages/agent/src/agent-loop.ts`<br>`packages/agent/src/agent.ts` |
| 13 | `851f71a97` | fix(ci): format model profile tests (#2193) | `packages/coding-agent/test/model-profile-activation.test.ts`<br>`packages/coding-agent/test/model-profiles-catalog.test.ts` |
| 14 | `851437508` | fix(coding-agent): lower codex preset reasoning (#2190) | `packages/coding-agent/src/config/model-profiles.ts`<br>`packages/coding-agent/src/internal-urls/docs-index.generated.ts` |
| 15 | `766fd86ea` | fix(coding-agent): apply /model role overrides immediately (#2161) | `packages/coding-agent/src/modes/controllers/selector-controller.ts`<br>`packages/coding-agent/test/model-selector-controller-batch.test.ts` |
| 16 | `fc6d8151e` | test(coding-agent): compare retry models semantically | `packages/coding-agent/test/agent-session-retry-fallback.test.ts` |
| 17 | `c8c2d92b9` | fix(coding-agent): fence durable model promotion | `packages/coding-agent/src/config/settings.ts`<br>`packages/coding-agent/src/session/session-manager.ts` |
| 18 | `d33aeef63` | fix(session): make default selection promotion atomic | `packages/coding-agent/src/config/settings.ts`<br>`packages/coding-agent/src/sdk/session.ts` |
| 19 | `1606f1956` | fix(session): restore failed default selection | `packages/agent/src/agent.ts`<br>`packages/agent/src/types.ts` |
| 20 | `767a8cc06` | test(rpc): survive the release changelog roll in the durable-default docs test | `packages/coding-agent/test/rpc-default-model-selection-docs.test.ts` |
| 21 | `651f96484` | fix(session): roll back failed default selection | `packages/coding-agent/src/config/settings.ts`<br>`packages/coding-agent/src/session/agent-session.ts` |
| 22 | `ee399f1d1` | fix(rpc): handle deferred selection saves | `packages/coding-agent/src/config/settings.ts`<br>`packages/coding-agent/src/modes/rpc/rpc-client.ts` |
| 23 | `b5fe9c3c0` | docs(rpc): document durable default model selection | `packages/coding-agent/src/internal-urls/docs-index.generated.ts`<br>`packages/coding-agent/test/rpc-default-model-selection-docs.test.ts` |
| 24 | `82b5159b8` | feat(rpc): add durable default model selection | `packages/bridge-client/src/commands.ts`<br>`packages/coding-agent/src/config/settings.ts` |
| 25 | `2f213136c` | feat(coordinator-mcp): authoritative model profile selection via mpreset (#2003) (#2073) | `packages/coding-agent/src/config/model-profile-activation.ts`<br>`packages/coding-agent/src/coordinator-mcp/model-preset.ts` |
| 26 | `cc661b43a` | feat(coding-agent): benchmark GPT-5.6 Codex presets (#2022) | `packages/coding-agent/src/config/model-profiles.ts`<br>`packages/coding-agent/src/internal-urls/docs-index.generated.ts` |

## 주제 분석

이 묶음은 모델 선택을 일회성 UI 상태가 아니라 재시도·역할·세션·RPC에 걸친 지속 계약으로 만든다. preset과 role override에는 sticky fallback chain을 적용하고, `/model` 역할 변경은 즉시 반영한다. 실패한 기본 모델 저장은 원자적으로 롤백하며, 성공한 선택만 durable default로 승격한다.

Codex preset reasoning 수준, GPT-5.6 prompt cap, model cache 재사용, profile credential 복구가 같은 선택 경로에 결합된다. JWC에서는 이미 존재하는 fallback 설정과 최신 provider/model catalog 변경이 충돌하지 않도록 resolver, selector, session persistence, RPC를 함께 검증해야 한다.

## Worktree 대조

JWC에는 일부 기반이 이미 있다. `packages/ai/src/model-cache.ts`는 SQLite 모델 캐시를 제공하고, `packages/coding-agent/src/session/agent-session.ts`는 역할별 fallback chain을 검증한다. `packages/coding-agent/src/config/settings-schema.ts`에는 기본 model profile 설정도 있다. 반면 upstream 표현 기준의 durable default RPC promotion/rollback과 GPT-5.6 prompt cap은 검색되지 않아 부분 반영 상태로 판단한다.

