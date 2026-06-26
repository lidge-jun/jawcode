# 100_node — 01 overview (omp_origin)

> omp @ `0fc6d136c34a279a711a2d3f2df9d64e0fa06cee` · 클론 [`devlog/_omp_chase/oh-my-pi/`](../../../devlog/_omp_chase/oh-my-pi/)
> MOC (jaw 밴드 정렬): [`100_moc_node_porting.md`](../../../devlog/_plan/260612_jawcode_fork/100_moc_node_porting.md)

## 런타임 · Worker · Node

- **Bun 1.3.14** 명시; `cli.ts` **workerHostEntry** dispatch.
- M2 jaw: Node 셰임 참고 — `stream.test.ts` 등 베이스라인.

## jawcode 대조

jwc M2: 100 셰임 → 111 jwc/sdk attach; omp worker 패턴 참고.

| 문서 | |
|---|---|
| [02_code_facts.md](./02_code_facts.md) | omp 경로 앵커 |
| [02_logic_changes.md](./02_logic_changes.md) | omp 동작 요약 (fork 아님) |
| [03_devlog_refs.md](./03_devlog_refs.md) | 플랜 링크 |

횡단: [../README.md](../README.md) · [../architecture/](../architecture/) · [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
