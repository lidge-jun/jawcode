import { beforeAll, describe, expect, it } from "bun:test";
import { resetSettingsForTest, Settings } from "@jawcode-dev/coding-agent/config/settings";
import * as themeModule from "@jawcode-dev/coding-agent/modes/theme/theme";
import { astEditToolRenderer } from "@jawcode-dev/coding-agent/tools/ast-edit";

beforeAll(async () => {
	resetSettingsForTest();
	await Settings.init({ inMemory: true, cwd: process.cwd() });
});

async function getUiTheme() {
	await themeModule.initTheme(false, undefined, undefined, "red-claw", "blue-crab");
	const theme = await themeModule.getThemeByName("red-claw");
	expect(theme).toBeDefined();
	return theme!;
}

type RenderOptions = Parameters<typeof astEditToolRenderer.renderCall>[1];

describe("astEditToolRenderer status line", () => {
	it("collapses whitespace runs in a single-op pattern shown on the status line", async () => {
		const uiTheme = await getUiTheme();
		const component = astEditToolRenderer.renderCall(
			{ ops: [{ pat: "callFn(\n  $A,\n   $B\n)", out: "newFn($A, $B)" }] },
			{ expanded: false } as RenderOptions,
			uiTheme,
		);

		const rendered = Bun.stripANSI(component.render(200).join("\n"));
		// Multi-line / multi-space pattern collapses to single spaces and trims.
		expect(rendered).toContain("callFn( $A, $B )");
		// The raw multi-line / multi-space form must not leak onto the status line.
		expect(rendered).not.toContain("   $B");
	});
});
