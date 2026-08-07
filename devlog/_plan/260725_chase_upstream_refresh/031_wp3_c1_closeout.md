# 031 — wp3 cycle 1 closeout: card 10.116 (A-slice)

Outcome: **DONE (partial with tracked residual)**.

## Phase records

| phase | evidence |
|---|---|
| P | `030_wp3_c1_natives_platform.md` — stale check vs `d9eadb6`; 4 implement slices + 2 module defers + 1 exclusion |
| A | Copernicus GO-WITH-FIXES (3 High) → all folded into 030 amendments (0100c5b): slice 1 reclassified cache-optimization, slice 2 proven no-op (scenario matrix), slice 3 import-safe seam, slice 4 skip (no semantic counterpart) |
| B | sol worker (Hume) implemented slices 1+3; main re-verified diff + tests (e01a0a6) |
| C | Beauvoir FAIL (1 High: size-only reuse) → main fix: content-identity reuse (b5a7074) → same-reviewer re-verify **PASS**; additional pre-existing check:ts failures fixed (6e035ba: 3 ai fixtures + sixel env typing) |

## Delivered

- `packages/natives/native/loader-state.js`: `shouldReuseCachedExtraction` + `cachedExtractionMatchesEmbedded` — same-version cache reuse requires size match + regular file + exact byte equality (ports GJC `f5cd965b`/`09e5263b`, hardened beyond upstream per C-review).
- `scripts/release-changelog.ts` + `scripts/release.ts`: keep empty changelogs versioned (ports GJC `d81af8bc`); pure import-safe seam.
- Tests: `embedded-extraction-freshness.test.ts` (7), `release-changelog.test.ts` (4) — all green; `check:ts` fully green across workspaces.

## No-op / skip evidence

- Slice 2 (ci-dev-affected addon provisioning): no reachable scenario lacks the native addon producer (full-workspace and runtime paths provision; tooling-only root-check never loads the addon). No edit.
- Slice 4 (guard churn): no semantic counterpart test case in JWC. No edit.

## Tracked residual (card 10.116 Decision F)

- `path_identity.rs` (6532 lines, 9 commits) and `plain_tree.rs` (1239 lines, 4 commits): upstream-NEW modules with no JWC counterpart or consumers — fixes inapplicable; full module port is a feature port, not a chase fix. Recommend folding into card 10.063 (natives platform split, tier ③) or a dedicated user-approved port card.
- `87ac45be54` (perf startup incl. welcome.ts): excluded from bucket A per AGENTS.md protected-visual rule; whole-commit defer to user.
