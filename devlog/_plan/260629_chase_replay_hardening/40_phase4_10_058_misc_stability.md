# Phase 4 — Close 10.058 goal-priority surfaces (web-search timeout + memory GC)

> Goal `65f1dc1a-373`. Work-phase = one FULL PABCD cycle (P→A→B→C→D).
> Scope = the TWO goal-named surfaces only: web-search hard timeout (import)
> and browser/computer-use memory GC (triage). The other five 10.058 items
> (status-line editor, Codex-usage fix, model preset snapshot, coordinator-mcp
> ack/await, busy-queued steer, tool pruning, prompt scroll, try-harder nudge,
> live terminal width) are **P3 polish, explicitly OUT of scope** this cycle —
> they remain on the card for a future low-priority bundle.

## Part 1 — Easy explanation

The goal lists 10.058 priority (2) as exactly two stability imports:
"memory GC bounds, web-search hard timeout". This phase handles both.

- **web-search timeout** was a real gap: JWC hardcoded the hard-abort ceiling
  at 60s, so slow OpenAI-compatible (Responses-API) search endpoints timed out.
  We made it runtime-configurable with a `web_search.timeout` setting
  (default 300s, clamped 5-600s). IMPORTED.
- **memory GC** turned out to be a polish-grade optimization, not a data-safety
  gap, and GJC's version needs elaborate concurrency guards. After live-code
  triage we DEFER it with evidence (same posture as 10.055 #3/#6).

## Part 2 — Per-surface decision table (live-code evidence)

| # | surface | GJC src | JWC decision | evidence (file:line / commit) |
|---|---|---|---|---|
| A | web-search configurable hard timeout | `6f155095` #1226 | **IMPORT (adapt)** — done this phase | commit `2401b6a`; `packages/coding-agent/src/web/search/providers/utils.ts` (get/setSearchHardTimeoutMs + clamp), `settings-schema.ts` web_search.timeout, `web/search/index.ts` apply, `schemas/config.schema.json`, focused test `web-search-hard-timeout.test.ts` (7 pass) |
| B | browser/computer-use memory GC | `8431b14e` #1227 | **DEFER (evidence-based)** | see triage below |

### Slice A adaptation note (audit-driven)
The audit (Backend, APPROVE-WITH-NOTES) found JWC uses a **settings-pull**
model, not GJC's push wiring: there is no `sdk.ts`/selector-controller live
listener — every `web_search.*` setting is read at invocation time in
`WebSearchTool.execute` (`web/search/index.ts`). So the adaptation:
- changes `withHardTimeout`'s default to read `getSearchHardTimeoutMs()` so the
  six no-arg provider call sites (duckduckgo, parallel, kimi, zai, jina,
  perplexity) actually honor the setting — without this the setting would only
  reach providers that already thread an explicit `timeoutMs`;
- applies the setting (sec→ms) once at the top of `execute()`;
- omits the GJC CLI/sdk wiring (not present, not needed in JWC).

### Slice B triage — why DEFER
- **No idle auto-GC today, but no data-safety gap.** JWC tabs are *named*
  (default `main`), stored in the `tabs` map, refcounted on a per-kind shared
  `BrowserHandle`. They are released on explicit `close`, session teardown
  (`releaseAllTabs`), or mode change (`dropHeadlessTabs` —
  `tab-supervisor.ts:257`). Absence of idle eviction is a long-session memory
  *optimization*, not correctness/data loss.
- **GJC's GC is concurrency-heavy.** `8431b14e` needs a begin-release guard,
  identity-guarded `tabs.delete`, a synchronous live recheck (no intervening
  await), generation-guarded recursive timers, and an RSS warning signal —
  disproportionate risk for a P3 polish item with no reported JWC leak.
- **Computer-use screenshot GC has no JWC surface.** `computer-use.ts` (228L)
  writes nothing to disk (no `writeFile`/`mkdtemp`/`*.png`), so GJC's
  `gjc-computer-screenshots-*` disk cleanup is **confirm-absent / N/A**.
- **JWC tab model is simpler than GJC's.** `BrowserKindTag` = `"headless" |
  "spawned" | "connected"` only; no `chrome-profile`. If imported later, the
  safe guard set is: evict only `kindTag === "headless"` + `pending.size === 0`
  + `state === "alive"`; never connected/spawned-attached/held.
- Reopen trigger: a concrete JWC long-session RSS regression with many headless
  tabs. Until then, DEFER with this rationale.

## Part 3 — Changes shipped this phase

### Code (Slice A) — commit `2401b6a`
- `packages/coding-agent/src/web/search/providers/utils.ts` — runtime global
  `searchHardTimeoutMs` + `get/setSearchHardTimeoutMs` (clamp [5s,600s],
  ignore non-finite); `withHardTimeout` default → `getSearchHardTimeoutMs()`.
- `packages/coding-agent/src/config/settings-schema.ts` — `web_search.timeout`
  number setting (default 300, validate 5-600, submenu options).
- `packages/coding-agent/src/web/search/index.ts` — apply setting (sec→ms) in
  `WebSearchTool.execute` before provider dispatch.
- `schemas/config.schema.json` — regenerated (`bun run generate-schemas`).
- `packages/coding-agent/test/tools/web-search-hard-timeout.test.ts` — focused
  test (7 pass).

### Docs
- This devlog.
- Card `10.058` → decision table + Done-Gate + retire to `_fin/10/`.
- MOC row 058 + 007 closure row.

## Verification gates
- Focused test: `bun test web-search-hard-timeout.test.ts` → 7 pass.
- Types: `bun run check:types` (coding-agent) → exit 0.
- Schema: `bun run check:schemas` → clean (no drift).
- Regression: full `test/tools/` → 850 pass; the 11 `SkillTool` failures are
  pre-existing and unrelated to web-search (no `web_search`/`withHardTimeout`
  references in `skill.test.ts`).
- `git diff --check` clean.

## Non-goals
- The five P3 polish items stay open on a future bundle, not this cycle.
- Memory GC stays deferred with the recorded rationale; reopen only on a
  concrete JWC long-session memory regression.
- No push.
