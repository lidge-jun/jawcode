# 320 Phase 32 plan — 10.036 AI provider/auth/model catalog final close

> Goal: JWC-native chase implementation (active). Work-phase 32 = final-close card `10.036` to `_fin`.
> Prereqs: `10.036-A` closed (phase 14), `10.036-B` closed (phase 31). This phase resolves `10.036-C`
> and closes the whole card.
> Risk class: **C4** (auth/model-contract card) → independent read-only closure audit mandatory.

## Objective

Close `10.036` on evidence rollup: `-A` (credential resolution) done, `-B` (catalog drift) done,
`-C` (credential import/onboarding) resolved as **REJECT/DEFER** — JWC already has an equivalent,
tested local-credential-import path, and the security-critical redaction slice is owned by the
already-closed `10.047`. Move the card to `_fin/10/` and reconcile inbound references.

## 10.036-C resolution: REJECT/DEFER (P-investigation finding)

| Axis | GJC | JWC | Verdict |
|---|---|---|---|
| Mechanism | batch discovery wizard `setup/credential-import.ts` (commit `32578059`) | on-demand `/login <provider> local` via `packages/ai/src/utils/oauth/local-token-detect.ts` + `LocalTokenImportMode` (`auth-storage.ts:1370`) | equivalent safety surface |
| Sources read | `~/.claude/.credentials.json`, macOS Keychain, `~/.codex/auth.json`, env | same Keychain/secret-tool + `~/.codex/auth.json` | parity (JWC also covers xai) |
| No-leak | #654 retrofit `sanitizedFailureReason` | detectors structurally non-leaking (silent try/catch → null) | JWC at-or-ahead |
| Redaction | in import core | owned by **10.047** (already `_fin`), `provider-onboarding.ts:151` | out of 10.036 scope (overlap rule) |
| Tests | GJC credential-import tests | `packages/ai/test/oauth-local-import.test.ts` (all 3 modes, no-leak) | already covered |

Conclusion: porting GJC's batch wizard would be net-new UX gold-plating, not a hardening gap. `-C`
is rejected as "JWC-adequate"; if the batch-wizard UX is ever wanted, it is a NEW card, not `-C`.

## Plan of work (PABCD)

### A — Independent closure audit (read-only)
Challenge the `-C` reject: is JWC's local-token-import genuinely adequate (sources, no-leak,
precedence, JWC naming)? Is the redaction concern truly owned by 10.047? Is `-A`+`-B` evidence
intact? Is the inbound-reference list complete? Default to "not closeable" unless proven.

### B — Build (Boss; closure surgery, no product code)
1. **MOVE+EDIT** `struct_har/chase/10.036_…md` → `struct_har/chase/_fin/10/10.036_…md`:
   - flip status `⬜`→`✅ _fin`; fix relative links `./`→`../../` (MOC + 008, count TBD at move);
   - append `## JWC Phase 32 Final Close — 2026-06-28`: close decision (adapt, closed), -A/-B/-C
     rollup, the -C REJECT/DEFER rationale table above, residual = closed/monitored.
2. **MODIFY** `struct_har/chase/007_follow_index.md:47` — U1/036 `⬜`→`✅ _fin · phases 14,31,32`; link→`./_fin/10/…`.
3. **MODIFY** `struct_har/chase/10_gjc_chase_MOC.md:74` — 036 `⬜`→`✅ _fin`; link→`./_fin/10/…`.
4. **MODIFY** `struct_har/chase/002_gap_inventory.md:69` — link→`./_fin/10/…` + `✅ _fin`.
5. **MODIFY** `struct_har/chase/20.010_…md:6` — cross-link→`./_fin/10/…` + `(✅ _fin)`.
6. **MODIFY** `struct_har/chase/_fin/INDEX.md` — add 10.036 row under GJC `_fin/10`; count `28`→`29`.
   NOT changed: `20.010:28` (bare `[10.036]` no URL), `10.047:98/176` + `10.043:179/226/250` (bare
   code mentions / future-hypothetical-phase references — do not conflate).

### C — Check
1. Link scan: `rg "10\.036" struct_har/chase/…` → all links resolve to `_fin/10`; no dangling.
2. Owned-scope evidence re-run:
   `bun test packages/ai/test/auth-storage-project-dotenv.test.ts packages/ai/test/auth-storage-config-override.test.ts packages/ai/test/auth-storage-broker-no-sentinel.test.ts packages/ai/test/fable-tool-choice-catalog.test.ts packages/ai/test/oauth-local-import.test.ts`
3. `cd packages/ai && bun run check:types` (exit 0). `git diff --check`. (No tsc — constraint #8.)

### D — Done
Summarize, commit, checkpoint. 10.036 → _fin; open in-scope cards now exclude 10.036/10.047.

## File change map

| Action | Path |
|---|---|
| NEW | `320_…plan.md` (this), `321_…audit.md`, `322_…build.md`, `323_…check.md` |
| MOVE+EDIT | `struct_har/chase/10.036_…md` → `struct_har/chase/_fin/10/10.036_…md` |
| MODIFY | `007_follow_index.md`, `10_gjc_chase_MOC.md`, `002_gap_inventory.md`, `20.010_…md`, `_fin/INDEX.md` |

## Constraints

- No `tsc`; `bun run check:types`. Preserve `devlog/.gitignore` + `devlog/_tmp/` (constraint #7).
- JWC names; source clone read-only. Atomic commit. No batch-wizard feature port (out of scope).
