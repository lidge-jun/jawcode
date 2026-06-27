# 50 Final synthesis — GJC + OMP chase hardening

## Objective covered

User request: run repeated PABCD hardening loops, compare GJC chase and JWC against real commits, review active and `_fin` chase docs so missed upstream deltas are not hidden, then perform the same split/review work for OMP.

This goal did documentation hardening only. It did not implement the new upstream features in JWC.

## Source baselines

| Source | Baseline | Evidence path |
|---|---:|---|
| GJC | `a791d72a` (`upstream/dev`) | `/Users/jun/Developer/new/700_projects/jawcode/devlog/_gjc_chase/gajae-code` |
| OMP | `0fc6d136` (`origin/main`, v16.1.20) | `/Users/jun/Developer/new/700_projects/jawcode/devlog/_omp_chase/oh-my-pi` |
| JWC | `af363c8` during chase docs refresh | `/Users/jun/Developer/new/700_projects/jawcode` |

## Delivered commits

| Commit | Scope | Result |
|---|---|---|
| `96e2f26` | Phase 0 plan scaffold | Created the source audit matrix and multi-loop phase map. |
| `aef8133` | Phase 1A GJC Telegram anchors | Hardened selected Telegram/notification cards with concrete upstream commit anchors. |
| `19d7314` | Phase 1B GJC core anchors | Replaced broad core placeholder clusters with concrete source evidence. |
| `acd21ae` | Phase 1C GJC edge anchors | Hardened GJC edge/reference cards through 10.052. |
| `22f7cf6` | Phase 2 `_fin` inventory | Refreshed `_fin` index counts and moved the top GJC chase baseline to `a791d72a`. |
| `03e7805` | Phase 3 OMP split | Added OMP cards 20.009-20.015 for latest `cc0c67be..0fc6d136` deltas. |
| `1b9f46d` | Phase 4 OMP consistency | Aligned gap inventory baselines and verified OMP active/_fin consistency. |

## GJC coverage summary

- Telegram/notification chase cards now use commit-specific source anchors instead of broad "later fixes" wording where Phase 1A selected them for hardening.
- Phase 1A was intentionally partial: `10.028`, `10.031`, `10.033`, and `10.035` received explicit hardening notes. It should not be described as every `10.028`-`10.035` card being uniformly rewritten.
- Core and edge cards `10.037`-`10.052` were hardened in two separate PABCD cycles, with stale phrases such as broad cluster labels removed from the active-card batches.
- `10_gjc_active_audit.md` from the original Phase 0 map was superseded by `10_phase1a_gjc_telegram_plan.md`, `11_phase1b_gjc_core_plan.md`, and `12_phase1c_gjc_edge_plan.md`; it was not delivered as a separate artifact.

## `_fin` review summary

Phase 2 and Phase 4 reviewed `_fin` as inventory/baseline consistency work, not as body rewrites.

- GJC `_fin/10` inventory in `struct_har/chase/_fin/INDEX.md` was refreshed to the actual file set.
- OMP `_fin/20` historical card bodies were intentionally left untouched. In particular, `_fin/20/20.008` can remain historical even though active OMP cards 20.009-20.015 now exist.
- No `_fin/20` body file was modified in Phase 4.

Residual stale references that were intentionally not rewritten in the final synthesis pass:

| File | Residual reference | Reason not changed in this pass |
|---|---|---|
| `struct_har/chase/003_reference_from_gjc.md` | GJC `f0a8a3eb` | Reference overview needs a separate source-refresh edit, not a final synthesis-only change. |
| `struct_har/chase/10.027_gjc_chase_goal_live_artifact_engine.md` | GJC `f0a8a3eb` | Active deferral card was outside the Phase 1A-1C hardening set. |
| `struct_har/chase/_fin/10/10.012_gjc_chase_goal_steering.md` | GJC `f0a8a3eb` | Completed card body was left historical during `_fin` inventory review. |

## OMP coverage summary

OMP `cc0c67be..0fc6d136` was split into seven reference-only chase cards:

| Card | Topic | Posture |
|---|---|---|
| `20.009` | append-only context integrity | reference-only |
| `20.010` | AI OAuth/reasoning replay | reference-only |
| `20.011` | TUI image drafts/terminal edges | reference-only |
| `20.012` | bash snapshot/env security | reference-only |
| `20.013` | plugin virtual registry/bundle | reference-only |
| `20.014` | goal compaction/provider concurrency | reference-only |
| `20.015` | release/test leak hardening | reference-only |

The OMP cards are linked from:

- `struct_har/chase/20_omp_chase_MOC.md`
- `struct_har/chase/007_follow_index.md`
- `struct_har/chase/002_gap_inventory.md`

## JWC reconciliation

The chase docs compare upstream features against the current JWC baseline, but they do not assume direct import is safe. The OMP cards are explicitly reference-only because OMP behavior often maps to inspiration, parity checks, or rejection criteria rather than direct patches.

The GJC cards similarly distinguish source facts from JWC adaptation notes. Future implementation passes should use each card's decision slots and done gates instead of importing upstream commits wholesale.

## Recommended implementation order

1. Finish the high-signal GJC Telegram/notification stack first, because the user explicitly asked whether JWC can catch up to GJC Telegram behavior.
2. Handle OMP `20.012` and `20.015` early if implementation work resumes, because bash snapshot/env security and release/test leak hardening are risk reducers.
3. Defer reference-heavy OMP work (`20.013`, `20.014`) until JWC's plugin and goal/provider architecture owners confirm compatibility.
4. Revisit the three residual `f0a8a3eb` references as a small follow-up docs cleanup before claiming all chase docs are globally reviewed through `a791d72a`.

## Verification evidence

Completed during the hardening loops:

- Independent Docs audits were run for the plan, phase batches, and Phase 4 consistency.
- `git diff --check` passed for committed phase surfaces.
- Phase 4 final check confirmed:
  - `struct_har/chase/002_gap_inventory.md` has no `f0a8a3eb`.
  - OMP `20.009`-`20.015` links remain in MOC, follow index, and gap inventory.
  - No `_fin/20` body file changed in the Phase 4 commit.

Final expected local dirty state after this synthesis:

- Intentional new file: this `50_final_synthesis.md`.
- Preserved unrelated dirty files:
  - `devlog/.gitignore`
  - `devlog/_tmp/`

## Residual risk

- The chase corpus is now much more concrete, but active implementation cards remain open. This goal did not prove runtime parity with GJC or OMP.
- `_fin` body text is historical in several places. That is acceptable for this goal only because the final synthesis records the exact residual references.
- The branch remains ahead of `origin/main`; no push was performed.
