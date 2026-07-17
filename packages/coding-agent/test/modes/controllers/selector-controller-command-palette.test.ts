import { beforeAll, describe, expect, it, vi } from "bun:test";
import type { CommandPalette, Component, OverlayHandle } from "@jawcode-dev/tui";
import { SelectorController } from "../../../src/modes/controllers/selector-controller";
import { initTheme } from "../../../src/modes/theme/theme";
import type { InteractiveModeContext } from "../../../src/modes/types";

beforeAll(() => {
	initTheme();
});

describe("SelectorController command palette", () => {
	it("opens, searches, dispatches the selected action, and closes", async () => {
		const overlays: Component[] = [];
		const handles: OverlayHandle[] = [];
		const showOverlay = vi.fn((component: Component) => {
			overlays.push(component);
			const handle = {
				hide: vi.fn(),
				setHidden: vi.fn(),
				isHidden: vi.fn(() => false),
			};
			handles.push(handle);
			return handle;
		});
		const resume = vi.fn();
		const ctx = {
			keybindings: { getKeys: () => ["ctrl+r"] },
			showError: vi.fn(),
			ui: {
				requestRender: vi.fn(),
				setFocus: vi.fn(),
				showOverlay,
			},
		} as unknown as InteractiveModeContext;
		const controller = new SelectorController(ctx);

		controller.showCommandPalette(
			[{ name: "help", description: "Show help" }],
			[
				{ id: "app.session.new", label: "Create new session", handler: vi.fn() },
				{ id: "app.session.resume", label: "Resume session", handler: resume },
			],
			async () => {},
		);

		expect(showOverlay).toHaveBeenCalledTimes(1);
		const palette = overlays[0] as CommandPalette;
		for (const key of "resume") palette.handleInput(key);
		expect(palette.render(72).join("\n")).toContain("Resume session");
		expect(palette.render(72).join("\n")).not.toContain("Create new session");

		palette.handleInput("\r");
		await Promise.resolve();
		await Promise.resolve();

		expect(resume).toHaveBeenCalledTimes(1);
		expect(handles[0]?.hide).toHaveBeenCalledTimes(1);

		controller.showCommandPalette([], [], async () => {});
		(overlays[1] as CommandPalette).handleInput("\x1b");
		expect(handles[1]?.hide).toHaveBeenCalledTimes(1);
	});
});
