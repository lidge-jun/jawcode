import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { resetSettingsForTest, Settings, settings } from "@jawcode-dev/coding-agent/config/settings";
import { toolRenderModeIsCommit } from "@jawcode-dev/coding-agent/modes/utils/ui-helpers";

/**
 * 260703 WP6a-B — tool render mode predicate. `commit` = live-zone previews +
 * collapsed-on-completion + ctrl+o; `verbose` = gjc-parity permanent full
 * expansion (event-controller stops minimizing, input-controller gates the
 * fold toggles). Unset falls back to the brand default.
 */

beforeAll(async () => {
	await Settings.init({ inMemory: true });
});

afterAll(() => {
	resetSettingsForTest();
});

afterEach(() => {
	settings.set("tool.renderMode", undefined);
});

describe("toolRenderModeIsCommit (260703 WP6a-B)", () => {
	it("explicit settings win over the brand default", () => {
		settings.set("tool.renderMode", "commit");
		expect(toolRenderModeIsCommit()).toBe(true);
		settings.set("tool.renderMode", "verbose");
		expect(toolRenderModeIsCommit()).toBe(false);
	});

	it("unset resolves to a brand default without throwing", () => {
		settings.set("tool.renderMode", undefined);
		expect(typeof toolRenderModeIsCommit()).toBe("boolean");
	});
});
