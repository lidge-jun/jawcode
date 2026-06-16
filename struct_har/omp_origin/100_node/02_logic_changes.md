# 100_node — 02 logic changes (omp_origin)

> **omp 자체 런타임** (gjc/jwc fork changelog 아님).
> fork 로직: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md) · jaw 갭: [structure/50_status.md](../../../structure/50_status.md)

## 동작 (omp)

- `declareWorkerHostEntry` / `__omp_*_worker` — gjc hybrid worker와 대조
- natives: crates/pi-natives

## 대조

jwc M2: 100 셰임 → 111 jwc/sdk attach; omp worker 패턴 참고.

## 정본

- [01_overview.md](./01_overview.md)
- [02_code_facts.md](./02_code_facts.md)
