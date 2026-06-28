# 610 Phase 61 — OMP reference-audit bundle closure (20.011–20.014)

> Work-phase 61. Goal OMP conditional cluster (final). Closes the 4 remaining reference-only cards
> as one bundle (Decision-H: "OMP latest-delta bundle"). Source: OMP `cc0c67be..0fc6d136`
> (v16.1.13→v16.1.20, 392 commits, verified valid) read-only evidence. **No JWC code.**

## Why a bundle
All four cards share the identical reference-audit methodology, the same source range, and a common
phase-10 split origin. They touch the same shared indexes (follow-index / OMP-MOC / gap-inventory /
_fin INDEX), so one atomic bundle close is cleaner and matches their Decision-H bundle classification.

## Done-gate verification (per card, reference-only)
- Source anchors: `rev-list --count cc0c67be..0fc6d136` → 392 commits (valid) — shared by all four.
- GJC overlap reviewed per card (see table). Reference-only posture intact; no implementation mandated.
- Split decisions (phase 10) finalized with rationale below.

## Closures

### 20.011 — TUI image drafts and terminal edges (GJC overlap: 10.041, open)
| sub-slice | decision | rationale |
|---|---|---|
| A bare PNG paste/draft restore | defer | adopt only if JWC paste state shows a concrete gap |
| B terminal capability / kitty / Warp | split + Frontend/TUI review | terminal-edge handling needs TUI review before any port |
| C session picker / fullscreen / interrupt ordering | coordinate with GJC 10.041 | ordering owned by the open TUI card 10.041 |
| D settings wheel / transcript tail rotation | defer | pending product UX decision |

### 20.012 — bash snapshot and env security (GJC overlap: 10.047, ✅ _fin)
| sub-slice | decision | rationale |
|---|---|---|
| A alias/filter/Windows wrapping | adapt-later | only with shell tests |
| B background shell preservation | split + process-lifecycle review | touches process lifecycle (see 10.037) |
| C env re-export / snapshot permissions | security review required | credential/env surface; closed GJC 10.047 owns the JWC guardrail |
| D token-bearing git op refusal | adapt-later | only if JWC lacks an equivalent guard (10.047 already guards secrets) |

### 20.013 — plugin virtual registry bundle (GJC overlap: 10.044, open)
| sub-slice | decision | rationale |
|---|---|---|
| A marketplace / project-scope roots | adapt-later | only if a JWC marketplace gap exists |
| B runtime package validation | adapt-later | through JWC plugin schema (owned by open 10.044) |
| C virtual `pi-*` subpaths | reject | JWC-facing surfaces do not expose `pi-*` virtual subpaths |

### 20.014 — goal compaction and provider concurrency (GJC overlap: 10.040, ✅ _fin)
| sub-slice | decision | rationale |
|---|---|---|
| A goal threshold on billed context | adapt-later | only if JWC goal runtime lacks equivalent behavior |
| B snapcompact / manual compact sizing | coordinate with GJC 10.040 | compaction sizing owned by closed 10.040 |
| C provider limiter resize / backoff | split per provider | provider-specific concurrency; adopt per provider on need |

## Verification
- `git diff --check` clean; each card retains `cc0c67be` + `0fc6d136` anchors; reference-only intact.
- No JWC source/test change. Move all four → `_fin/20/`; fix MOC/cross-links; update inbound + INDEX
  (OMP `_fin/20` 8→12).
