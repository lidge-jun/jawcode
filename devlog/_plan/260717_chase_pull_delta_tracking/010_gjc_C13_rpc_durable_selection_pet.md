# 010_gjc_C13_rpc_durable_selection_pet

> Range: `4a80bac9..3ddf26079`
> Cluster: C13 — RPC durable selection/pet
> Sol priority: P3
> Model-related: ✓ partial
> Card target: 10.101_rpc_durable_selection_pet
> Worker: GW6

이 클러스터는 RPC에서 선택한 기본 모델을 세션과 설정에 안전하게 승격하고, 저장 실패 시 이전 선택으로 되돌리는 흐름을 묶는다. 같은 선택기 표면을 사용하는 Gajae Pet의 opt-in, skin picker, composer 복원과 종료 정리도 함께 추적한다.

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `f590b2beb` | feat(coding-agent): capability-aware Gajae Pet selection UX (#2187) | `packages/coding-agent/src/modes/components/` |
| 2 | `5e8693d6b` | fix(tui): retain final pet cleanup until delivery (#2188) | `packages/tui/`, pet teardown |
| 3 | `533d12cdf` | fix(coding-agent): make Gajae Pet overlay cleanup deterministic and exception-safe (rebased onto current dev) (#2182) | pet overlay lifecycle |
| 4 | `9994b0966` | test(coding-agent): satisfy pet restore check | pet restore contract |
| 5 | `17c5f668a` | fix(session): restore failed default selection | `session/agent-session.ts` |
| 6 | `7298aa701` | fix(coding-agent): restore pet-aware composer after ask-tool dialogs close | composer/pet integration |
| 7 | `09e406b85` | feat(coding-agent): capability-aware Gajae Pet selection UX (#2187) | `packages/coding-agent/src/modes/components/` |
| 8 | `88c0c708d` | fix(tui): retain final pet cleanup until delivery (#2188) | `packages/tui/`, pet teardown |
| 9 | `5523b7225` | fix(coding-agent): make Gajae Pet overlay cleanup deterministic and exception-safe (rebased onto current dev) (#2182) | pet overlay lifecycle |
| 10 | `a8b843a0a` | test(coding-agent): satisfy pet restore check | pet restore contract |
| 11 | `442e6ecf9` | fix(settings): restore stale default after failed save | settings rollback |
| 12 | `41c8e1f76` | fix(sdk): preserve durable thinking in model selection | SDK model selection |
| 13 | `c8c2d92b9` | fix(coding-agent): fence durable model promotion | model promotion authority |
| 14 | `d33aeef63` | fix(session): make default selection promotion atomic | session persistence |
| 15 | `1606f1956` | fix(session): restore failed default selection | session rollback |
| 16 | `767a8cc06` | test(rpc): survive the release changelog roll in the durable-default docs test | RPC durable-default docs contract |
| 17 | `9f6de8820` | fix(session): persist unchanged default thinking level | model thinking persistence |
| 18 | `3270ac1d2` | fix(session): defer default transcript persistence | deferred session persistence |
| 19 | `651f96484` | fix(session): roll back failed default selection | session rollback |
| 20 | `0f5b5e331` | docs(coding-agent): restore Unreleased RPC entry | coding-agent changelog |
| 21 | `ee399f1d1` | fix(rpc): handle deferred selection saves | RPC client/session save |
| 22 | `b5fe9c3c0` | docs(rpc): document durable default model selection | RPC reference |
| 23 | `82b5159b8` | feat(rpc): add durable default model selection | RPC protocol and client |
| 24 | `4813b20a5` | feat(pet): opt-in terminal Gajae pet with skin picker (#2021) | pet widget and settings |
| 25 | `7914a2467` | fix(coding-agent): wire unsubscribe for the pet protocol-change listener | pet listener lifecycle |
| 26 | `2bff94720` | fix(coding-agent): restore pet-aware composer after ask-tool dialogs close | composer/pet integration |

## 주제 분석

핵심은 선택 상태를 화면에서 바꾸는 것과 durable default로 확정하는 것을 분리하는 데 있다. 저장이 지연되거나 실패해도 세션, transcript, thinking level이 서로 다른 기본값을 가리키지 않아야 한다. Pet은 동일한 selector/composer 생명주기를 사용하므로 capability 판정, overlay 종료, listener 해제까지 하나의 상태 전이로 검토해야 한다.

## model/ 교차 참조

- [ ] durable default와 thinking level이 `model/` 카탈로그의 실제 capability와 일치하는지 확인한다.
- [ ] RPC 선택 결과와 interactive `/model` 선택 결과가 동일한 저장·rollback 규칙을 쓰는지 대조한다.
- [ ] 카드 작성 시 C03의 preset/fallback 선택과 중복 구현하지 않고 경계를 명시한다.

## Worktree 대조

JWC에는 `packages/coding-agent/src/session/agent-session.ts`와 `packages/coding-agent/src/modes/rpc/rpc-client.ts`가 있고 현재 작업 트리에서도 수정 중이다. 반면 upstream의 `gajae-pet-widget.ts`는 현재 JWC에 없다. 따라서 durable selection은 기존 JWC 상태 흐름과 diff-level로 대조하고, Pet은 제품 채택 여부를 별도 결정해야 한다.

