# 070_memory — 01 overview (omp_origin)

> omp @ `db421bb2ef68` · 클론 [`devlog/_upstream_omp/`](../../../devlog/_upstream_omp/)
> MOC (jaw 밴드 정렬): [`99.01.00_moc_memory.md`](../../../devlog/_plan/260612_jawcode_fork/phase1/99.01.00_moc_memory.md)

## 메모리 · mnemopi

- **`packages/mnemopi/`** — omp 전용 메모리 축 (gjc/jaw 트리에 패키지 없음).
- gjc식 stage1/phase2 `memories/` 엔진과 **다른 설계** 가능 — 실측은 클론 기준.

## jawcode 대조

jwc: agent.db memories + summary 주입; 99.01 CLI; cli-jaw FTS 참고.

| 문서 | |
|---|---|
| [02_code_facts.md](./02_code_facts.md) | omp 경로 앵커 |
| [02_logic_changes.md](./02_logic_changes.md) | omp 동작 요약 (fork 아님) |
| [03_devlog_refs.md](./03_devlog_refs.md) | 플랜 링크 |

횡단: [../README.md](../README.md) · [../architecture/](../architecture/) · [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
