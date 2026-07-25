# WP8 — 20.020 session title tracking + LLM idle recap (ADAPT)

> Card: `struct_har/chase/20.020_omp_chase_session_title_idle_recap.md` · Tier ① · Decision A ADAPT.
> Source: OMP `0fc6d136..ca9f2847e` (v16.1.20→v16.2.5). 1:1 port ❌ — JWC-native adaptation.

## Scope decision (6 OMP commits → 1 JWC ADAPT slice)

| OMP feature | OMP anchor | JWC applicability | judgement |
|---|---|---|---|
| session title casing reconciliation | `52b8fb156` | **JWC has the exact gap** — `generateSessionTitle` (title-generator.ts:157) only strips quotes/punctuation, no casing reconciliation vs user message; small title models mangle casing (`daemon`→`dAemon`, `TinyVMM`→`tinyvmm`) | **ADAPT** |
| persistent session title tracking | `0ce330ab7` | 709-line title-slot system across memory/file/**Redis/SQL/indexed** storage backends — JWC session storage differs (no Redis/SQL session backends); heavy arch port | DEFER ③ (OMP storage arch) |
| audit logging for title changes | `222b036a1` | depends on title-slot persistence (above) | DEFER ③ |
| centralized/atomized title persistence | `9c1b55dbe` | depends on title-slot persistence | DEFER ③ |
| LLM-generated idle recap | `96a1aed19` | JWC idle path is idle *compaction* (event-controller.ts:983-1016), not a static "Goal/Next" recap line; side-channel recap is a different UX surface needing its own design | DEFER ③ (different JWC idle arch) |
| config schema (recap/title refresh) | `a36f12be8` | config for the two deferred features (idle recap + title refreshOnReplan) — defer with them | DEFER ③ |

**Net: 1 JWC ADAPT slice** — title casing reconciliation against the user's first message.

## Ground Truth (JWC, file:line)

- `packages/coding-agent/src/utils/title-generator.ts:157` — `generateSessionTitle` returns `title.replace(/^["']|["']$/g, "").replace(/[.!?]$/, "")` — quote/punct strip only, no casing logic.
- `packages/coding-agent/src/utils/title-generator.ts:71-77` — `firstMessage` param is available (the source-of-truth user text).
- JWC has **no** `packages/coding-agent/src/tiny/text.ts` and **no** session-title `normalizeGeneratedTitle`/`reconcileTitleCasing` (OMP's home for this logic). Unrelated generic `titleCase`/`titleCaseSentence` helpers exist (`modes/controllers/todo-command-controller.ts:65,480`, `web/scrapers/repology.ts:95`) but none own session-title normalization, so a self-contained helper in title-generator.ts is the right home.
- `packages/coding-agent/test/title-generator.test.ts` — existing test harness (mocks `completeSimple`).

## Design (JWC-native, diff-level)

In `title-generator.ts`, add a self-contained `reconcileTitleCasing(title, sourceText)` helper (adapted from OMP `52b8fb156`, JWC-named, no `tiny/text.ts` dependency):
- `const TITLE_WORD = /[\p{L}\p{N}]+/gu;`
- `isDistinctiveCasing(token)`: `/\p{L}\p{Lu}/u` (interior/repeated uppercase — `TinyVMM`, `iOS`, `API`).
- `isCamelArtifact(token)`: `/^\p{Ll}/u.test(t) && /\p{Lu}/u.test(t)` (lowercase word w/ stray interior capital — `dAemon`).
- `reconcileTitleCasing`: build `verbatim` set + `distinctive` map from `sourceText`; per title token: verbatim→keep; distinctive match→restore user casing; camelArtifact→lowercase; else→leave (preserves `GitHub`/`OAuth`).
- Apply at the return: `return reconcileTitleCasing(cleaned, firstMessage);` where `cleaned` is the existing quote/punct-stripped value.

Export `reconcileTitleCasing` for unit testing. Pure function; no behavior change to the model request path.

JWC adaptation vs OMP: OMP's `52b8fb156` made `normalizeGeneratedTitle(value, sourceText?)` reconcile against `sourceText` and, when `sourceText` is absent, preserve the cleaned title as-is (the prior forced-title-case was removed in that same commit). JWC never force-title-cased (clean-and-return at title-generator.ts:157; tests assert raw casing at title-generator.test.ts:35), so we apply reconciliation directly with the always-available `firstMessage` — no sentinel path needed. Confirmed by A-audit not a regression.

## Invariants

- Title still strips surrounding quotes + trailing punctuation (existing behavior preserved).
- Tokens the user typed verbatim keep their casing; distinctive proper nouns restored from message; camelCase artifacts flattened; model-cased proper nouns not in message left intact.
- No change to model request, tool-call, or null-return paths.
- No JWC naming violations; no new `as any`.

## Acceptance

| # | criterion | evidence |
|---|---|---|
| 1 | verbatim user token casing kept | unit: message "fix TinyVMM daemon" + title "tinyvmm Daemon" → "TinyVMM daemon" |
| 2 | camelCase artifact flattened | unit: title "dAemon" not in msg → "daemon" |
| 3 | model proper noun preserved | unit: title "GitHub OAuth" not in msg → unchanged |
| 4 | quotes/punct still stripped | unit: existing behavior intact |
| 5 | tsgo/biome/naming clean | check:types EXIT 0, biome, naming grep |

## Verification

```bash
bun test packages/coding-agent/test/title-generator.test.ts
cd packages/coding-agent && bun run check:types   # tsgo EXIT 0
bunx biome check --write packages/coding-agent/src/utils/title-generator.ts <test>
git -C devlog/_omp_chase/oh-my-pi show 52b8fb156   # source resolve
```

## PABCD

- P: this plan.
- A: independent explorer (gpt-5.4) audits scope split + casing-logic correctness + that firstMessage is the right source + defer judgement.
- B: implement reconcileTitleCasing + wire return + unit tests.
- C: bun test + tsgo + biome + naming + diff --check.
- D: attest with evidence.

## Depends / feeds

- Defers ③: persistent title-slot storage (Redis/SQL/indexed backends), title audit logging, LLM idle recap + its config schema (different JWC idle-compaction arch).
