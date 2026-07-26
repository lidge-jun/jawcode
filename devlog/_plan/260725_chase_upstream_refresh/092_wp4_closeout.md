# 092 — wp4 closeout: `_fin` reconciliation and lifecycle proof

Outcome: **DONE (scoped)** — 23 cards closed with verifiable evidence, canon counts corrected, index rebuilt,
two verification gates added. Two repository-wide findings escalated rather than silently absorbed.

| phase | evidence |
|---|---|
| P | `090_wp4_fin_reconciliation.md` — Pascal per-card evidence audit against the six cycle closeouts and real `git log` |
| A | Halley GO-WITH-FIXES (5) → `091`: markerless arithmetic corrected (10+5+1=16), five cards remapped as ADAPT-partial instead of blanket-returned, clean-vs-partial required per card, two verification scripts specified |
| B | `ec6b418` scripts, `1c458bf` 8 cycle cards, `c5d2d7f` 16 markerless + index rebuild + count correction |
| C | Lorentz **FAIL** (4) → `e575093`; **GO-WITH-FIXES** (1) → `a912f94`; **GO-WITH-FIXES** (1) → `d99b1df`; final **PASS** |

## The C-review chain — the reviewer broke our own gate three times

| round | finding | fix |
|---|---|---|
| 1 | `10.116` cited `944f5d7` (AI test fixtures + sixel typing) as closure evidence for native-module scope; `10.090`'s "no substantiating implementation" ignored four real prompt commits; D4/D8 were claimed met while both scripts exited 1; the integrity script accepted `Owner paths: packages/` — any real commit satisfies it | unrelated commit removed; `10.090` claim made precise; D4/D8 restated as phase-scoped with residuals named; script rejects <2-segment owners and requires exactly one classification marker (`e575093`) |
| 2 | owner paths were still INFERRED from Evidence prose, so `packages/ai` in a sentence bypassed the broadness rule | owner paths come exclusively from an explicit `Owner paths:` declaration; package roots rejected; must be a file or a `/src/`-`/test/` module dir (`a912f94`) |
| 3 | intersection was existential — declare five owners, support one | bidirectional: every commit touches an owner AND every owner is touched by a commit; the script now documents that it cannot verify semantic truth (`d99b1df`) |

Each round RAISED the legacy violation count. That is the correct direction: the gate got stricter, so more
pre-existing cards are honestly exposed.

## Delivered

- 8 cycle cards + 15 markerless cards archived with Decision Slots A–F, a scoped `Closed:` line, explicit
  `Owner paths:`, and Implementation Evidence citing only real JWC commits. All 23 pass both gates.
- `10.090` returned to active with a precise claim (shared prompt guidance landed in `4ad638bd`/`1eb6e3ea`/
  `61487047`/`5058b9c0`; compact-core, dead discovery plumbing and MCP discovery-shim anchors remain open).
- Canon count corrected: the claimed 21 markerless cards are really 16 reproducible (10 keep + 5 remap + 1
  returned) + 7 legacy malformed = 23.
- `_fin/INDEX.md` regenerated from the real inventory: GJC 96 + OMP 63 = 159 rows, exact match, no phantoms.
- `struct_har/_scripts/chase-lifecycle-check.ts` and `chase-closure-integrity.ts` added as re-runnable gates.
- Lifecycle violations 129 → 39.

## Escalated (NOT autonomous)

1. **12 card-id collisions** — the same id is used by two DIFFERENT cards, one active and one archived
   (`20.015`, `10.028`, `10.031`, `20.009`, `20.012`, `10.033`, `10.030`, `20.011`, `10.032`, `10.035`,
   `20.013`, `10.034`). Example: `10.028` is "native computer_use coordinate contract" active and
   "notifications SDK core" archived. All 39 remaining lifecycle violations derive from these. Renumbering is
   a user decision.
2. **136 legacy cards without closure evidence** — pre-convention archives lacking `Closed:`, implementing
   commits, owner declarations, or a classification marker. Substantiating them one by one, or honestly
   returning the unsubstantiated ones to active, is a separate audit — and it will REDUCE the project's
   "completed" count.

Neither was introduced by wp4, and the reviewer confirmed neither invalidates its scoped closures.
