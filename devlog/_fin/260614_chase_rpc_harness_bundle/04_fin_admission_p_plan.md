# 04 — P plan: Phase 1 _fin admission (user approved 260615)

> **PABCD**: 승인 범위 = 검증 + 문서 + **10.008 / 10.011 / 10.018** → `_fin/10`  
> **제외**: UDS `--listen` (Phase 2), 10.026 **카드**는 활성 유지 (appendix만 Phase 1 클로즈)

## 목표

1. C 게이트 재실행 (01_p_plan_scope C block).
2. **10.026** 본문에 issues 01–13 **appendix** (fixed / defer / partial / open).
3. **10.018** rediscovery 플레이북 한 줄 (+ harness/orchestrate).
4. **10.008·10.011·10.018** 완료 헤더 + `struct_har/chase/_fin/10/` 이동.
5. [INDEX](../struct_har/chase/_fin/INDEX.md), [10_gjc_chase_MOC](../struct_har/chase/10_gjc_chase_MOC.md), [002](../struct_har/chase/002_gap_inventory.md) 동기화.

## C — 검증

```bash
bun test packages/coding-agent/test/rpc-stdio-redteam.test.ts
bun test packages/coding-agent/test/rpc-get-state-payload.test.ts
bun test packages/coding-agent/test/harness-control-plane/receipts.test.ts
bun test packages/coding-agent/test/harness-control-plane/receipt-spool.test.ts
bun test packages/coding-agent/test/rpc-session-registry.test.ts
cd python/jwc-rpc && python3 -m pytest tests/test_registry.py -q
```

## B — 문서만

- `10.026_gjc_chase_rpc_issues_audit.md`: appendix 표 + Phase 1 완료 기준 체크.
- `10.018`: rediscovery § (아래 템플릿).
- `02_issues_matrix_026.md`: 10.026 카드와 동기화.

### Rediscovery template (10.018)

운영: `jwc_rpc.list_sessions()` 또는 TS `listRpcSessions(getAgentDir())` → live PID·`sessionFile` → 클라이언트 `switch_session` / harness owner가 동일 agent-dir registry를 읽음. UDS `--listen`은 Phase 2.

## D — _fin

- `git mv` chase `10.008` / `10.011` / `10.018` → `_fin/10/` (링크 `../../` 조정).
- MOC 행: ✅ 완료 → `_fin` 링크.
- **10.026**: `_fin` 이동 **안 함** (defer 이슈 잔여).

## 리스크

- 번호 10.012 slug 충돌: _fin INDEX는 NNN만; 활성 10.012-steer 별도.

## 승인

사용자: Phase 1 admit + _fin for 008/011/018 → `jwc orchestrate a` → B/C/D.