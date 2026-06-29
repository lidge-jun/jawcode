# 310 Phase 31 plan — 10.036-B Fable forced-tool_choice catalog drift guard

> Goal: JWC-native chase implementation (active). Work-phase 31 = implement chase sub-slice `10.036-B`.
> Card: `struct_har/chase/10.036_gjc_chase_ai_provider_auth_model_catalog.md` (`10.036-A` closed in phase 14).
> Risk class: **C2** (net-new focused test, capability-flag assertion only — no credential/token/socket surface, so no security review needed). Card overall is C4, but this slice touches reliability metadata, not an auth control.

## Objective

Add the single missing JWC-native regression guard for `10.036-B` ("model catalog/profile drift
tests for JWC-supported providers only"): pin that the JWC-supported model **`claude-fable-5`**
keeps forced tool-choice **disabled** (`toolChoiceSupport: "auto"`), translating GJC #482
(`0622573c` "Fix Anthropic Fable forced tool_choice 400s") into a JWC test. No product code change.

## Why this is the right (and only) -B gap

P-phase read-only investigation mapped the three GJC catalog-drift subjects and found:

| Drift subject | JWC owner | Existing coverage | Action |
|---|---|---|---|
| MiniMax-M3 context cap (512K) | `provider-models/descriptors.ts:305-307` | **fully pinned** — `packages/ai/test/issue-385-minimax-m3.test.ts:14-32` | none |
| GLM-5.x cost/context (zai) | generated `models.json` (no JWC overlay) | runtime proxy pinned (`model-registry.test.ts:1304-1318`); catalog cost/context generator-owned | **skip** — pinning guards build artifact, not JWC code (low value) |
| **Fable-5 forced-tool_choice** | `utils/tool-choice-capability.ts:20-22` + `models.ts:11-20` + `model-thinking.ts:387-393` | **ZERO tests** (no test references the predicate or `claude-fable-5`) | **ADD focused test** |

The Fable invariant is enforced at load by `applyBundledCompatDefaults` and independently by
`enrichModelThinking`, and depends on the predicate `isClaudeForcedToolChoiceIncapableModelId`
(regex `/(?:^|[/.])claude-(?:mythos|fable)(?:-|$)/i`). A model-id rename, a `models.json` regen,
or a regex regression would silently re-introduce the exact Anthropic 400 that GJC #482 fixed —
with no test to catch it.

## Plan of work (PABCD)

### A — Plan audit (independent, read-only)
Verify: (1) the gap is real (no existing test pins the Fable tool-choice invariant); (2) the
proposed imports/symbols resolve (`getBundledModel` from `../src/models`,
`isClaudeForcedToolChoiceIncapableModelId` + `deriveToolChoiceSupport` from
`../src/utils/tool-choice-capability`); (3) `getBundledModel("anthropic","claude-fable-5")`
actually resolves with forced-tool_choice disabled (so the test will pass green, not red);
(4) scope is minimal (one file, no product code, no over-reach into GLM/zai generator data).

### B — Build (Boss writes)
**NEW** `packages/ai/test/fable-tool-choice-catalog.test.ts` — a single focused test file:

```ts
import { describe, expect, test } from "bun:test";
import { getBundledModel } from "../src/models";
import {
  deriveToolChoiceSupport,
  isClaudeForcedToolChoiceIncapableModelId,
} from "../src/utils/tool-choice-capability";

describe("Fable forced-tool_choice catalog drift (10.036-B / GJC #482)", () => {
  test("claude-fable-5 bundled model keeps forced tool_choice disabled", () => {
    const model = getBundledModel("anthropic", "claude-fable-5");
    expect(model).toBeDefined();
    // effective support must be "auto" (forced tool use disabled) — static or derived
    expect(deriveToolChoiceSupport(model.compat).support).toBe("auto");
  });

  test("forced-tool_choice-incapable predicate pins fable, not normal Claude", () => {
    expect(isClaudeForcedToolChoiceIncapableModelId("claude-fable-5")).toBe(true);
    expect(isClaudeForcedToolChoiceIncapableModelId("claude-mythos")).toBe(true);
    expect(isClaudeForcedToolChoiceIncapableModelId("claude-opus-4-8")).toBe(false);
  });
});
```

Exact assertions finalized against real behavior while running the test in B; if
`getBundledModel(...).compat` carries the static `toolChoiceSupport`, the first assertion may also
check `model.compat?.toolChoiceSupport === "auto"` directly. Keep it to this one file.

**MODIFY** `struct_har/chase/10.036_gjc_chase_ai_provider_auth_model_catalog.md` — append a
`## JWC Phase 31 Evidence — 10.036-B` section: gap, GJC #482 citation, owner files, the new test,
and status (`10.036-B` closed; `10.036-C` onboarding/import still conditional → card stays active,
not moved to `_fin`).

### C — Check
- `bun test packages/ai/test/fable-tool-choice-catalog.test.ts` (must pass, 0 fail).
- `cd packages/ai && bun run check:types` (exit 0).
- `git diff --check` on the staged set. (No `tsc` — constraint #8.)

### D — Done
Summarize; record commit hash. Card 10.036 remains active (awaits `10.036-C` assessment).

## File change map

| Action | Path |
|---|---|
| NEW | `devlog/_plan/260628_…/310_phase31_fable_tool_choice_catalog_plan.md` (this) |
| NEW | `311_…audit.md`, `312_…build.md`, `313_…check.md` |
| NEW | `packages/ai/test/fable-tool-choice-catalog.test.ts` |
| MODIFY | `struct_har/chase/10.036_gjc_chase_ai_provider_auth_model_catalog.md` (add 10.036-B evidence) |

## Constraints honored

- JWC product symbols only (`claude-fable-5`, `../src/...`); GJC `0622573c`/#482 are citations.
- No `tsc`; `bun run check:types`. Preserve `devlog/.gitignore` + `devlog/_tmp/` (constraint #7).
- Atomic commit for this slice only. No GLM/zai over-scope (generator-owned data).
- Card not closed to `_fin` this phase — only sub-slice `10.036-B`; final close awaits `10.036-C`.
