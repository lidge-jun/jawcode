PASS

[resolved — accepted] ARCH-A1 — Plan couples digest helpers, `createPrunedNotice(tokens, message?)`, `estimatePrunedSavings(tokens, notice)`, candidate `notice`/`savings`, and mutation writing `candidate.notice`.

[resolved — accepted] ARCH-A2 — Redteam test expectations must split digest-capable and non-digest notice savings.

[resolved — accepted] ARCH-A3 — Add File, Move-to hunk grouping, and failed per-file grouping are mandatory source/test deltas; Add File is a specific acceptance criterion.

[resolved — accepted as risk] ARCH-A4 — Encoding path must have a runtime fixture or a named B-summary/C-stage waiver; package typecheck alone is insufficient without that artifact.

[resolved — accepted non-blocking] ARCH-A5/ARCH-A6 — Existing staleness coverage placement and focused/package gates are valid.

[resolved — accepted] ARCH-A7 — Parent devlog files are included in the focused biome command, and B summary must cite parent/staleness evidence.

The single point most likely to break first if implemented as written: wiring digest `notice`/`savings` in `pruning.ts` out of sync with `pruning-redteam.test.ts` threshold/`tokensSaved` expectations.
