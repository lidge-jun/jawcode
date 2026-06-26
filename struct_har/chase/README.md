# struct_har/chase/ — 뒤쳐진 영역 · 참조 방안

> **목적**: jawcode(jwc)가 **선택적으로 따라잡거나 참고**할 gjc·omp·cli-jaw 축의 갭을 한곳에 모은다.
> **아님**: git cherry-pick 절차, fork 리베이스, upstream에 기여하는 PR 목록 — 그건 [structure/40_fork-delta.md](../../structure/40_fork-delta.md) · [conventions.md](../../structure/11_conventions.md).

## gjc / omp 플랜 (정본 = 이 디렉터리)

| 축 | MOC | 플랜 파일 |
|---|---|---|
| **10 gjc** | [10_gjc_chase_MOC.md](./10_gjc_chase_MOC.md) | `10.001_` … `10.NNN_*` |
| **20 omp** | [20_omp_chase_MOC.md](./20_omp_chase_MOC.md) | `20.001_` … `20.NNN_*` |

- 규약 · 완료 이동: [005_devlog_numbering.md](./005_devlog_numbering.md) → [`_fin/10|20/`](./_fin/README.md)
- devlog `10_gjc_chase_MOC` / `20_omp_chase_MOC` = **스텁** (로드맵 링크용)

## GJC ↔ JWC 명명 (포팅)

[008_gjc_jwc_naming_contract.md](./008_gjc_jwc_naming_contract.md) — upstream `gjc-rpc` → jaw **`python/jwc-rpc`** (`jwc_rpc`).

## 정본 축 (2026-06-26)

| 축 | 클론 / SoT | struct_har 대조 |
|---|---|---|
| **gjc** | `devlog/_gjc_chase/gajae-code/` @ **`f0a8a3eb`** (`upstream/dev`) | [../gjc_origin/](../gjc_origin/) |
| **jwc** | worktree @ **`da23db8`** | [../jwc_patched/](../jwc_patched/) · [structure/](../../structure/) |
| **omp** | `devlog/_omp_chase/oh-my-pi/` @ **`0fc6d136`** (`origin/main`) | [../omp_origin/](../omp_origin/) |
| **자체 백로그** | 99·M2·OSS | [006_jwc_own_backlog.md](./006_jwc_own_backlog.md) |

## 문서 트리

| 파일 | 내용 |
|---|---|
| `10_*` · `20_*` | **chase MOC + NNN 플랜** |
| [007_follow_index.md](./007_follow_index.md) | **실행 순** · RPC 묶음 |
| [008_gjc_jwc_naming_contract.md](./008_gjc_jwc_naming_contract.md) | **gjc↔jwc 명명** |
| [001_overview.md](./001_overview.md) | 정의 · 읽기 순서 |
| [002_gap_inventory.md](./002_gap_inventory.md) | 횡단 갭 + MLB 표 |
| [003](./003_reference_from_gjc.md) · [004](./004_reference_from_omp.md) | 참조 원칙 |
| [005_devlog_numbering.md](./005_devlog_numbering.md) | NNN · `_fin` |
| [006_jwc_own_backlog.md](./006_jwc_own_backlog.md) | G3/G4 |
| [bands/](./bands/) | 밴드 카드 |

## 갱신

1. `10.001` / `20.001` 사이클 (fetch)
2. 새 갭 → `10.NNN_<slug>.md` (**jwc 스니펫** + reconcile 표 권장)
3. 완료 → `_fin/10/` 또는 `20/`
4. [002](./002_gap_inventory.md) · MOC · **008 명명**
5. 카드 쓰기 전 [001 §worktree 검증](./001_overview.md) grep으로 이미 랜딩 여부 확인

## 관련

- [structure/50_status.md](../../structure/50_status.md)
- [devlog 260614 chase pull](../../devlog/_plan/260614_chase_upstream_pull_priority_report/000_moc.md)

*정본: `struct_har/chase/10_` · `20_`.*
