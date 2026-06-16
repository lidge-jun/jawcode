# Dev Skill Ecosystem Quality Audit — MOC

**Date**: 2026-06-15
**Scope**: `~/.cli-jaw/skills/dev*` — 12 dev skills, 4,137 lines total
**Method**: Direct read of all 12 SKILL.md + 4-way external executor_ext parallel audit + synthesis

## Phases

| # | File | Status |
|---|------|--------|
| 00 | `00_moc_dev_skill_audit.md` | this file |
| 01 | `01_ecosystem_inventory.md` | ✅ complete |
| 10 | Interview: gap coverage & new skill architecture | pending |

## Key Findings

### Structure Assessment: B+

The hub-and-spoke modular design is genuinely well-executed:
- Each SKILL.md is an orchestrator with `## Modular References` table routing to `references/`
- C0/C1 fast-path banner on all 12 skills — small patches don't trigger full overhead
- Ownership map with one canonical owner per rule area
- Severity mapping explicit (dev-architecture line 17: `CRITICAL/HIGH ⇒ STRICT; MEDIUM ⇒ DEFAULT`)
- Conditional activation via `task_tags` and `role` — only relevant skills loaded per session
- Session-level cost: 50-80KB one-time load, amortized across dozens of turns

### Line Counts — All Under 500

| Skill | Lines | Cap headroom |
|---|---|---|
| dev | 491 | -9 |
| dev-frontend | 459 | -41 |
| dev-backend | 444 | -56 |
| dev-testing | 422 | -78 |
| dev-data | 343 | -157 |
| dev-code-reviewer | 332 | -168 |
| dev-architecture | 330 | -170 |
| dev-debugging | 306 | -194 |
| dev-security | 276 | -224 |
| dev-uiux-design | 252 | -248 |
| dev-pabcd | 242 | -258 |
| dev-scaffolding | 240 | -260 |

### External Audit Corrections

| External claim | Verdict | Reason |
|---|---|---|
| "200KB+ token injection excess" | ❌ Invalid | Selective loading; 50-80KB per session |
| "severity 3-system conflict" | ❌ Invalid | Different dimensions with explicit mapping |
| "400-line self-contradiction" | ❌ Invalid | Actual cap is 500 (code-reviewer §2: "400-500 Acceptable") |
| "Broken § anchors" | ✅ Valid | Edge-first testing mapped to wrong §6 |
| "cli-jaw residue" | ✅ Valid | dev line 26 still says `cli-jaw orchestrate I` |
| "DevOps/mobile/ML gaps" | ✅ Valid | Genuinely missing coverage areas |

### Coverage Gaps

**Fillable within existing refs:** API lifecycle, load testing, tech debt, API docs, observability depth
**Needs new spokes:** DevOps/IaC, native mobile, AI/ML, team ops (questionable)

## Next: Interview on Architecture Decisions

Open questions for skill ecosystem expansion:
1. Mobile: integrate into FE/UX/BE, or separate `dev-mobile`?
2. DevOps: consensus on separate spoke
3. TeamOps: `team` tool vs `dev-team-ops` skill — scope overlap?
4. ML: split across architecture/devops/backend, or separate `dev-ml`?
