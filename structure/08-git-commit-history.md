---
created: 2026-06-28
updated: 2026-06-28
tags: [jawcode, git, commit-history, gjc-chase]
aliases: [jawcode git history, jawcode commit log]
---

# Git Commit History

This document summarizes the **full public repository history** (122 commits as of 2026-06-28) and links to the machine-readable export. Jawcode is a young repo (June 2026); the export cap is 1,000 commits but the current tree contains every commit.

## Scope and Methodology

| Field | Value |
|---|---|
| Repository | `lidge-jun/jawcode` (fork lineage: `Yeachan-Heo/gajae-code` → Jawcode) |
| Total commits (`HEAD`) | **122** |
| Analysis window | **All commits** (≤1,000 cap) |
| Window date range | **2026-06-16** (`5892f59`) → **2026-06-28** (`af363c8`) |
| Raw export | `structure/data/git-log-1000.tsv` (`hash|date|subject`, newest first) |

### Regenerate

```bash
cd /Users/jun/Developer/new/700_projects/jawcode
git log -1000 --format='%h|%ad|%s' --date=short > structure/data/git-log-1000.tsv
```

Update this document's `updated` frontmatter and era tables after major release or chase milestones.

### Message Convention

| Type | Count | Share |
|---|---:|---:|
| `docs` | 46 | 38% |
| `fix` | 24 | 20% |
| `chore` | 23 | 19% |
| `other` | 14 | 11% |
| `feat` | 8 | 7% |
| `ci` | 4 | 3% |
| `refactor` | 3 | 2% |

Dominant pattern since launch: **`docs(chase):`** retirement/plan cards for GJC upstream gap tracking, paired with targeted `feat`/`fix` ports.

---

## Timeline Eras

### Era 1 — OSS Launch & CI Baseline (2026-06-16)

Initial public tree, MIT lineage, `jawcode@1.0.0`, CI/CD hardening, Bun-primary install docs.

| Date | Hash | Milestone |
|---|---|---|
| 2026-06-16 | `5892f59` | Initial commit — Jawcode coding agent + IPABCD |
| 2026-06-16 | `a5247a5` | Version bump to 1.0.0 |
| 2026-06-16 | `298cbbd` | CI/CD overhaul — gjc remnant cleanup |
| 2026-06-16 | `6e8f38b` | Parallel mac-native CI probes |

### Era 2 — Distribution & Node Port (2026-06-16 – 2026-06-26)

`structure/` ten-doc hub, `struct_har` three-axis docs, M2 Node porting (band 100), cli-jaw distribution strategy devlog, public `jwc` / `.jwc` surface lock.

| Theme | Evidence |
|---|---|
| Structure hub consolidation | `structure/00_INDEX.md` 24→10 doc merge (2026-06-26 cite) |
| PABCD in prompts | `4ad638b` feat(prompt): PABCD loop in orchestrate prompts |
| Readiness MLB 62 | `50_status.md` — 99.03 runtime + memory CLI |
| GJC flip / jwc-runtime | `40_fork-delta.md`, devlog `260613_gjc_flip` |

### Era 3 — GJC Chase Execution Wave (2026-06-27 – 2026-06-28)

High-velocity chase cards: goal steering port, compaction fixes, team tmux self-heal, cursor timeout, backlog splits.

| Date | Hash | Milestone |
|---|---|---|
| 2026-06-27 | `0974e20` | feat(goal): port gjc steering subsystem (chase 10.012) |
| 2026-06-27 | `e80075b` | fix(compaction): custom message counting (chase 10.023) |
| 2026-06-27 | `7cc3f31` | feat(team): tmux leader self-heal (chase 10.007) |
| 2026-06-27 | `4eeffb7` | fix(cursor): shell timeout ms→s (chase 10.003) |
| 2026-06-28 | `393a623` | docs(chase): telegram notification gap split |
| 2026-06-28 | `af363c8` | docs(chase): gjc upstream dev backlog split |

---

## Subsystem Touch Map (recent 30 commits)

| Subsystem | Commits | Representative |
|---|---|---|
| GJC chase docs | ~35 | `docs(chase): retire … _fin` |
| Goal engine | 3 | `10.012`, `10.021` |
| Team / tmux | 2 | `10.007` |
| TUI input | 2 | `20.006` |
| Compaction | 2 | `10.023` |
| Auth / cursor | 2 | `10.002`, `10.003` |
| struct_har chase | 5+ | `007_follow_index`, backlog splits |

---

## Related Docs

- Architecture hub: [00_INDEX.md](./00_INDEX.md)
- Product direction: [direction.md](./direction.md)
- Phase record: [roadmap.md](./roadmap.md)
- Chase backlog: [struct_har/chase/10_gjc_chase_MOC.md](../struct_har/chase/10_gjc_chase_MOC.md)
- Devlog map: [06-devlog-map.md](./06-devlog-map.md)
