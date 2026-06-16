import { describe, expect, it } from "bun:test";
import { Settings } from "@gajae-code/coding-agent/config/settings";
import { __computerUseInternals, ComputerUseTool, type ToolSession } from "@gajae-code/coding-agent/tools";
import cuaDriverTools from "../fixtures/cua-driver-tools.json" with { type: "json" };

function createSession(): ToolSession {
	return {
		cwd: "/tmp/test",
		hasUI: false,
		getSessionFile: () => null,
		getSessionSpawns: () => "*",
		settings: Settings.isolated(),
	};
}

describe("ComputerUseTool", () => {
	it("is discoverable and registers a session cleanup", () => {
		const cleanups = new Map<string, () => Promise<void> | void>();
		const tool = new ComputerUseTool({
			...createSession(),
			registerSessionCleanup: (name, cleanup) => cleanups.set(name, cleanup),
		});

		expect(tool.name).toBe("computer_use");
		expect(tool.loadMode).toBe("discoverable");
		expect(tool.summary).toContain("desktop");
		expect(cleanups.has("computer_use.lazy_cua_driver")).toBe(true);
	});

	it("maps every MVP proxy action to a pinned raw cua-driver backend tool", () => {
		const rawTools = new Set(cuaDriverTools as string[]);
		const cases = [
			{ action: "start_session", session: "test-session" },
			{ action: "list_apps" },
			{ action: "observe", pid: 1, window_id: 2 },
			{ action: "window_state", pid: 1, window_id: 2 },
			{ action: "click", pid: 1, element_index: 3 },
			{ action: "click", pid: 1, x: 10, y: 20 },
			{ action: "type_text", pid: 1, text: "hello" },
			{ action: "press_key", pid: 1, key: "enter" },
			{ action: "scroll", pid: 1, dy: 5 },
			{ action: "end_session", session: "test-session" },
		] as const;

		for (const input of cases) {
			const backendCall = __computerUseInternals.buildBackendCall(input);
			expect(rawTools.has(backendCall.toolName)).toBe(true);
		}
	});

	it("validates action-specific required parameters before backend dispatch", () => {
		expect(() => __computerUseInternals.buildBackendCall({ action: "click", pid: 1 })).toThrow(
			"Action 'click' requires either 'element_index' or both 'x' and 'y'.",
		);
		expect(() => __computerUseInternals.buildBackendCall({ action: "scroll", pid: 1 })).toThrow(
			"Action 'scroll' requires at least one of 'dx' or 'dy'.",
		);
		expect(() => __computerUseInternals.buildBackendCall({ action: "type_text", pid: 1, text: "" })).toThrow(
			"Missing required parameter 'text'.",
		);
	});
});
