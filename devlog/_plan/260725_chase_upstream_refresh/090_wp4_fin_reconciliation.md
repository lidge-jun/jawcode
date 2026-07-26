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

- **Keep in `_fin`, add closure header** (9): `10.091`, `10.094`, `10.099`, `10.105`, `20.047`, `20.053`, `20.055`, `20.057`, `20.067`, `20.079` — implementing commits are identifiable (`5fb0837`, `ddc0d2a`, `cace51e`, `5f82519`).
- **Return to ACTIVE** (6): `10.083`, `10.089`, `10.090`, `10.092`, `10.097`, `10.106` — the closure claim cannot be substantiated from history. Moving a card back is the honest action; a `_fin` card without evidence is worse than an active one.
- The 7 legacy malformed cards are audited separately and NOT folded into this count.

## Execution order

1. Write A–F Decision Slots + `Closed: YYYY-MM-DD` headers for the 8 cycle cards, then move them to `_fin/10|20`.
2. Add closure headers to the 9 verifiable markerless cards; move the 6 unsubstantiated ones back to active.
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

- D1: all 8 cycle cards carry A–F + `Closed:` + implementing commit hashes and live under `_fin/10|20`.
- D2: 9 verifiable markerless cards gain closure headers; 6 unsubstantiated ones are back in active with a reason line.
- D3: the "21" claim is corrected wherever it appears; the 7 legacy malformed cards are listed as a separate audit item.
- D4: zero status/location mismatches across both MOCs, `007`, `009` — verified by a scripted location-vs-status check.
- D5: `_fin/INDEX.md` matches the real inventory exactly (counts and rows).
- D6: `bun scripts/check-visible-definitions.ts`, `bun scripts/verify-g002-gates.ts`, `bun scripts/rebrand-inventory.ts --strict`, `bun test packages/coding-agent/test/default-jwc-definitions.test.ts`, and `bun run check:ts` all pass.
- D7: docs-only diff — no `packages/**` source changes in this work phase.
