# 099_stabilization — 01 overview (99 밴드)

> **역할**: struct_har용 **99 밴드 요약 인덱스**. 수치·상태·착수 순서의 **단일 정본**은 [`structure/50_status.md`](../../../structure/50_status.md) (260614 통합).
> MOC 상세: [99.00.00](../devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/99.00.00_moc_stabilization.md).
> worktree @ `d60b7822` · gjc 클론 `269387ba` (2026-06-14 문서 동기화).

## 로드맵 축 (정본: 50_status §로드맵)

| 구간 | 의미 |
|---|---|
| **000–099** | JWC 단독 표면 안정화 |
| **100–150** | ✅ cli-jaw 통합 전 준비 (SDK/package/runtime) |
| **160–260** | ✅ dependency merge + CI + identity rename |
| **270–310** | cli-jaw JWC 활성화 + code mode (진행 트랙) |

공개 workflow: `jaw-interview`, `jwc orchestrate`/`plan`, `jwc goal`/`goal`, `team` — `ralplan`/`ultragoal`은 내부 엔진명만.

## 1. 지금 쓸 수 있나 (readiness) — 50_status §1 동형

**99 전부를 끝내야 쓸 수 있는 건 아니다.** 일반 코딩·세션·goal·interview·IPABCD/PABCD 반자율화는 동작.

| 단계 | MLB | 범위 |
|---|---:|---|
| 지금 (260614) | **62** | 데일리 코딩 ⭕ · IPABCD/PABCD 반자율 · `jwc memory` CLI · `jwc goal` · orchestrate reset/interview cancel |
| 99.02+99.03 후 | **62** | MLB 62 임계 — 99.03 M1–M3 ✅ · 99.01 memory ✅; 잔여 99.02 PR·99.04~07 |
| 99.01~99.07 마감 후 | **68** | memory CLI · HUD · 슬래시 패리티 |

지금 되는 것 (요약): `jwc interview|orchestrate|goal *`, `/orchestrate` 단계 전이, `jwc memory *`·`jwc chat search`, `jwc orchestrate reset`·`jwc interview cancel`, built-in discoverable `computer_use` (lazy cua-driver).

## 2. 99 결정·구현 — 50_status §2 동형

| ID | 결정 | 상태 |
|---|---|---|
| D10 | cli-jaw 어휘 `jwc orchestrate/goal/memory` | orchestrate/goal ✅ · memory CLI ✅ |
| 99.03-M1 | 시스템 프롬프트 IPABCD discovery | ✅ |
| 99.03-M2 | 매 턴 `pabcd-stage-context` | ✅ |
| 99.03-M3 | 스테이지 프롬프트 자가 전이 | ✅ |
| 99.01 | `jwc memory *` + `jwc chat search` | ✅ |
| 99.02 | CI schemas + biome + docs | 코드 ✅ / PR 마감 ⬜ |
| 99.04 | HUD `.jwc/` 세그먼트 | 설계 ✅ / 구현 ⬜ |
| 99.07 | 슬래시 패리티 + reset/cancel | U1/U2 ✅; 패리티 잔여 |

**착수 순서**: `99.01 → 99.02 → 99.03 → 99.04 → 99.05 → 99.06 → 99.07`. MLB 62 = **99.03 런타임·discovery** + `99.01` (99.02는 PR/CI).

## 8기 조사 — 현재 해석 (260614)

| # | 주제 | 결론 (지금) |
|---|---|---|
| 1 | 시스템 프롬프트 | 레일·99.03 discovery — [prompt_flow.md](../../../structure/20_prompt_flow.md) |
| 2 | cli-jaw PABCD | jwc는 native `jwc orchestrate` pull; 4종 bundled skill |
| 3 | jwc memory | **99.01 ✅** — [session_storage.md](../../../structure/22_session_storage.md) |
| 4 | cli-jaw memory | 패리티 목표; jwc FTS/BM25 런타임은 99.01 마감 |
| 5 | HUD | **99.04** 잔여 — `.jwc/` 경로 정정·세그먼트 |
| 6 | 프롬프트 가드 | fork-delta 동행; orchestrate discovery는 99.03 ✅ |
| 7 | 명칭 | IPABCD re-facing ✅; public `plan`/`goal` alias |
| 8 | 슬래시 패리티 | **99.07** — reset/cancel ✅, 일부 슬래시 잔여 |

## CRITICAL (레디니스 잔여)

1. ~~pabcd discovery~~ → **99.03 M1–M3 ✅**
2. ~~`jwc memory *` CLI~~ → **99.01 ✅**
3. **99.02** check:schemas + biome — PR/CI 마감 (런타임 무관)
4. **99.04** HUD 구현 ⬜

## M2 / 100 밴드

- **100 Node 포팅 ✅** (260613) — [50_status §3](../../../structure/50_status.md), [100_node](../100_node/)
- 110–150·160+·270–310: distribution strategy MOC — 정본 `50_status` 로드맵 표

## struct_har 099 파일

- [02_logic_changes.md](./02_logic_changes.md) — 횡단 fork 로직 (computer_use, coordinator rename 등)
- [02_code_facts.md](./02_code_facts.md) — 앵커·HEAD 포인터

β goal `3f6989ac` — 99 MOC 제외 (별도 트랙).