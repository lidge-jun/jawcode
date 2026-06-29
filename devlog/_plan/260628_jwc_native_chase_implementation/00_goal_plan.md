# 00 Goal plan — JWC-native chase implementation

## Objective

Implement the chase-card work that can be added to JWC without direct GJC/OMP logic import.

This goal treats the GJC and OMP chase corpus as source evidence only. JWC remains canonical for public names, workflow identity, state paths, role-agent behavior, and TUI product choices.

## Source evidence

| Lane | Baseline | Evidence |
|---|---:|---|
| GJC | `a791d72a` on `upstream/dev` | `devlog/_gjc_chase/gajae-code` |
| OMP | `0fc6d136` on `origin/main` | `devlog/_omp_chase/oh-my-pi` |
| JWC | current worktree | `AGENTS.md`, `structure/`, `packages/coding-agent/` |

## Non-negotiable constraints

1. Keep public names JWC-first: `jwc`, `.jwc`, `@jawcode-dev/*`.
2. Do not copy upstream GJC or OMP implementation wholesale.
3. Use upstream cards as evidence for guards, tests, docs, and JWC-compatible additive behavior.
4. Read `struct_har/chase/008_gjc_jwc_naming_contract.md` before every GJC-derived implementation slice.
5. Preserve TUI visual identity and scroll behavior unless a card explicitly requires a scoped, verified fix.
6. Commit each logical slice atomically and stage only intended files.
7. Preserve unrelated dirty files: `devlog/.gitignore` and `devlog/_tmp/`.
8. For code changes, use `bun check`, `bun run check:ts`, `bun run check:rs` where Rust is touched, and focused tests; never use `tsc` or `npx tsc`.

## Scope classes

| Class | Cards | Handling |
|---|---|---|
| Immediate JWC-native | 27 | Can enter implementation PABCD after local source inspection and risk-specific dev skill reads. |
| Split-audit first | 5 | Must produce a split decision before implementation, because direct behavior may conflict with JWC. |
| Held | 4 | No implementation without a separate user/product/security decision. |

Cycle/fetch cards `10.001` and `20.001` remain out of implementation scope. They are maintenance trackers for refreshing source baselines, not JWC product hardening slices.

## Artifact convention for repeated PABCD loops

Every implementation work-phase must add concrete phase artifacts before code:

| Artifact | Pattern | Purpose |
|---|---|---|
| Plan | `1x_*_plan.md`, `2x_*_plan.md`, ... | Card-local scope, source anchors, exact JWC owner files, risk class, tests. |
| Audit | `1x_*_audit.md`, `2x_*_audit.md`, ... | Employee review result and fixes. |
| Build | `1x_*_build.md`, `2x_*_build.md`, ... | Files changed, source/test rationale, residual risk. |
| Check | `1x_*_check.md`, `2x_*_check.md`, ... | Fresh command output, reviewer verdict, commit hash. |

Cards marked split must produce a `*_split.md` artifact before any code in that card's runtime surface.

## Done definition

A card or bundle is done only when all of these are true:

1. The card decision is recorded as adapt, reject, or split in JWC terms.
2. The implementation, test, or rejection note cites concrete source evidence.
3. Focused verification proves the JWC behavior or guard.
4. A read-only reviewer challenges closure for runtime, workflow, security, or architecture changes.
5. The chase card/MOC status is updated only after verification exists.
6. The commit contains only the intended slice.

## First PABCD pass

This Phase 0 pass is design-only. It creates the durable implementation map and audit surface before any code is changed.

Implementation begins in the next PABCD pass with Telegram notification foundation sub-slices only: config/protocol/discovery scaffolding for `10.028` and config/status UX for `10.029`. Ask/reply race semantics, daemon inbound handling, and remote Telegram control are explicitly deferred to later PABCD passes.
