# 300 Phase 30 plan — 10.047 security/privacy guardrails final close

> Goal: JWC-native chase implementation (active). Work-phase 30 = drive `10.047` to `_fin`.
> Precedent: Phase 28 (`10.040` final close) and Phase 29 (`10.043` final close).
> Risk class: **C4 security** (auth/token/redaction/env-scrub guardrails) → independent read-only audit mandatory.

## Objective

Close `10.047 — security/privacy guardrails` by rolling up the already-implemented sub-slices
into a final-close evidence section, moving the card to `struct_har/chase/_fin/10/`, and
reconciling every inbound reference. No broad refactor — this is a verified closure, not new
feature work.

## Why 10.047 is closeable now

Per the card's overlap rule (line 98): `10.047` owns **cross-cutting redaction + env-scrub +
browser-origin/no-auth policy only**. Provider creds → `10.036`, RPC socket → `10.038`,
public URL/search → `10.043`. The card's three owned sub-slices are already implemented and tested:

| Sub-slice | Owned scope | Implemented in | Evidence (existing, passing) |
|---|---|---|---|
| 10.047-A | secret/log redaction (contribution-prep, agent-wire envelopes, `OAUTH_*`) | Phase 14 | `packages/coding-agent/test/contribution-prep.test.ts`, `packages/coding-agent/test/agent-wire/event-observation.redteam.test.ts` |
| 10.047-B | non-interactive bash env scrub (credential env removal, keep `SSH_AUTH_SOCK`) | Phase 17 | `packages/coding-agent/test/bash-executor.test.ts` |
| 10.047-C | auth-gateway browser-origin no-auth negatives + JWC naming | Phase 16 | `packages/ai/test/auth-gateway-browser-origin.test.ts` |

All other behaviors in the source summary (project-dotenv ignore, live env override → `10.036`;
socket token guard → `10.038`; private/local URL guard → `10.043`) are out of this card's lane
by the overlap rule and are tracked/closed under their owners.

## Plan of work (PABCD)

### A — Plan/closure audit (independent, read-only)
Dispatch **Backend + security-focused** read-only reviewer (must not have implemented the slices).
The audit must confirm, as a closure challenge:
1. The three owned sub-slices (A/B/C) fully cover `10.047`'s owned scope at GJC `a791d72a`.
2. No un-addressed security/privacy commit in the card's lane remains (lines 5/21 cluster),
   after subtracting the cross-owner items (036/038/043).
3. Overlap boundaries are respected — no duplicate ownership claim.
4. If any owned-scope gap is found → audit returns NEEDS_FIX naming the exact missing guard.

Verdict routing: PASS → proceed to B as evidence-rollup close. NEEDS_FIX → B adds the one
named focused test before close.

### B — Build (Boss writes; closure surgery)
Default path (audit PASS, no code): documentation + reference reconciliation only.

1. **MOVE** `struct_har/chase/10.047_gjc_chase_security_privacy_guardrails.md`
   → `struct_har/chase/_fin/10/10.047_gjc_chase_security_privacy_guardrails.md`
   - Append a `## JWC Phase 30 Final Close — 2026-06-28` section: close decision (**adapt, closed**),
     A/B/C evidence rollup table, owned-scope completeness statement, residual = closed/monitored.
   - Fix the moved card's internal relative links for `_fin/10/` depth:
     `./10_gjc_chase_MOC.md` → `../../10_gjc_chase_MOC.md`,
     `./008_gjc_jwc_naming_contract.md` → `../../008_gjc_jwc_naming_contract.md`.
   - Flip the MOC status line at top of card: `⬜` → `✅ _fin`.
2. **MODIFY** `struct_har/chase/007_follow_index.md` — U2/047 row: `⬜` → `✅ _fin · phases 14/16/17, 30`,
   retarget link `./10.047_...` → `./_fin/10/10.047_...`.
3. **MODIFY** `struct_har/chase/10_gjc_chase_MOC.md` — 10.047 row → `_fin`, retarget link.
4. **MODIFY** `struct_har/chase/_fin/INDEX.md` — add `10.047` under the `10/` listing.
5. **MODIFY** `struct_har/chase/002_gap_inventory.md` — retarget 10.047 ref → `_fin/10`.
6. **MODIFY** `struct_har/chase/20.012_omp_chase_bash_snapshot_env_security.md` — retarget 10.047 link → `_fin/10`.
7. **MODIFY** `struct_har/chase/10.037_gjc_chase_runtime_process_lifecycle_hardening.md` — retarget 10.047 link → `_fin/10`.

Conditional path (audit NEEDS_FIX): additionally **NEW**
`packages/coding-agent/test/security/privacy-guardrails-rollup.test.ts` covering only the one
named owned-scope gap, then proceed with the move.

### C — Check (verification gate)
1. Link/ref scan: `rg -n "10\.047" struct_har/chase/{10_gjc_chase_MOC,007_follow_index,002_gap_inventory}.md struct_har/chase/20.012_*.md struct_har/chase/10.037_*.md struct_har/chase/_fin/INDEX.md struct_har/chase/_fin/10/10.047_*.md` — confirm all point to `_fin/10` and no dangling open-dir link.
2. Runtime evidence recheck (existing, must stay green):
   `bun test packages/coding-agent/test/contribution-prep.test.ts packages/coding-agent/test/agent-wire/event-observation.redteam.test.ts packages/coding-agent/test/bash-executor.test.ts packages/ai/test/auth-gateway-browser-origin.test.ts`
3. `cd packages/ai && bun run check:types` (exit 0); `cd packages/coding-agent && bun run check:types` (exit 0).
4. `git diff --check` on the staged set.
   (No `tsc`/`npx tsc` — goal constraint #8.)

### D — Done
Summarize, record commit hash, leave the loop at IDLE→P for the next card.

## File change map

| Action | Path |
|---|---|
| NEW | `devlog/_plan/260628_jwc_native_chase_implementation/300_phase30_security_privacy_final_close_plan.md` (this) |
| NEW | `301_…_audit.md`, `302_…_build.md`, `303_…_check.md` (A/B/C records) |
| MOVE+EDIT | `struct_har/chase/10.047_…md` → `struct_har/chase/_fin/10/10.047_…md` |
| MODIFY | `struct_har/chase/007_follow_index.md` |
| MODIFY | `struct_har/chase/10_gjc_chase_MOC.md` |
| MODIFY | `struct_har/chase/_fin/INDEX.md` |
| MODIFY | `struct_har/chase/002_gap_inventory.md` |
| MODIFY | `struct_har/chase/20.012_omp_chase_bash_snapshot_env_security.md` |
| MODIFY | `struct_har/chase/10.037_gjc_chase_runtime_process_lifecycle_hardening.md` |
| NEW (conditional) | `packages/coding-agent/test/security/privacy-guardrails-rollup.test.ts` (only if A finds a gap) |

## Done-gate mapping (`00_goal_plan` §Done definition)

1. Decision recorded (adapt, closed) — Phase 30 final-close section ✓
2. Cites concrete source evidence — A/B/C rollup + GJC `a791d72a` ✓
3. Focused verification proves behavior — C re-runs the 4 owned-scope suites ✓
4. Read-only reviewer challenges closure — A-phase independent Backend+security audit ✓
5. Card/MOC status updated only after verification — B runs after A PASS ✓
6. Commit contains only intended slice — chase docs + (conditional) one test; preserve `devlog/.gitignore`+`devlog/_tmp/` (constraint #7) ✓

## Constraints honored

- No `tsc`; use `bun run check:types` (constraint #8).
- Do not stage `devlog/.gitignore` or `devlog/_tmp/` (constraint #7).
- JWC-first naming; source clone read-only.
- Atomic commit for the closure slice only.

## After Phase 30 (next loop candidates, not this phase)

`10.036-B` model catalog drift → then `10.036` close → `10.038`/`10.037`/`10.051` security-runtime
closes → Telegram MVP (`10.028`→`029`→`030`→`032`) → OMP splits (`20.009`-`20.015`).
~25 in-scope cards remain open; the loop continues one card = one PABCD per pass.
