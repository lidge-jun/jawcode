# Dev Skill Ecosystem Inventory

## Skills (12 total, 4,137 lines)

### Hub
- **dev** (491L) — C0-C5 classifier, fast-path, rule classes, methodology overlays, modular dev, pre-write search, debugging pointer, verification gate, change docs, safety, code quality, type safety

### Domain Spokes (role-based)
- **dev-backend** (444L) — Stack detection, architecture decision, layered arch, error handling, middleware, API contract, caching, database. refs: crud-api, api-design, architecture, anti-slop-backend, observability, health-checks, process-isolation, caching, node, python, database
- **dev-frontend** (459L) — Frontend routing, component ID, design thinking, baseline config, implementation, anti-slop, performance, a11y, hooks, React perf, forms, 2026 platform. refs: 25+ files including anti-slop, aesthetics, responsive, motion, korea-2026, mobile-ux
- **dev-data** (343L) — Processing principles, ingestion, ETL/ELT, data quality, analysis, architecture (batch/streaming), governance/PII

### Cross-cutting Spokes (tag-based)
- **dev-architecture** (330L) — Module boundaries, circular deps (CRITICAL), coupling taxonomy (CRITICAL), boundary-only defense (CRITICAL), barrel discipline (HIGH), review integration
- **dev-testing** (422L) — Trophy distribution, backend/API testing, contract testing, Playwright, CI pipeline, TDD enforcement, AI regression, test-induced defense
- **dev-security** (276L) — Threat model, input validation, auth checklist, authorization, secrets, headers, rate limiting, static analysis, agent config security, pre-flight checklist, ownership matrix
- **dev-debugging** (306L) — Phase 0-4 RCA, red flags, slop debugging, concrete scenarios, escalation, postmortem
- **dev-code-reviewer** (332L) — Pre-review, automated pre-scan, review order, quality thresholds, antipatterns, security/perf quick-check, receiving/requesting review
- **dev-uiux-design** (252L) — 6-step intent discovery, Design Read, Korean translation, quick-match table. refs: design-isms, product personalities, layout, UX states, color, typography, favicon/logo
- **dev-scaffolding** (240L) — Lidge Standard, existing repo first, language detection, fullstack split, feature modules, naming, file suffixes, str_func, split rules, cross-cutting scaffolding, docs gen
- **dev-pabcd** (242L) — PABCD workflow P→A→B→C→D, decade numbering, phase skip, depth by class. **Blocked by jwc runtime** (uses native `jwc orchestrate`)

## Ownership Map

| Area | Owner | Stubs |
|---|---|---|
| Circular deps | dev-architecture | dev, code-reviewer |
| Module boundaries | dev-architecture | backend, frontend |
| Coupling taxonomy | dev-architecture | code-reviewer |
| Barrel/re-export | dev-architecture | scaffolding |
| Pre-write search | dev §1.5 | code-reviewer |
| Edge-first testing | dev-testing refs/ | — |
| Test-induced defense | dev-testing §6.6 | code-reviewer |
| Boundary defense | dev-architecture §4 | backend, security |
| Validation policy | dev-security §1 | — |
| Validation placement | dev-architecture §4 | — |
| Process isolation | dev-backend refs/ | code-reviewer |
| Long-lived connections | dev-backend §1 | frontend |
| Async task queue | dev-backend §2 | — |
| Debugging methodology | dev-debugging | code-reviewer |
| Data pipeline | dev-data | backend |
| Design intent | dev-uiux-design | frontend |
| Scaffolding/docs | dev-scaffolding | pabcd |
| Orchestration | dev-pabcd | — |
