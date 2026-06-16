# 099_stabilization — 02 logic changes (jwc_patched)

> worktree @ `d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5` · 정본 [structure/50_status.md](../../../structure/50_status.md) (260614 통합).

## 횡단 로직 (fork 이후, post-6/13)

- **99.03** IPABCD discovery: `system-prompt.md` native orchestrate (`45cba4e2`), 매 턴 `pabcd-stage-context` (`8a7ea342`), stage prompt 자가 전이 (`90ef5223`) — **구현 ✅**, [prompt_flow.md](../../../structure/20_prompt_flow.md).
- **99.01** `jwc memory *` / `local-query`·FTS — **구현 ✅** (`ada449b2` 등); [session_storage.md](../../../structure/22_session_storage.md).
- **99.07** orchestrate `reset`·interview `cancel` — 랜딩 ✅.
- **99.02** schemas·biome·docs — 코드 ✅ / PR 마감 ⬜ (런타임 무관).
- **99.04** HUD `.jwc/` 세그먼트 — 설계 ✅ / 구현 ⬜.
- **Computer use**: discoverable builtin `computer_use` + lazy `cua-driver` (`902a17f8`); managed MCP에서 선연결 제거 — [extensibility.md](../../../structure/21_extensibility.md).
- **Coordinator MCP**: Hermes/setup 표면 `jwc_coordinator_*` (`7ccea93c` rename) — [fork-delta.md](../../../structure/40_fork-delta.md) extensibility 절.

## 정본

- 횡단 changelog: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 밴드 overview: [01_overview.md](./01_overview.md) — `50_status.md`와 동형 표 (2026-06-14)