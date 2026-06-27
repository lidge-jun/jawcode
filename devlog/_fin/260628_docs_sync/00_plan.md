---
created: 2026-06-28
tags: [jawcode, docs-sync, structure, git-history]
---
# Docs Sync Plan — jawcode @ `af363c8`

## Objective

Mirror the code-office `v3.7.50` documentation sync pattern: export commit history, refresh `structure/` hub + canonical docs, add `direction.md` / `roadmap.md` / git-history / devlog-map, align public README snapshot with current chase state.

## Slice map (multi-pass PABCD)

| Pass | Deliverable | Files |
|------|-------------|-------|
| **P0 research** | Git log export + era analysis | `structure/data/git-log-1000.tsv`, `08-git-commit-history.md` |
| **P1 hub** | Index + devlog map + HEAD cite refresh | `00_INDEX.md`, `06-devlog-map.md`, `struct_har/chase/README.md` |
| **P2 direction** | Product direction lock | `direction.md` |
| **P3 roadmap** | Phase completion record | `roadmap.md` |
| **P4 status** | Readiness snapshot | `50_status.md` |
| **P5 verify** | Gates + archive | `50_verification.md` → `_fin/` |

## Commit history facts (122 commits, full repo)

- Window: `5892f59` (2026-06-16) → `af363c8` (2026-06-28)
- Typed: docs 46, fix 24, chore 23, feat 8, other 14, ci 4, refactor 3
- Eras: (1) OSS launch + CI 1.0.0, (2) distribution/M2 Node port 100–150, (3) GJC chase port wave Jun 27–28

## Verification

- `bun scripts/verify-g002-gates.ts`
- `bun scripts/verify-jwc-skill-docs.ts`
- No stale `da23db8` in `structure/00_INDEX.md` or `struct_har/chase/README.md`
