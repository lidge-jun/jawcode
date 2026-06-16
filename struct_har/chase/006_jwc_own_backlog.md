# chase — jwc 자체 백로그 (타 제품 drift 아님)

> gjc/omp가 아니라 **jawcode가 스스로 아직 안 닫은 것**. 정본: 99 MOC · [status](../../structure/50_status.md).

## MLB

| 지금 (260614) | **62** | 99.03✅ · 99.01✅ · 99.07 부분✅ · 100 완료✅ · computer_use lazy ✅ |
| 99.02 PR 마감 후 | **62** | + CI green — 드라이버 임계 (런타임 무관) |
| 99.01~99.07 마감 후 | **68** | HUD · 슬래시 패리티 |

## CRITICAL (참조: 구현은 devlog)

| # | 갭 | GG | 참조 문서 |
|---|---|---|---|
| 1 | pabcd discovery M1/M2/M3 | 99.03 | ✅ 완료 (`45cba4e2`·`8a7ea342`·`90ef5223`) |
| 2 | `jwc memory` CLI | 99.01 | ✅ 구현 완료 (`ada449b2`·`693c5ee0`·`56fcf0de`) |
| 3 | check:schemas + biome | 99.02 | 코드 ✅ / **마감 ⬜** (PR 게이트, 런타임 무관) |

## 99 패키지 맵

| GG | 내용 | chase 밴드 |
|---|---|---|
| 99.01 | memory CLI + chat search | 070 |
| 99.02 | schemas·biome·병렬 랜딩 | 횡단 |
| 99.03 | workflow surface / pabcd discovery | 020, 050, 099 |
| 99.04 | HUD + TUI /goal 별칭 | 080, 060 |
| 99.05 | auth 릴리즈 게이트 | 090 |
| 99.06 | 문서 stale 스윕 | structure |
| 99.07 | 슬래시 패리티 | 030, 040, 050 |

착수 순서: `99.01 → 99.02 → 99.03 → 99.04 → 99.05 → 99.06 → 99.07` ([99.00.00](../../devlog/_plan/260612_jawcode_fork/phase1/99.00.00_moc_stabilization.md) · [status](../../structure/50_status.md)).

## M2 / OSS (99 밖)

| 항목 | MOC | chase |
|---|---|---|
| Node 포팅 | ✅ **완료**(260613, 감사 6라운드) [100_moc](../../devlog/_plan/260612_jawcode_fork/100_moc_node_porting.md) | [bands/100_node.md](./bands/100_node.md) |
| 런타임 부착 | [111_design_runtime_attach](../../devlog/_plan/260612_jawcode_fork/111_design_runtime_attach.md) | 110+ |
| β struct_har/Node | goal `3f6989ac` | **99 제외** |
| OSS v0.1 | LICENSE·릴리즈·CONTRIBUTING | [status](../../structure/50_status.md) |

## jwc만 **앞선** 것 (chase에서 추적 불필요·문서만)

- orchestrate native + `prompts/jaw/`
- `jaw-interview` + mutation-guard jwc
- `goal` CLI + goal-runtime
- Phase β `.jwc` 경로
- cli-jaw skill substitution (031)

→ [fork_logic_changelog](../../structure/40_fork-delta.md) · [jwc_patched/050_plan/02_logic_changes](../jwc_patched/050_plan/02_logic_changes.md)