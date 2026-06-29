# 311 Phase 31 audit — 10.036-B Fable tool-choice catalog plan audit

A-phase micro-audit (C2). Independent read-only CLI sub-agent (did not write the plan).

## Verdict: PASS (no fixes)

| # | Check | Result |
|---|---|---|
| A | Test passes green | YES — `claude-fable-5` statically carries `compat.toolChoiceSupport:"auto"` in `models.json`; `getBundledModel` (`models.ts:41-44`) resolves it; `deriveToolChoiceSupport` first branch (`tool-choice-capability.ts:29-31`) → "auto". Defense-in-depth: `applyBundledCompatDefaults` (`models.ts:11-20`) would inject it anyway. |
| B | Predicate | Live node run: `claude-fable-5`→true, `claude-mythos`→true, `claude-opus-4-8`→false (regex `tool-choice-capability.ts:20-22`). |
| C | Imports/types | `getBundledModel` (`models.ts:41`), `deriveToolChoiceSupport`/`isClaudeForcedToolChoiceIncapableModelId` (`tool-choice-capability.ts:20,25`); `../src/...` relative form matches sibling `issue-385-minimax-m3.test.ts:2`. Types sound. |
| D | Gap real | Zero existing coverage (grep `claude-fable-5`/predicate/`fable` empty across ai + coding-agent tests). |
| E | Scope | One net-new test file, no product code, no GLM/zai generator-data pinning. C2. |

No required fixes. The committed assertion `deriveToolChoiceSupport(model.compat).support` is the
robust choice (green under both static and `applyBundledCompatDefaults`-derived paths).
