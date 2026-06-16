# 01 — P plan: RPC/harness 묶음 (stdio Phase 1)

> **PABCD**: 본 문서 = **P** (승인 → `jwc orchestrate a` → B/C/D)  
> **명명**: [008](../../../struct_har/chase/008_gjc_jwc_naming_contract.md)  
> **chase**: [007](../../../struct_har/chase/007_follow_index.md) · [10.008](../../../struct_har/chase/10.008_gjc_chase_rpc_lifecycle.md) · [10.011](../../../struct_har/chase/10.011_gjc_chase_receipt_spool.md) · [10.018](../../../struct_har/chase/10.018_gjc_chase_rpc_registry_uds.md) · [10.026](../../../struct_har/chase/_fin/10/10.026_gjc_chase_rpc_issues_audit.md)

## 목표

Chase **011 → 008 → 018 → 026** 한 사이클: stdio RPC durability, cross-process **session-registry**, **`jwc_rpc.list_sessions`**, receipt-spool 검증 잔여, issues 매트릭스 클로즈.  
Upstream 참조만: `devlog/_upstream_gjc` @ `269387babcbf`. 정본 이름: **jwc**, **`python/jwc-rpc`**, `.jwc`.

## Worktree 기준선 (260614, P 갱신)

| 영역 | 상태 | evidence |
|------|------|----------|
| **10.008** stdio core | 🟢 landed (검증 필요) | `packages/coding-agent/src/modes/rpc/rpc-mode.ts`: `readLines`, `handleInboundLine`, `shutdown`+`ensureOnDisk`, `createRpcCommandScheduler`, `registerRpcSession` (stdio), `$pickenv` emit titles |
| **10.018** TS registry | 🟢 landed | `packages/coding-agent/src/modes/shared/agent-wire/session-registry.ts` |
| **10.018** Python | 🟢 landed | `python/jwc-rpc/src/jwc_rpc/registry.py`, `RpcClient.list_sessions` |
| **10.011** spool core | 🟢 (기존) | `harness-control-plane/receipt-spool.ts`, harness `--receipt-spool-dir` |
| **10.011** spool tests | 🟢 landed | `packages/coding-agent/test/harness-control-plane/receipt-spool.test.ts` |
| **C** registry tests | 🟢 landed | `packages/coding-agent/test/rpc-session-registry.test.ts` |
| **C** Python registry tests | 🟢 landed | `python/jwc-rpc/tests/test_registry.py` |
| **제외** UDS `--listen` | ⬜ defer Phase 2 | upstream `options?.listen` 블록 — jwc에 포팅 안 함 |

## Phase 1 — 남은 B/C/D (승인 후)

### B — 검증·동기화만 (신규 대형 포팅 없음)

1. **INVERTED-GUARD** (필수): `rg 'orchestrate|\.gjc/state/workflow-gates' packages/coding-agent/src/modes/rpc/rpc-mode.ts` → **`.jwc` only** (이미 `.jwc` gate path).
2. **03_implementation_log.md** — 마일스톤별 evidence 행 갱신.
3. **02_issues_matrix_026.md** — Phase 1 행을 아래 표로 **fixed / partial / defer** 갱신.

### C — 완료 기준 (goal + PABCD D)

**Precondition (INVERTED-GUARD):** `rg 'orchestrate|\\.gjc/state/workflow-gates' packages/coding-agent/src/modes/rpc/rpc-mode.ts` → no forbidden `.gjc` workflow-gates; gate paths use `.jwc` only.


```bash
bun test packages/coding-agent/test/rpc-stdio-redteam.test.ts
bun test packages/coding-agent/test/rpc-get-state-payload.test.ts
bun test packages/coding-agent/test/harness-control-plane/receipts.test.ts
bun test packages/coding-agent/test/harness-control-plane/receipt-spool.test.ts
bun test packages/coding-agent/test/rpc-session-registry.test.ts
```

```bash
cd python/jwc-rpc && python -m pytest tests/test_registry.py -q
```

### D — chase 문서

- `struct_har/chase/10.008`, `10.011`, `10.018`, `10.026` 상태·evidence 반영 (필요 시 `_fin` 판단은 별도 승인).

## 10.026 Phase 1 클로즈 매핑

| issue | Phase 1 verdict | note |
|-------|-----------------|------|
| 01 | fixed (C) | `rpc-get-state-payload.test.ts` + redteam dispatch frames |
| 06 client | partial | `jwc_rpc` contextUsage parse — defer unless redteam requires |
| 10 | fixed (C) | registry TS + Python tests |
| 12 | fixed (C) | `$pickenv` JWC/GJC/PI emit title |
| 13 | fixed (C) | fast-lane + scheduler exports |
| 008 EOF/shutdown/parse | fixed (C) | **only after** `rpc-stdio-redteam.test.ts` green |
| 02–05, 07–09 | defer | beyond stdio Phase 1 |

## 리스크

| 리스크 | 완화 |
|--------|------|
| worktree WIP vs 승인 경계 | **P 승인 후**에만 `jwc orchestrate b`; B는 검증+문서만 |
| UDS 코드 잔존 in rpc-mode | Phase 2; 실행 경로 stdio만 게이트 |

## P 완료 조건

- Critic **OKAY** + `pending-approval.md` + 사용자 승인 → `jwc orchestrate a`.