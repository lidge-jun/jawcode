# 312 Phase 31 build — 10.036-B Fable tool-choice catalog drift guard

Build type: net-new focused test (C2). No product-code change.

## Files changed

| Action | Path | Change |
|---|---|---|
| NEW | `packages/ai/test/fable-tool-choice-catalog.test.ts` | 2 tests: (1) `getBundledModel("anthropic","claude-fable-5")` defined + `deriveToolChoiceSupport(model.compat).support === "auto"`; (2) predicate pins fable/mythos incapable, `claude-opus-4-8` capable. |
| MODIFY | `struct_har/chase/10.036_gjc_chase_ai_provider_auth_model_catalog.md` | Added `## JWC Phase 31 Evidence — 10.036-B`; status: -B closed, -A closed (ph14), -C conditional (card stays active). |
| NEW | `310/311/312/313` Phase 31 PABCD records. |

## Deliberately NOT changed

- No product code — the invariant already lives at `tool-choice-capability.ts` + `models.ts` (`applyBundledCompatDefaults`) + `model-thinking.ts` (`enrichModelThinking`); this slice only pins it against regression.
- GLM/zai catalog cost/context — generator-owned (`models.json`), out of JWC owner scope.
- `devlog/.gitignore`, `devlog/_tmp/` — preserved unstaged (constraint #7).

## B-phase verification

- `bun test packages/ai/test/fable-tool-choice-catalog.test.ts` → 2 pass / 0 fail / 5 expect().
- `cd packages/ai && bun run check:types` → exit 0.
