# 090 — wp4: `_fin` reconciliation and lifecycle proof

## Survey (P, 2026-07-26, HEAD `7f5a143`)

Per-card evidence audit by sol surveyor (Pascal) against the six cycle closeouts (031/042/052/062/072/082)
and real `git log` on the implementing paths.

### Finding that changes the plan

The canon claims **21 markerless `_fin` cards**; the tree does not support that number.
`753dc65` moved 16 cards with no `✅`/`Closed:` header; `319c69d2` moved 17 of which 13 already carried `✅`.
Separately, 7 OLDER cards in `_fin` also lack a `✅` header (`10.017`, `10.020`, `10.025`, `10.026`, `10.029`,
`20.002`, `20.007`). So the honest split is **16 reproducible + 7 legacy malformed = 23**, not 21. The count is
corrected rather than padded.

### Cards closeable now (8, all ADAPT-partial — none is a clean full close)

`10.116`, `10.117`, `20.081`, `20.083`, `20.107`, `20.109`, `20.122`, `20.124`.
Each carries a real residual (native module ports, C4 security/memory units, mupdf bundling, planning-leak
prerequisite, Cursor strict mode, LiteLLM architecture, Moonshot pricing decision, protected TUI surfaces).

### Cards that stay ACTIVE (7)

`20.082` (FIFO liveness residual), `20.087`, `20.088`, `20.089`, `20.102` (UX decision), `10.110`, `10.112` —
none has enough evidence to claim card-level closure.

### Markerless backlog disposition (16)

> **A-audit corrections (091 synthesis).** The first draft said "keep 9" while listing 10 cards, and proposed
> returning 6 cards to active when history actually substantiates 5 of them. Corrected below.

- **Keep in `_fin`, add closure header** (10): `10.091`, `10.094`, `10.099`, `10.105`, `20.047`, `20.053`, `20.055`, `20.057`, `20.067`, `20.079` — implementing commits are identifiable (`5fb0837`, `ddc0d2a`, `cace51e`, `5f82519`). **Each gets an explicit clean-vs-partial disposition**; `20.053`, `20.067`, `20.079` in particular still carry `TBD`/"parity unproven" text in the card body and may close ONLY as ADAPT-partial with an exact residual.
- **Keep in `_fin` as ADAPT-partial after a commit-to-anchor remap** (5): `10.083`, `10.089`, `10.092`, `10.097`, `10.106` — the auditor showed real implementation exists (`ebaa081a` model catalog/thinking/profiles/selector, `ddc0d2a` resolver/preset/durable selection, `5fb0837` input/selector/interactive + notification daemon, `7ea2101` coordinator/terminal). Blanket "unsubstantiated" was an over-correction; each needs a residual naming what is genuinely unproven (e.g. `10.092` protected scroll/graphics, `10.097` Grok vendor + benchmark receipt, `10.106` credential auto-import).
- **Return to ACTIVE** (1): `10.090` — upstream compact-core/shared-prompt structure has no substantiating implementation; a `_fin` card without evidence is worse than an active one.
- 10 + 5 + 1 = 16. The 7 legacy malformed cards (`10.017`, `10.020`, `10.025`, `10.026`, `10.029`, `20.002`, `20.007`) are audited separately and NOT folded into this count.

## Execution order

1. Write A–F Decision Slots + `Closed: YYYY-MM-DD` headers for the 8 cycle cards, then move them to `_fin/10|20`.
2. Add closure headers to the 10 verifiable markerless cards (each explicitly clean or ADAPT-partial); remap and header the 5 substantiated ones as ADAPT-partial with exact residuals; move `10.090` back to active with a stated reason.
3. Correct the "21" count in `007_follow_index.md` and `029_d_docs_roadmap_lock.md` to 16 + 7 legacy.
4. Sync `10_gjc_chase_MOC.md`, `20_omp_chase_MOC.md`, `007_follow_index.md`, `009_follow_tiers.md` — every row's status must match the file's real location.
5. Regenerate `_fin/INDEX.md` from the actual inventory (header still claims 2026-07-02, GJC 56 / OMP 21; reality is GJC 95 / OMP 57).
6. Run the full required gate set.

## Closure header template (canon: `005_devlog_numbering.md:28-36`, exemplar `_fin/10/10.098`)

```markdown
> MOC: [10_gjc_chase_MOC](../../10_gjc_chase_MOC.md) · G1 · ✅ **_fin** · Pn — concise final disposition.
> Reviewed source: <upstream range> vs JWC `<reviewed HEAD>`.
> Closed: YYYY-MM-DD — <one-sentence closure claim>; JWC commits `<hash>`, `<hash>`.

## Decision Slots

| slot | status | decision |
| --- | --- | --- |
| A | IMPORT / ADAPT / REJECT / SPLIT | source classification + exact adopted scope |
| B | NONE / … | JWC naming, command, state-path, package-namespace impact |
| C | TESTED / MANUAL EVIDENCE | focused test or proof used |
| D | CHASE ONLY / STRUCTURE / AGENTS | durable documentation impact |
| E | NO MIGRATION / … | rollout, migration, user-visible impact |
| F | CLOSED / ADAPT — partial implementation, tracked residual | exact residual + follow-up owner/card |
```

MOC row: `| NN.NNN | [slug](./_fin/10/NN.NNN_slug.md) | ✅ **_fin** — ADAPT partial; residual: <exact> | Pn | <scope> | <range> |`

## Accept criteria

- D1: all 8 cycle cards carry A–F + `Closed:` + implementing commit hashes and live under `_fin/10|20`; every `Closed:` sentence is scoped ("implemented slice closed; named residual remains"), never a whole-card parity claim.
- D2: 10 markerless cards gain closure headers with an explicit clean-vs-partial disposition; 5 remapped cards become ADAPT-partial with exact residuals; `10.090` returns to active with a reason line. 10 + 5 + 1 = 16 is asserted in the doc.
- D3: the "21" claim is corrected wherever it appears; the 7 legacy malformed cards are listed as a separate audit item.
- D4: `bun struct_har/_scripts/chase-lifecycle-check.ts` exits 0 (zero status/location mismatches, no duplicate ids, no broken MOC links, no missing MOC rows).
- D5: `_fin/INDEX.md` matches the real inventory exactly (counts and rows).
- D6: `git diff --check` clean; the repo-standard gates (`check-visible-definitions`, `verify-g002-gates`, `rebrand-inventory --strict`, `default-jwc-definitions`, `check:ts`) still pass as a baseline-health check — they are NOT the primary evidence for a docs-only change.
- D7: docs-only diff — changed paths are confined to `devlog/**` and `struct_har/**`; no `packages/**` change.
- D8: `bun struct_har/_scripts/chase-closure-integrity.ts` exits 0 — every `Closed:` hash exists AND touches a declared owner path of its card, and clean-vs-partial marking matches whether a residual is declared.
- D9: every count and list cardinality edited in this phase is recomputed and asserted (16 = 10 + 5 + 1; 23 = 16 + 7; `_fin` inventory GJC/OMP totals).
## Verification scripts (D4/D8 must be executable, not aspirational)

Both live at `struct_har/_scripts/` so they are re-runnable:

- `chase-lifecycle-check.ts` — for every card id under `struct_har/chase/` (EXCLUDING `README.md` and `_fin/INDEX.md`):
  resolve its real location (active vs `_fin/10|20`); parse the claimed status from `10_gjc_chase_MOC.md`,
  `20_omp_chase_MOC.md`, `007_follow_index.md`, `009_follow_tiers.md`; FAIL (exit 1) on any of:
  status/location mismatch, an id present in BOTH active and `_fin`, a MOC link whose target file does not exist,
  or a card id missing from its MOC. Print every violation; exit 0 only when the set is empty.
- `chase-closure-integrity.ts` — for every `_fin` card: require a `Closed: YYYY-MM-DD` header and at least one
  cited commit hash; verify each hash with `git cat-file -e <hash>^{commit}`; verify the commit's
  `git diff-tree --name-only -r` intersects at least one of the card's declared owner paths; FAIL when a card
  marked clean `CLOSED` also declares a residual, or when a card declares a residual but is not marked
  ADAPT-partial. Exit 1 with the offending card list.
