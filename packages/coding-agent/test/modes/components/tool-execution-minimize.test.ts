import { beforeAll, describe, expect, it } from "bun:test";
import { resetSettingsForTest, Settings } from "@jawcode-dev/coding-agent/config/settings";
import { ToolExecutionComponent } from "@jawcode-dev/coding-agent/modes/components/tool-execution";
import { ToolTranscriptOverlayComponent } from "@jawcode-dev/coding-agent/modes/components/tool-transcript-overlay";
import * as themeModule from "@jawcode-dev/coding-agent/modes/theme/theme";
import type { TUI } from "@jawcode-dev/tui";

beforeAll(async () => {
	resetSettingsForTest();
	await Settings.init({ inMemory: true, cwd: process.cwd() });
	await themeModule.initTheme(false, undefined, undefined, "red-claw", "blue-crab");
});

const uiStub = { requestRender() {} } as unknown as TUI;

function makeTool(command: string, output: string, isError = false): ToolExecutionComponent {
	const component = new ToolExecutionComponent("bash", { command }, {}, undefined, uiStub);
	component.updateResult({ content: [{ type: "text", text: output }], isError }, false);
	return component;
}

function makeGenericTool(output: string): ToolExecutionComponent {
	const component = new ToolExecutionComponent("generic_tool", { query: "full" }, {}, undefined, uiStub);
	component.updateResult({ content: [{ type: "text", text: output }], isError: false }, false);
	return component;
}

function strip(lines: string[]): string[] {
	return lines.map(line => Bun.stripANSI(line));
}

function attachCountingChild(tool: ToolExecutionComponent): { renderCount: number } {
	const counter = { renderCount: 0 };
	tool.addChild({
		render: () => {
			counter.renderCount++;
			return ["sentinel"];
		},
		invalidate() {},
	});
	return counter;
}

// 083.1: completed tools collapse to a one-line summary when a newer tool
// starts; expansion (individual or global ctrl+o) overrides minimization.
describe("ToolExecutionComponent minimize", () => {
	it("renders a one-line summary with hidden-line hint when minimized", () => {
		const tool = makeTool("ls -la", "a\nb\nc\nd");
		const fullHeight = tool.render(80).length;
		tool.setMinimized(true);
		const lines = strip(tool.render(80));
		expect(lines.length).toBe(2);
		expect(lines[0]).toBe("");
		expect(lines[1]).toContain("bash");
		expect(lines[1]).toContain("ls -la");
		expect(lines[1]).toContain(`+${fullHeight - 2} lines`);
	});

	it("does not render hidden children while minimized and still renders them when expanded", () => {
		const tool = makeTool("printf", Array.from({ length: 200 }, (_, index) => `line ${index}`).join("\n"));
		const counter = attachCountingChild(tool);

		tool.setMinimized(true);
		expect(strip(tool.render(80)).length).toBe(2);
		expect(strip(tool.render(40)).length).toBe(2);
		expect(counter.renderCount).toBe(0);

		tool.setExpanded(true);
		void tool.render(40);
		expect(counter.renderCount).toBeGreaterThan(0);
	});

	it("clears cached minimized hidden-line counts when output height changes", () => {
		const tool = makeTool("ls -la", "a\nb\nc\nd");
		void tool.render(80);
		tool.setMinimized(true);
		expect(strip(tool.render(80))[1]).toContain("lines");

		tool.updateResult({ content: [{ type: "text", text: "single" }], isError: false }, false);
		expect(strip(tool.render(80))[1]).not.toContain("+2 lines");
	});

	it("omits hidden-line hint for unseen resized or committed width instead of full-rendering", () => {
		const tool = makeTool("ls -la", "a\nb\nc\nd");
		void tool.render(80);
		tool.setMinimized(true);

		expect(strip(tool.render(40))[1]).not.toContain("lines");
		expect(strip(tool.renderCommitted(40))[1]).not.toContain("lines");

		tool.setExpanded(true);
		void tool.render(40);
		tool.setExpanded(false);
		expect(strip(tool.render(40))[1]).toContain("lines");
	});

	it("expansion overrides minimization and is reversible", () => {
		const tool = makeTool("git status", "clean");
		const fullLines = strip(tool.render(80));
		tool.setMinimized(true);
		expect(tool.render(80).length).toBe(2);
		tool.setExpanded(true);
		expect(strip(tool.render(80)).length).toBeGreaterThanOrEqual(fullLines.length);
		tool.setExpanded(false);
		expect(tool.render(80).length).toBe(2);
	});

	it("focus marker replaces the separator line without changing height", () => {
		const tool = makeTool("ls", "out");
		tool.setMinimized(true);
		const before = strip(tool.render(80));
		tool.setFocused(true);
		const after = strip(tool.render(80));
		expect(after.length).toBe(before.length);
		expect(after[0]).toContain("❯");
		tool.setFocused(false);
		expect(strip(tool.render(80))[0]).toBe("");
	});

	it("transcript overlay shows full output of minimized tools without mutating chat state", () => {
		const tool = makeTool("ls", "line1\nline2\nline3");
		tool.setMinimized(true);
		const overlay = new ToolTranscriptOverlayComponent([tool], { close() {}, requestRender() {} });
		const rendered = strip(overlay.render(100)).join("\n");
		expect(rendered).toContain("line3");
		expect(rendered).toContain("Tool transcript (1 tools");
		expect(tool.expanded).toBe(false);
		expect(tool.render(100).length).toBe(2);
	});

	it("full transcript renders generic tool output beyond ctrl+o expansion limits", () => {
		const output = Array.from({ length: 20 }, (_, index) => `generic-line-${index}`).join("\n");
		const tool = makeGenericTool(output);

		tool.setExpanded(true);
		const ctrlOOutput = strip(tool.render(100)).join("\n");
		expect(ctrlOOutput).toContain("generic-line-11");
		expect(ctrlOOutput).not.toContain("generic-line-19");

		const transcriptOutput = strip(tool.renderFullTranscript(100)).join("\n");
		expect(transcriptOutput).toContain("generic-line-19");
		expect(transcriptOutput).not.toContain("more lines");
		expect(tool.expanded).toBe(true);
	});

	it("full transcript renders generic JSON beyond ctrl+o depth and scalar limits", () => {
		const longScalar = `${"x".repeat(2100)}JSON_TAIL_MARKER`;
		const deepJson = {
			l1: { l2: { l3: { l4: { l5: { l6: { l7: { l8: { value: "DEEP_FULL_VALUE" } } } } } } } },
			longScalar,
		};
		const tool = makeGenericTool(JSON.stringify(deepJson));

		const transcriptOutput = strip(tool.renderFullTranscript(160)).join("\n");

		expect(transcriptOutput).toContain("DEEP_FULL_VALUE");
		expect(transcriptOutput).toContain("JSON_TAIL_MARKER");
		expect(transcriptOutput).not.toContain("\n …");
	});
	it("tool transcript overlay is scoped to supplied tool components", () => {
		const tool = makeTool("printf 'tool-only-output\\n'", "tool-only-output\n");
		const overlay = new ToolTranscriptOverlayComponent([tool], { close() {}, requestRender() {} });
		const rendered = strip(overlay.render(100)).join("\n");

		expect(rendered).toContain("tool-only-output");
		expect(rendered).not.toContain("SESSION_MARKER");
		expect(rendered).not.toContain("Full transcript");
	});

	it("keeps the error icon and first error line when minimized", () => {
		const tool = makeTool("false", "command failed: exit 1\ndetails follow", true);
		tool.setMinimized(true);
		const lines = strip(tool.render(80));
		expect(lines.length).toBe(2);
		expect(lines[1]).toContain("command failed: exit 1");
		expect(lines[1]).not.toContain("details follow");
	});
});
