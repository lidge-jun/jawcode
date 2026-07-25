# 40 — sol dispatch plan INDEX

> Date: 2026-07-17
> Status: **INDEX** — 세부 파일은 `040_sol_*.md` 참조

## 세부 파일

| file | 내용 |
|---|---|
| [040_sol_dispatch_gjc.md](./040_sol_dispatch_gjc.md) | GJC 7 worker 배정 상세 |
| [040_sol_dispatch_omp.md](./040_sol_dispatch_omp.md) | OMP 10 worker 배정 상세 |
| [040_sol_dispatch_priority.md](./040_sol_dispatch_priority.md) | wave 우선순위 + 작업 템플릿 |

---

아래는 원본 요약 (세부 파일 작성 전 참조용).

## Phase 순서

1. **Pull phase** — fast-forward 두 클론 (Boss 승인 필요)
2. **Card write phase** — sol 병렬 파견, 각 worker가 disjoint card files 작성
3. **MOC/meta phase** — main session이 MOC rows, README pin, 002_gap_inventory 갱신
4. **Verify phase** — C-phase hash existence loop + convention sweep
5. **Close phase** — D summary + devlog `_fin` 승격 판단

## GJC workers (7 workers, 18 clusters → ~18 cards)

| worker | clusters | card range | ~commits covered | priority mix |
|---|---|---|---:|---|
| GW1 | C1 (SDK lifecycle), C16 (agent async misc) | 10.087–10.088 | ~40 | P1+P3 |
| GW2 | C2 (security/prompt), C4 (prompt refactor) | 10.089–10.090 | ~45 | P1+P2 |
| GW3 | C3 (model preset), C11 (Grok/codex), C12 (reasoning), C17 (safety) | 10.091–10.094 | ~40 | **P1 ×4** |
| GW4 | C5 (command palette), C6 (IRC/Kitty/tmux) | 10.095–10.096 | ~35 | P2+P2 |
| GW5 | C7 (coordinator), C8 (telegram v2), C9 (interview/goal) | 10.097–10.099 | ~38 | P2 ×3 |
| GW6 | C10 (context SSOT), C13 (RPC/pet), C15 (browser/psmux) | 10.100–10.102 | ~30 | P2+P3+P3 |
| GW7 | C14 (CI/release), C18 (docs/changelog) | 10.103–10.104 | ~35 | P3+P3 |

## OMP workers (10 workers, 20 clusters → ~20 cards)

| worker | clusters | card range | ~commits covered | priority mix |
|---|---|---|---:|---|
| OW1 | D1 (model hub), D5 (resolver/fallback) | 20.051–20.052 | ~30 | **P1 ×2** |
| OW2 | D2 (catalog), D17 (usage/quota) | 20.053–20.054 | ~22 | **P1 ×2** |
| OW3 | D3 (auth/OAuth), D4 (provider/schema) | 20.055–20.056 | ~45 | **P1 ×2** |
| OW4 | D6 (vibe mode), D7 (ask dialog) | 20.057–20.058 | ~20 | P2+P2 |
| OW5 | D8 (TUI render), D18 (sixel/misc) | 20.059–20.060 | ~38 | P2+P3 |
| OW6 | D9 (advisor), D10 (agent loop) | 20.061–20.062 | ~22 | P2+P2 |
| OW7 | D11 (search/grep), D12 (plugin/MCP) | 20.063–20.064 | ~30 | P2+P2 |
| OW8 | D13 (session/startup), D15 (browser/bash) | 20.065–20.066 | ~27 | P3+P3 |
| OW9 | D14 (mnemopi/eval), D16 (collab/ext), D19 (small model) | 20.067–20.069 | ~26 | P3+P3+P2 |
| OW10 | D20 (CI/release/changelog) | 20.070 | ~40 | P3 (batch-note) |

## Priority dispatch order

서브에이전트 수 제한이 있는 경우 아래 우선순위로 파견:

### Wave 1 — P1 (model/security/auth critical)

GW3 → OW1 → OW2 → OW3 → GW2 → GW1

### Wave 2 — P2 (feature/UX/infra)

GW4 → GW5 → GW6 → OW4 → OW5 → OW6 → OW7 → OW9(D19)

### Wave 3 — P3 (CI/docs/misc)

GW7 → OW8 → OW9(D14/D16) → OW10

## Worker instructions template

Each sol worker receives:

1. This devlog unit path (read-only context)
2. Assigned cluster IDs + commit hash lists
3. Write scope: exact card file paths (disjoint)
4. Card template: existing card quality bar (10.086 / 20.050e as reference)
5. Constraint: `struct_har/chase/` new cards only; no MOC, no README, no code changes
6. Evidence: `git cat-file -e` loop on every cited hash, convention header grep
7. Model: `gpt-5.6-sol`, fork_context=true

## model/ folder update plan

After card write phase completes:

1. Main session reads all new model-related cards (C2/C3/C11/C12/C13/C17 + D1-D5/D10/D17/D19)
2. Updates `model/001`, `002`, `003`, `005` per `30_model_provider_delta.md`
3. `004_cross_project_patch_index` stays unchanged until actual code patches

## Total work estimate

| axis | clusters | cards | commits | workers |
|---|---:|---:|---:|---:|
| GJC | 18 | ~18 | 302 | 7 |
| OMP | 20 | ~20 | 586 | 10 |
| **total** | **38** | **~38** | **888** | **17** |

Plus main session: MOC + meta + verify + model/ update = 1 orchestrator turn after workers complete.
