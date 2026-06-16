# architecture — 01 overview (omp_origin)

> omp 모노레포 토폴로지 요약. jaw SoT: [structure/10_architecture.md](../../../structure/10_architecture.md).

## 패키지 방향

```text
packages/ai  ←→  packages/catalog (모델 메타 — gjc에 없음)
packages/agent, coding-agent, tui, utils
packages/mnemopi, hashline, snapcompact, wire (omp 전용)
crates/pi-natives
```

## vs gjc/jwc

| | omp | gjc/jwc |
|---|---|---|
| CLI | omp | jwc |
| Workflow 4종 | 없음 | jaw-interview, ralplan, ultragoal, team |
| Config | .omp | .jwc |

HEAD omp `db421bb2ef68`
