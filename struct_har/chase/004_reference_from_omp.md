# chase — omp 참조 방안

> **플랜 정본**: [20_omp_chase_MOC](./20_omp_chase_MOC.md) · `20.001`–`20.004` (+ `20.005`…) · 완료 [_fin/20](./_fin/20/README.md)
> **정본 클론**: `devlog/_upstream_omp/` · reviewed through `db421bb2ef68`
> **역할**: 벤치·아키텍처 선행 참고 — **fork diff 한쪽이 아님** ([omp_origin/README.md](../omp_origin/README.md)).

## 원칙

1. omp → jwc **직행 이식 금지** (스코프·브랜딩·워크플로 상이).
2. 참조 = **읽기·대조·MOC 결정** — 코드 복붙 전 [05_interview_conclusions](../../devlog/_plan/260612_jawcode_fork/phase1/05_interview_conclusions.md) · D4.
3. gjc와 충돌 시 **jwc 제품 방향 우선**; omp는 아이디어 채굴만.

## 이식표 (정본 요약)

| omp 영역 | jaw 연결 | chase 상태 | 상세 |
|---|---|---|---|
| `pi-catalog` | ai 내 models.json | **— 비채택** | D4 |
| `workerHostEntry()` / `__omp_*_worker` | M2 Node 100 | ⬜ | [bands/100_node.md](./bands/100_node.md) |
| `.omp/skills` 3계층 | `~/.cli-jaw/skills` D5 | 🟡 | [bands/030_skills.md](./bands/030_skills.md) |
| LSP/DAP 도구·ops | builtin tools | 🟡 선택 | omp `docs/` · 081 |
| `mnemopi` / memory | 99.01 + memories engine | ⬜ | [bands/070_memory.md](./bands/070_memory.md) |
| README 벤치 (40+ providers) | 품질 게이트 문화 | 참고 | structure/ CI |
| task-agent discovery/lifecycle | 030·099 | 참조 | `docs/task-agent-discovery.md`, `docs/tools/task.md` — precedence, batch/async, lifecycle |
| session export/share/fork/resume | 099 | 참조 | `docs/session-operations-export-share-fork-resume.md` |
| compaction pruning | 083 | 참조 | `packages/agent/src/compaction/pruning.ts` |

## 비이식 (명시)

| omp | 이유 |
|---|---|
| `@oh-my-pi/*` rename | `@gajae-code/*` 유지 |
| `omp` bin | `jwc` 단일 표면 |
| 4 workflow → omp | 제품 방향 상이 |
| `.omp/` 런타임 기본 | `.jwc/` + cli-jaw |

## 밴드별 omp 읽기 순서

1. [omp_origin/\<band\>/02_code_facts.md](../omp_origin/010_shell/02_code_facts.md) — 경로 present/missing
2. [omp_origin/\<band\>/02_logic_changes.md](../omp_origin/010_shell/02_logic_changes.md) — omp 동작 요약
3. [03_jwc_relationship.md](../omp_origin/03_jwc_relationship.md) — 횡단
4. jaw 착수 시 `chase/bands/<band>.md` 에 **결론 1줄** 기록

## 갱신

```bash
bun struct_har/_scripts/struct-har-regenerate-omp.ts
```

→ [002_gap_inventory](./002_gap_inventory.md) G2 열 · omp HEAD in INDEX.