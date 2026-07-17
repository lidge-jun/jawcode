# 010_gjc_C01_sdk_lifecycle_ledger

> Range: `4a80bac9..3ddf26079` (subset)
> Cluster: C01 — SDK lifecycle ledger crash-safety, PID reuse, receipt parsing, sibling ownership, compaction, fixture scope
> Sol priority: P1
> Model-related: no
> Card target: 10.087_sdk_lifecycle_ledger
> Worker: GW1

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `36f67ca8d` | test(coding-agent): integrate managed lifecycle fixture scope | `packages/coding-agent/test/helpers/sdk-lifecycle-fixture.ts` |
| 2 | `aab8fd5c6` | fix(coding-agent): recognize lifecycle PID reuse | `packages/coding-agent/src/sdk/broker/lifecycle.ts`<br>`packages/coding-agent/test/sdk-broker-lifecycle-e2e.test.ts` |
| 3 | `07cfe98b5` | fix(coding-agent): anchor lifecycle ledger compaction | `packages/coding-agent/src/sdk/broker/lifecycle-ledger.ts`<br>`packages/coding-agent/test/sdk-broker.test.ts` |
| 4 | `5a5fd00d3` | fix(coding-agent): serialize lifecycle ledger recovery | `packages/coding-agent/src/sdk/broker/broker.ts`<br>`packages/coding-agent/src/sdk/broker/lifecycle-ledger.ts` |
| 5 | `952f71105` | fix(coding-agent): validate and compact lifecycle ledger history | `packages/coding-agent/src/sdk/broker/broker.ts`<br>`packages/coding-agent/src/sdk/broker/lifecycle-ledger.ts` |
| 6 | `eb985646d` | fix(coding-agent): bound persisted lifecycle receipt ingestion | `packages/coding-agent/src/sdk/broker/lifecycle-codec.ts`<br>`packages/coding-agent/src/sdk/broker/lifecycle-ledger.ts` |
| 7 | `2de9f0c46` | test(coding-agent): adversarially cover cleanup receipt parsing | `packages/coding-agent/test/sdk-broker-lifecycle-e2e.test.ts` |
| 8 | `fa4215369` | fix(coding-agent): bound lifecycle cleanup receipt parsing | `packages/coding-agent/src/sdk/broker/lifecycle.ts`<br>`packages/coding-agent/test/sdk-broker-lifecycle-e2e.test.ts` |
| 9 | `984b8b9d3` | fix(coding-agent): recover legacy cleanup precompletion | `packages/coding-agent/src/sdk/broker/lifecycle.ts`<br>`packages/coding-agent/test/sdk-broker-lifecycle-e2e.test.ts` |
| 10 | `21832b43d` | fix(coding-agent): bind lifecycle cleanup replay authority | `packages/coding-agent/src/sdk/broker/lifecycle.ts`<br>`packages/coding-agent/test/sdk-broker-lifecycle-e2e.test.ts` |
| 11 | `6cb58cb16` | fix(coding-agent): validate lifecycle cleanup receipt completeness | `packages/coding-agent/src/sdk/broker/broker.ts`<br>`packages/coding-agent/src/sdk/broker/lifecycle.ts` |
| 12 | `622e3ab1d` | fix(coding-agent): preflight lifecycle metadata ownership | `packages/coding-agent/src/sdk/broker/lifecycle.ts`<br>`packages/coding-agent/test/sdk-broker-lifecycle-e2e.test.ts` |
| 13 | `2f29d0f64` | fix(coding-agent): reject unbound lifecycle readiness cleanup | `packages/coding-agent/src/sdk/broker/lifecycle.ts`<br>`packages/coding-agent/test/sdk-broker-lifecycle-e2e.test.ts` |
| 14 | `8e77d1add` | fix(coding-agent): bind completed lifecycle owner proof | `packages/coding-agent/src/sdk/broker/lifecycle.ts`<br>`packages/coding-agent/test/sdk-broker-lifecycle-e2e.test.ts` |
| 15 | `5422097c1` | fix(coding-agent): harden lifecycle sibling ownership | `packages/coding-agent/src/sdk/broker/lifecycle.ts`<br>`packages/coding-agent/test/sdk-broker-lifecycle-e2e.test.ts` |
| 16 | `de770b999` | fix(coding-agent): bind legacy lifecycle cleanup siblings | `packages/coding-agent/src/sdk/broker/lifecycle.ts`<br>`packages/coding-agent/test/sdk-broker-lifecycle-e2e.test.ts` |
| 17 | `e1282940c` | fix(coding-agent): replay legacy lifecycle cleanup receipts | `packages/coding-agent/src/sdk/broker/lifecycle.ts`<br>`packages/coding-agent/test/sdk-broker-lifecycle-e2e.test.ts` |
| 18 | `ca619af44` | fix(coding-agent): make lifecycle metadata cleanup crash-safe | `packages/coding-agent/src/sdk/broker/lifecycle.ts`<br>`packages/coding-agent/test/helpers/sdk-lifecycle-fixture.ts` |
| 19 | `dd82e89d7` | fix(coding-agent): align SDK lifecycle session ownership | `packages/coding-agent/src/sdk/broker/lifecycle.ts`<br>`packages/coding-agent/test/helpers/sdk-lifecycle-fixture.ts` |
| 20 | `ac9e861d1` | test(coding-agent): use managed SDK fixture scope | `packages/coding-agent/test/helpers/sdk-lifecycle-fixture.ts` |
| 21 | `9feb609b5` | fix(coding-agent): isolate lifecycle subscribers | `packages/coding-agent/src/session/agent-session.ts`<br>`packages/coding-agent/test/agent-session-message-pipeline.test.ts` |
| 22 | `f02f9f511` | fix(sdk): stabilize dev lifecycle shard (#2292) | `packages/coding-agent/src/sdk/bus/index.ts`<br>`packages/coding-agent/test/sdk-default-model-selection-e2e.test.ts` |
| 23 | `dd10bc093` | fix(ci): isolate merged-dev lifecycle fixtures (#2184) | repo area |
| 24 | `8670aa638` | fix(ci): isolate shard six lifecycle fixtures (#2186) | `packages/coding-agent/test/agent-session-default-model-selection.test.ts`<br>`packages/coding-agent/test/coordinator-mcp-server.test.ts` |
| 25 | `cf4d71086` | fix(ci): isolate merged-dev lifecycle fixtures (#2184) | `packages/coding-agent/test/coordinator-mcp/stop-session.test.ts` |
| 26 | `9ac4d057d` | fix(coding-agent): prevent orphaned lifecycle processes (#2183) | `packages/coding-agent/src/commands/harness.ts`<br>`packages/coding-agent/src/harness-control-plane/owner.ts` |
| 27 | `c13a28e0f` | fix(ci): close remaining lifecycle races | `packages/coding-agent/src/sdk/bus/index.ts`<br>`packages/coding-agent/src/sdk/bus/telegram-daemon.ts` |
| 28 | `a29288c33` | fix(ci): harden SDK lifecycle teardown | `packages/coding-agent/src/sdk/bus/index.ts`<br>`packages/coding-agent/src/sdk/host/reverse-leases.ts` |
| 29 | `fda6de381` | fix(ci): close lifecycle review gaps | `packages/coding-agent/src/sdk/bus/index.ts`<br>`packages/coding-agent/test/sdk-host-wiring.test.ts` |
| 30 | `b43ebc464` | fix(ci): isolate shared lifecycle tests | `packages/coding-agent/src/sdk/bus/index.ts`<br>`packages/coding-agent/test/harness-control-plane/cli-detached-owner.test.ts` |

## 주제 분석

이 묶음은 SDK가 관리하는 세션·프로세스의 종료를 단순한 즉시 정리 작업이 아니라, 소유권과 재생 가능한 영수증을 가진 복구 절차로 바꾼다. 핵심은 PID가 재사용되거나 프로세스가 중간에 죽어도 다른 세션의 자원을 정리하지 않는 것이다. ledger 기록의 직렬화·검증·compaction, legacy receipt 재생, sibling owner proof, readiness cleanup 권한을 함께 강화한다.

JWC에서는 SDK 외부 버스와 세션 수명주기가 여러 경로에 걸쳐 있으므로 일부 커밋만 떼어 오면 위험하다. ledger 형식, receipt 완전성, owner proof, fixture 격리를 하나의 계약으로 대조해야 한다. 표에는 같은 변경이 재적용된 서로 다른 해시도 범위의 독립 커밋으로 그대로 남긴다.

## Worktree 대조

현재 JWC에서 `lifecycle ledger`, `cleanup receipt`, `sibling ownership`, `managed lifecycle`을 검색했지만 대응 구현은 나오지 않는다. 직접 확인된 근접 항목은 `packages/coding-agent/test/file-lock-gc-toctou.test.ts`의 동일 PID 재사용 GC 테스트뿐이다. 따라서 upstream의 SDK lifecycle ledger와 cleanup replay authority는 대체로 미반영 상태로 보이며, `packages/coding-agent/src/sdk.ts`, 세션 수명주기 코드, 관련 테스트를 함께 diff해야 한다.

