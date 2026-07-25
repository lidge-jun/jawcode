# 260717 chase pull delta tracking — MOC

Status: active pull + sol dispatch planning
Owner: Boss
Created: 2026-07-17
Work class: C3 documentation / chase delta reconciliation

## Objective

GJC · OMP chase 클론을 최신으로 fast-forward하고, 마지막 카드 세트(10.082–10.086 / 20.045–20.050e) 이후 쌓인 upstream 커밋을 주제별로 클러스터링한다. sol 서브에이전트를 무제한 병렬 파견한다는 가정 아래, 각 클러스터를 diff-level chase 카드 작업으로 분배할 수 있도록 추적 문서를 완성한다.

## Scope

### In

- GJC clone fast-forward: `4a80bac9` → `upstream/dev` (`3ddf26079`)
- OMP clone fast-forward: `7aa1d581c` → `origin/main` (`b0d04e517`)
- 신규 커밋 클러스터링 + sol dispatch manifest 작성
- `struct_har/chase/model/` 갱신이 필요한 model/provider 커밋 태깅
- devlog `_plan` 두 개(260701 pull, 260703 pull refresh)의 현황 확인

### Out

- 실제 fast-forward pull 실행 (Boss 승인 대기)
- 카드 작성 자체 (이 문서는 추적 · 분배 계획)
- 루트 저장소 커밋/스테이징

## Prior devlog pull status

| devlog | 날짜 | 상태 | 비고 |
|---|---|---|---|
| `260701_chase_gjc_v078_pull` | 2026-07-01 | DONE | 10.070–10.073 카드 작성 완료 |
| `260701_chase_omp_v1629_pull` | 2026-07-01 | DONE | 20.036–20.040 카드 작성 완료 |
| `260703_chase_pull_refresh` | 2026-07-03 | DONE | fast-forward + synthesis → 위 카드 반영 |
| `260711_chase_card_cycle` | 2026-07-11 | DONE | 10.082–10.086, 20.045–20.050(+a-e) 작성 |

## Current upstream delta (unfetched → fetched, not yet pulled)

| 축 | 로컬 HEAD | 최신 remote | 범위 | non-merge 커밋 |
|---|---|---|---|---:|
| **GJC** | `4a80bac9` (v0.9.6) | `3ddf26079` (post-v0.9.6, pre-v0.11.1+) | `4a80bac9..3ddf26079` | **302** |
| **OMP** | `7aa1d581c` (v16.4.2) | `b0d04e517` (v17.0.1) | `7aa1d581c..b0d04e517` | **586** |

## Outputs

- `10_gjc_cluster_manifest.md` — GJC 302 커밋 주제별 클러스터 + sol dispatch slots
- `20_omp_cluster_manifest.md` — OMP 586 커밋 주제별 클러스터 + sol dispatch slots
- `30_model_provider_delta.md` — model/provider/auth/catalog 교차 추적 (model/ 폴더 갱신용)
- `40_sol_dispatch_plan.md` — 병렬 서브에이전트 분배 계획

## Accept criteria

1. 두 축의 전체 non-merge 커밋이 최소 하나의 클러스터에 배정됨
2. model/provider 관련 커밋은 별도 교차 추적 문서에 이중 태깅
3. 기존 카드(~10.086, ~20.050e)와 겹치지 않는 범위만 포함
4. 각 클러스터에 sol priority (P1/P2/P3) 태깅
5. dispatch plan에 서브에이전트 write scope 명시 (disjoint)
