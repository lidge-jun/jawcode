import { describe, expect, test } from "bun:test";
import { getBundledModel } from "../src/models";
import {
	deriveToolChoiceSupport,
	isClaudeForcedToolChoiceIncapableModelId,
} from "../src/utils/tool-choice-capability";

// chase 10.036-B — model catalog/profile drift guard for JWC-supported providers.
// Pins GJC #482 (0622573c "Fix Anthropic Fable forced tool_choice 400s") in JWC terms:
// claude-fable-5 must keep forced tool use DISABLED, else Anthropic returns
// 400 "tool_choice forces tool use is not compatible with this model".
describe("Fable forced-tool_choice catalog drift (10.036-B / GJC #482)", () => {
	test("claude-fable-5 bundled model keeps forced tool_choice disabled", () => {
		const model = getBundledModel("anthropic", "claude-fable-5");
		expect(model).toBeDefined();
		// Effective tool-choice support must be "auto" (forced tool use disabled),
		// whether set statically in the bundle or derived from compat flags.
		expect(deriveToolChoiceSupport(model.compat).support).toBe("auto");
	});

	test("forced-tool_choice-incapable predicate pins fable/mythos, not normal Claude", () => {
		expect(isClaudeForcedToolChoiceIncapableModelId("claude-fable-5")).toBe(true);
		expect(isClaudeForcedToolChoiceIncapableModelId("claude-mythos")).toBe(true);
		expect(isClaudeForcedToolChoiceIncapableModelId("claude-opus-4-8")).toBe(false);
	});
});
