# omp_origin — 03 relationship to gjc and jawcode (jwc)

> 결정·스코프 정본: `structure/40_fork-delta.md`, `devlog/_plan/260612_jawcode_fork/phase1/05_interview_conclusions.md`.

## 계보

```text
pi-mono (badlogic)
    └── oh-my-pi (omp)     ← devlog/_omp_chase/oh-my-pi
            └── gajae-code (gjc)   ← devlog/_gjc_chase/gajae-code
                    └── jawcode (jwc surface)   ← worktree
```

## chase (갭 · 참조)

- [002_gap_inventory.md](../chase/002_gap_inventory.md) · [004_reference_from_omp.md](../chase/004_reference_from_omp.md)

## 이식 후보 (참고만)
| omp 영역 | jawcode M1/M2 연결 | 상태 |
|---|---|---|
| `pi-catalog` 분리 | gjc는 ai 내 models — **채택 안 함** (D4) | N/A |
| Worker `workerHostEntry()` | M2 Node 포팅 시 worker 안정성 참고 | 100 밴드 |
| `.omp/skills` 3계층 | `~/.cli-jaw/skills` 우선 (D5) | 030 밴드 |
| LSP/DAP 도구 깊이 | coding-agent builtin — 선택적 포팅 | devlog 081 |
| `mnemopi` / memory | jwc memories + 99.01 local-query | 070/99 |
| omp README 벤치 문화 | jawcode 품질 게이트 문화만 참고 | structure |

## 비이식 (명시)

| omp | 이유 |
|---|---|
| `@oh-my-pi/*` scope rename | jawcode는 `@jawcode-dev/*` 유지 |
| `omp` bin / 브랜딩 | **`jwc` 단일 표면** |
| gjc 4 workflow 스킬을 omp로 역수출 | 제품 방향 상이 |
| omp `.omp/` 경로를 런타임 기본으로 | jaw는 `.jwc/` + cli-jaw skills |

## gjc ↔ omp ↔ jwc 한눈에 (인터뷰 스킬)

| 스킬 slug | gjc_origin | jwc_patched |
|---|---|---|
| requirements | `deep-interview` | `jaw-interview` |
| plan | `ralplan` | `ralplan` |
| goal | `ultragoal` | `ultragoal` |
| parallel | `team` | `team` |

omp: 위 4종 **번들 없음** — jaw 워크플로는 gjc 포크에서만 유지·강화.

## 갱신

- omp fetch → `bun struct_har/_scripts/struct-har-regenerate-omp.ts` (13 밴드)
- 밴드별: [01_overview.md](./01_overview.md) 허브
- catalog 버전: [02_code_facts.md](./02_code_facts.md) §2