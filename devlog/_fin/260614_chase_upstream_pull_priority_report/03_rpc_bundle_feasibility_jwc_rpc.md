# 03 — RPC/harness 묶음 실현성 (jwc-rpc 정본 반영)

> 선행 점검(260614): executor 4갈래 — **당시 일부가 `python/gjc-rpc` 부재로 n/a 처리함 → 수정.**  
> jawcode 정본: **`python/jwc-rpc`** (`jwc_rpc`). upstream만 `python/gjc-rpc` (`gjc_rpc`).

명명 계약: [struct_har/chase/008_gjc_jwc_naming_contract.md](../../../struct_har/chase/008_gjc_jwc_naming_contract.md)

## 수정된 총평

| 판정 | 내용 |
|------|------|
| **011 + 008 + 026 (TS)** | 한 PABCD **가능** (범위: TS + 이슈 매트릭스) |
| **018 (registry/UDS)** | 같은 사이클 **가능**, rpc-mode 신규 작업 큼 |
| **026 issues 06–08** | **n/a 아님** — `jwc_rpc`에 **API/테스트 갭**으로 추적 (upstream gjc_rpc 패리티) |

## 카드별 (jwc 경로 기준)

- **10.011**: `receipt-spool.ts` 없음; `harness.ts` 선별 pick; env `GJC_RECEIPT_SPOOL_DIR` → D4 dual-read.
- **10.008**: `get_state` include **있음**; `ensureOnDisk`/per-line JSONL **갭** (`rpc-mode.ts`).
- **10.018**: `session-registry.ts` **없음**; `jwc_rpc.list_sessions` **없음** (grep 0) — 018 완료 시 **TS + Python** 둘 다.
- **10.026**: 01–05, 11–13 TS open/partial; 06–08 → `python/jwc-rpc/src/jwc_rpc/{protocol,client}.py` vs upstream issues.

## 권장 스코프 (변경 없음, Python 열 수정)

Phase 1: 011 + 008 core + 026 matrix + tests  
Phase 1b: 018 + **`jwc_rpc` list_sessions / real-binary test lane** (issues 08, 10)  
Phase 2: full upstream harness parity, env rename sweep