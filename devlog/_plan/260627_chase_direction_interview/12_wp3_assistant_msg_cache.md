# WP3 — 10.013 adapt: assistant-message content-block cache

> PABCD work-phase 3. Class **C2** (internal TUI render perf; no public contract change).
> Card decision (Decision A) = **adapt**. Source: gjc `assistant-message.ts` `#contentBlocksCache`.
> Gap verified: jwc lacks the cache; jwc HAS thinking-collapse the upstream lacks → port must coexist.

## Outcome

`AssistantMessageComponent.updateContent` reuses rendered content-block components from a
WeakMap keyed by content-block identity, instead of constructing a fresh `Markdown` per call.
Text blocks reuse via `setText` across streaming chunks; expanded thinking reuses the cached
Markdown. Collapsed/hidden one-line summaries keep rendering cheap `Text` and bypass the cache,
so thinking collapse/expand is unaffected.

## Why coexistence is safe

- A content item is EITHER `{type:"text",text}` OR `{type:"thinking",thinking}`; the WeakMap key
  is the content object, so text/thinking never collide.
- Only the EXPANDED renders (text Markdown, expanded-thinking Markdown) go through the cache.
  The collapsed summary and hidden label are cheap `Text`, created inline, never cached — so a
  cached expanded Markdown is never served in a collapsed frame.
- `Container.clear()` (`tui.ts:232`) only empties `children = []` (no dispose), so re-adding a
  cached component after clear is safe — proven by the gjc reference using the same pattern.

## Changes — `packages/coding-agent/src/modes/components/assistant-message.ts`

1. Import: `import { Container, Image, ... }` → add `type Component`
   (precedent: `packages/coding-agent/src/lsp/render.ts:12`).
2. Field (after `#responseHeader`):
   `#contentBlocksCache = new WeakMap<object, { source: string; component: Component }>();`
3. Add `#renderTextBlock(content: {text:string}): Component` — cache-get; if `source===text`
   return cached; else if cached Markdown → `setText` + update source; else new Markdown + cache.
   (Omit gjc's `renderDeepInterviewAssistantText` — jwc uses jaw-interview, not deep-interview.)
4. Add `#renderThinkingBlock(content: {thinking:string}): Markdown` — cache-get; if
   `source===thinking` and cached is Markdown return it; else new themed Markdown + cache.
5. Wire into `updateContent`:
   - text branch: `addChild(new Markdown(text,...))` → `addChild(this.#renderTextBlock(content))`
   - thinking expanded branch (`#thinkingExpanded || isStreamingTail`): `new Markdown(...)` →
     `this.#renderThinkingBlock(content)`. Collapsed/hidden branches unchanged.

## Test — NEW `packages/coding-agent/test/assistant-message-cache.test.ts`

- text block stays correct across re-renders + in-place text growth (setText path, no stale).
- thinking expand → collapse → re-expand stays correct WITH cache (cache never serves stale
  expanded content in a collapsed frame; re-expand reuses cached Markdown).
- existing `test/thinking-collapse.test.ts` is the regression guard (must stay green).

## Verification (C)

- `bun test packages/coding-agent/test/assistant-message-cache.test.ts packages/coding-agent/test/thinking-collapse.test.ts` → green.
- `bunx tsc --noEmit -p packages/coding-agent` (or repo `check:ts` scoped) → no new errors.
- Then move 10.013 card → `_fin/10/`, update MOC + follow_index, devlog cycle note.

## C verification result

- ✅ Implementation landed (`d70b885`): import `Component`, `#contentBlocksCache` field,
  `#renderTextBlock` (setText reuse) + `#renderThinkingBlock` (instanceof guard), wired into
  `updateContent` text + expanded-thinking branches; collapsed/hidden unchanged.
- ✅ `bunx tsc --noEmit -p packages/coding-agent/tsconfig.json` → **0 errors** (tsconfig includes
  `test/`, so both src and the new test type-check).
- ✅ A-audit **PASS** (collapse coexistence, streaming, full-transcript, container-reuse all traced).
- ✅ `git diff` reviewed; ✅ card retired → `_fin/10/`, `10_gjc_chase_MOC.md` row → `_fin` + `✅`,
  zero chase-root links to 10.013 remain.
- ⚠️ **Residual**: runtime `bun test` BLOCKED by pre-existing native version drift
  (`pi-natives` 1.0.0 crate vs `@jawcode-dev/natives` 1.0.2 loader sentinel `__piNativesV1_0_2`;
  `bun --cwd=packages/natives run build` rebuilds 1.0.0, still mismatched — documented out-of-scope
  in `devlog/_fin/.../260626_struct_har_chase_refresh`). Test is written + type-checks; re-run
  `bun test packages/coding-agent/test/assistant-message-cache.test.ts` once natives are re-synced.
- The 10.013 outbound `bands/080_tui` link is the same pre-existing bands-consolidation staleness
  recorded in WP2 (faithfully depth-adjusted, not a regression).

## Commit scope

- `assistant-message.ts` (impl) + new test (atomic commit 1).
- card decision already recorded (WP1); 10.013 `_fin` move + MOC/index (atomic commit 2).
- this plan doc. No push.
