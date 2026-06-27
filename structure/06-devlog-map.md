---
created: 2026-06-28
updated: 2026-06-28
tags: [jawcode, devlog, roadmap, archive, jawdev]
aliases: [jawcode devlog map]
---

# Devlog Map

How to read `devlog/` alongside `struct_har/chase/` and `structure/`.

## Folder Structure

```text
devlog/
├── _plan/          Active plans (distribution, docs sync, flip archives)
├── _fin/           Completed phase summaries
├── _gjc_chase/     Gitignored upstream clone (gajae-code)
├── _omp_chase/     Gitignored upstream clone (oh-my-pi)
└── _tmp/           Scratch (gitignored)
```

**Chase cards** (implementation backlog) live in **`struct_har/chase/`**, not under `devlog/_plan/`. Devlog holds multi-week strategy slices and docs-sync passes.

## Naming Convention

| Pattern | Example |
|---|---|
| Plan folder | `devlog/_plan/260628_docs_sync/` |
| Fin archive | `devlog/_fin/260628_docs_sync/` |
| Chase card | `struct_har/chase/10.012_gjc_chase_*.md` |
| Chase fin | `struct_har/chase/_fin/10/` |

Numeric prefixes inside plans: `00` overview · `10–89` phases · `90+` audits.

## Active `_plan` Folders (2026-06-28)

| Folder | Status |
|---|---|
| `260614_cli_jaw_jwc_distribution_strategy` | **Active** — cli-jaw merge bands 100–310 |
| `260613_gjc_flip` | Flip/archive reference |
| `260628_docs_sync` | **Done** — structure/direction/roadmap/git-history sync @ `af363c8` |

## Active Chase Surface

| MOC | Path |
|---|---|
| GJC gaps | `struct_har/chase/10_gjc_chase_MOC.md` |
| OMP gaps | `struct_har/chase/20_omp_chase_MOC.md` |
| Follow index | `struct_har/chase/007_follow_index.md` |

Recent session (Jun 27–28): multiple `10.0xx` / `20.0xx` cards retired to `struct_har/chase/_fin/`.

## `_fin` Highlights

| Folder | Meaning |
|---|---|
| `260612_jawcode_fork` (under distribution legacy) | Fork phase-1 structure |
| Chase `_fin/10/*`, `_fin/20/*` | Per-card implementation evidence |

## When to Archive

Move `devlog/_plan/<topic>/` → `devlog/_fin/<topic>/` when:

- Verification evidence file exists (`50_verification.md` or equivalent)
- `structure/` cites updated
- No open blockers in chase MOC for that slice

## Related

- [roadmap.md](./roadmap.md) — phase order
- [08-git-commit-history.md](./08-git-commit-history.md) — commit eras
- [struct_har/chase/README.md](../struct_har/chase/README.md) — chase rules
