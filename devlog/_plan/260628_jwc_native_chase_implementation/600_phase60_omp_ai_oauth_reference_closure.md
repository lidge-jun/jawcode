# 600 Phase 60 — 20.010 OMP AI OAuth/reasoning replay reference-audit closure

> Work-phase 60. Goal OMP conditional cluster. Closes reference-only card **20.010**.
> Source: OMP `cc0c67be..0fc6d136` (v16.1.13→v16.1.20) read-only evidence. No JWC code.

## Done-gate verification (reference-only card)
- **Source anchors rechecked**: `git -C devlog/_omp_chase/oh-my-pi rev-list --count
  cc0c67be..0fc6d136` → 392 commits — both anchors resolve, range valid.
- **GJC overlap reviewed**: related card `10.036` (AI provider auth + model catalog) is CLOSED in
  `_fin/10`; it already owns the JWC OAuth/credential/auth-storage surface, so JWC OAuth work is not
  duplicated here.
- **Split decisions** (phase 10, `100_phase10_omp_ai_oauth_split.md`) finalized with rationale below.
- **Reference-only wording intact**: this card is not promoted into an implementation instruction.

## Split decision rationale (adapt / split / defer / reject)
| sub-slice | decision | rationale |
|---|---|---|
| 20.010-A OAuth account selection/listing | **adapt-later** | only through JWC auth-storage/broker UX; the JWC auth surface is already shipped + tested under closed `10.036`. No new behavior mandated by this reference card. |
| 20.010-B credential refresh / quota rotation | **split + security review** | idempotent refresh and quota rotation touch token/credential surfaces → any future adoption requires a dedicated security-reviewed slice, not a bulk port. Deferred to a future implementation card if/when JWC needs multi-account quota rotation. |
| 20.010-C reasoning / context-management replay | **defer** | provider-specific (Anthropic thinking/context-management); adopt only via provider-specific JWC replay tests when a concrete JWC need arises. |
| 20.010-D bulk provider proxy / catalog import | **reject** | Fugu/Sakana/provider-proxy/catalog bulk import is OMP-specific; JWC maintains its own curated catalog (`packages/ai`). No import. |

## Verification
- `git diff --check` clean; card retains `cc0c67be` + `0fc6d136` anchors; reference-only posture intact.
- No JWC source/test change (reference-only card; all sub-behaviors adapt-later/defer/reject).

## Close
Move `20.010` → `_fin/20/`; fix MOC/10.036 links; update inbound (follow-index/OMP-MOC/gap-inventory);
`_fin/INDEX` += row, bump OMP `_fin/20` 7→8.
