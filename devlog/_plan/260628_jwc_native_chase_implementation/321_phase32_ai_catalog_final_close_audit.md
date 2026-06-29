# 321 Phase 32 audit — 10.036 final close (independent, read-only)

> Audits the plan in `320_phase32_ai_catalog_final_close_plan.md`. Read-only; no edits.
> Verdict: **PASS** (CLOSEABLE) across all 3 axes; all 5 folded audit notes factually accurate.

## Method

Independent read-only audit, default posture "NOT CLOSEABLE". Verified plan claims against real
files (source code, tests, git log, inbound references) rather than against the plan narrative.

## Axis 1 — `10.036-C` REJECT/DEFER justification: PASS

- Card states `-A` closed (phase 14), `-B` closed (phase 31), `-C` conditional.
- JWC local-import path EXISTS and is functional:
  `packages/ai/src/utils/oauth/local-token-detect.ts` exports `detectGrokCliToken`,
  `detectClaudeCodeToken`, `detectCodexCliToken`, wired into `loginXai` (`xai.ts:197`),
  `loginOpenAICodex` (`openai-codex.ts:166`), Anthropic flow (`anthropic.ts:176`).
- All three flows accept `LocalTokenImportMode` (`off`|`fallback`|`only`).
- `oauth-local-import.test.ts` = 4 tests covering the xai/grok path across 3 modes.
- Redaction owned by `10.047` (overlap rule `10.047:98`); security-critical slice not in `-C`.

## Axis 2 — `-A`/`-B` evidence intact: PASS

- `2c60aed` = `test(security): harden auth redaction regressions` (phase 14).
- `71240b6` = `test(ai): pin fable forced-tool_choice catalog invariant (chase 10.036-B, phase 31)`.
- 4 test files present: `auth-storage-project-dotenv.test.ts`, `auth-storage-config-override.test.ts`,
  `auth-storage-broker-no-sentinel.test.ts`, `fable-tool-choice-catalog.test.ts`.

## Axis 3 — inbound reference completeness: PASS

Markdown LINKS to the card (require path update after move): `002_gap_inventory.md:69`,
`007_follow_index.md:47`, `10_gjc_chase_MOC.md:74`, `20.010_…md:6`, plus a new `_fin/INDEX.md` row.
Matches the closure plan's list exactly. `20.010:28` bare `[10.036]` in a table cell is NOT a
functional link → excluded. Bare prose mentions in `_fin/10/10.043` and `_fin/10/10.047` are
citations, not links → excluded. **Zero dangling-link risks.**

## Folded audit-note accuracy (all ACCURATE)

1. JWC does NOT read `~/.claude/.credentials.json` file (Keychain/`secret-tool` only); bare
   `OPENAI_API_KEY` without `auth.json` is invisible to local-import.
2. Deferred gaps real: Claude file-only/non-darwin, Codex API-key-only, batch-wizard UX, env hints.
3. `oauth-local-import.test.ts` = 4 tests, xai/grok only, 3 modes, NOT anthropic/codex, no no-leak fixture.
4. Redaction owned by `10.047` (overlap rule); `provider-onboarding.ts` is 10.036 auth/import
   ownership, not redaction — note phrased accordingly.
5. Commit citations: phase 14 = `2c60aed`, phase 31 = `71240b6`.

## Outcome

PASS → proceed to B (closure surgery), folding all 5 notes into the closure section.
