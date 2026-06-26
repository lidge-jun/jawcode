# chase — 개요

## 한 줄

**chase** = jawcode가 **의도적으로 아직 못 따라온** 영역 + **gjc/omp/cli-jaw를 어떻게 읽을지**에 대한 참조 방안.

jawcode를 **OSS upstream**으로 운영할 때도 chase는 유효하다: gjc/omp는 **계보·벤치마크**, jwc SoT는 `structure/` + worktree @ `da23db8`.

## 플랜 번호 (`struct_har/chase/`)

- **10** — [10_gjc_chase_MOC](./10_gjc_chase_MOC.md) · `10.001_` … `10.NNN_*`
- **20** — [20_omp_chase_MOC](./20_omp_chase_MOC.md) · `20.001_` … `20.NNN_*`
- 완료 → [_fin/10|20](./_fin/README.md) · [005](./005_devlog_numbering.md)

devlog 스텁만: `devlog/.../10_gjc_chase_MOC.md`. 구 `10_phase1_jwc_shell` = 010 셸 ✅.

## 갭 4종

| 종류 | 설명 | chase 문서 |
|---|---|---|
| **G1 gjc drift** | gajae-code 클론이 jaw worktree보다 **앞선 커밋/기능** | [003](./003_reference_from_gjc.md) |
| **G2 omp bench** | omp만 두꺼운 축 (steering, session modules) | [004](./004_reference_from_omp.md) |
| **G3 jwc product** | 99/M1 잔여 (HUD, CI 마감) | [006](./006_jwc_own_backlog.md) |
| **G4 platform** | M2·cli-jaw·릴리즈 | [006](./006_jwc_own_backlog.md) §M2 |

## 우선순위 (착수)

1. **G3** — [99.02 + 99.04](../../structure/50_status.md) (99.03·99.01·99.07 핵심은 ✅)
2. **G1 선별** — RPC 묶음·session·team ([007](./007_follow_index.md))
3. **G2 참고** — omp 밴드 스캔
4. **G4** — 110+

## struct_har와 역할 분담

| struct_har | chase |
|---|---|
| **형태** 스냅샷 (앵커·HEAD·`02_logic_changes`) | **행동** (갭·다음에 볼 경로·완료 기준) |
| `jwc_patched` ↔ `gjc_origin` | 삼축 + **자체 백로그** |
| `resolve-heads.ts` + 재생성 5종 | **수동** (fetch·diff·카드·MOC) |

## worktree에서 chase 카드 검증 (스니펫)

카드가 “⬜ gap”이라고 쓸 때, **먼저 jwc에 이미 있는지** grep으로 확인한다.

```bash
# RPC registry (10.018) — TS + Python
rg 'listRpcSessions|registerRpcSession' packages/coding-agent/src/modes
rg 'list_sessions' python/jwc-rpc/src/jwc_rpc

# Receipt spool (10.011)
rg 'receipt-spool|JWC_RECEIPT_SPOOL' packages/coding-agent/src/harness-control-plane

# Pre-send context (10.004)
rg 'checkEstimatedContextBeforePrompt' packages/coding-agent/src/session/agent-session.ts

# Goal continuation (10.022) — busy 가드는 interactive-mode 타이머 + session AgentBusyError
rg '#scheduleGoalContinuation|AgentBusyError' packages/coding-agent/src/modes/interactive-mode.ts
```

## 읽기 순서

1. [008_gjc_jwc_naming_contract.md](./008_gjc_jwc_naming_contract.md) (포팅 시)
2. [002_gap_inventory.md](./002_gap_inventory.md)
3. [007_follow_index.md](./007_follow_index.md) (실행 순)
4. [bands/](./bands/README.md)
5. [003](./003_reference_from_gjc.md) · [004](./004_reference_from_omp.md)
