# omp_origin/ — oh-my-pi (OMP) 참조 축

> **목적**: gjc/jwc **포크 diff의 한쪽 면이 아님** — 상류 벤치·계보·밴드별 경로 대조.
> **깊이**: gjc/jwc와 **동일 밴드 id** (`010_shell` … `100_node`) + `architecture/`.
> 클론 @ `db421bb2ef68` · [`devlog/_upstream_omp/`](../../devlog/_upstream_omp/)

## 재생성

```bash
bun struct_har/_scripts/struct-har-regenerate-omp.ts
```

## 문서 트리

| 경로 | 내용 |
|---|---|
| [01_overview.md](./01_overview.md) | **허브** — 13 밴드 링크 |
| `<band>/01_overview.md` | 밴드별 omp 동작 + jwc 대조 |
| `<band>/02_code_facts.md` | `devlog/_upstream_omp` 앵커 |
| `<band>/02_logic_changes.md` | omp 런타임 요약 (fork 아님) |
| `<band>/03_devlog_refs.md` | jaw MOC 플랜 (대조용) |
| [02_code_facts.md](./02_code_facts.md) | 클론 **전역** 인벤토리 (레거시·보조) |
| [03_jwc_relationship.md](./03_jwc_relationship.md) | 이식·비이식 횡단표 |
| [architecture/01_overview.md](./architecture/01_overview.md) | 패키지 토폴로지 |

## cite

`/Users/jun/Developer/new/700_projects/jawcode/devlog/_upstream_omp/<path>:<line>`

## 관련

- [structure/40_fork-delta.md](../../structure/40_fork-delta.md)
- [structure/00_INDEX.md](../../structure/00_INDEX.md)
- 대조: [../gjc_origin/](../gjc_origin/) · [../jwc_patched/](../jwc_patched/)

## changelog

| 날짜 | 변경 |
|---|---|
| 2026-06-13 | omp_origin 축 신설 (평면 3파일) |
| 2026-06-13 | **밴드 전수** — 13×4 + architecture (`struct-har-regenerate-omp.ts`) |