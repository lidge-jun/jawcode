import { beforeAll, describe, expect, it } from "bun:test";
import { type HelpCatalogEntry, HelpSelectorComponent } from "@gajae-code/coding-agent/modes/components/help-selector";
import { getThemeByName, setThemeInstance } from "@gajae-code/coding-agent/modes/theme/theme";
import { buildHelpMarkdown } from "@gajae-code/coding-agent/modes/utils/help-markdown";
import { BUILTIN_SLASH_COMMANDS_INTERNAL } from "@gajae-code/coding-agent/slash-commands/builtin-registry";
import type { SlashCommandRuntime } from "@gajae-code/coding-agent/slash-commands/types";

beforeAll(async () => {
	const theme = await getThemeByName("red-claw");
	if (theme) setThemeInstance(theme);
});

const keybindings = { getDisplayString: () => "ctrl+c" };

describe("buildHelpMarkdown (99.20.08)", () => {
	it("renders the getting-around primer and the full command catalog", () => {
		const md = buildHelpMarkdown({
			commands: [
				{ name: "model", description: "Switch model" },
				{ name: "help", description: "Show usage help" },
			],
			keybindings,
		});
		expect(md).toContain("**Getting around**");
		expect(md).toContain("`!command`");
		expect(md).toContain("`/hotkeys`");
		expect(md).toContain("**Commands** (2)");
		expect(md).toContain("| `/help` | Show usage help |");
		expect(md).toContain("| `/model` | Switch model |");
	});

	it("sorts commands by name and dedupes repeated names", () => {
		const md = buildHelpMarkdown({
			commands: [
				{ name: "zeta", description: "last" },
				{ name: "alpha", description: "first" },
				{ name: "alpha", description: "duplicate — dropped" },
			],
			keybindings,
		});
		expect(md.indexOf("/alpha")).toBeLessThan(md.indexOf("/zeta"));
		expect(md).toContain("**Commands** (2)");
		expect(md).not.toContain("duplicate — dropped");
	});

	it("escapes pipes in descriptions so the table survives", () => {
		const md = buildHelpMarkdown({
			commands: [{ name: "fast", description: "Toggle [on|off]" }],
			keybindings,
		});
		expect(md).toContain("Toggle [on\\|off]");
	});
});

describe("/help builtin spec (99.20.08)", () => {
	const spec = BUILTIN_SLASH_COMMANDS_INTERNAL.find(command => command.name === "help");

	it("is registered with both TUI and text/ACP handlers", () => {
		expect(spec).toBeDefined();
		expect(spec?.handleTui).toBeDefined();
		expect(spec?.handle).toBeDefined();
	});

	it("text/ACP handle outputs the builtin command catalog", async () => {
		let output = "";
		const runtime = {
			output: (text: string) => {
				output = text;
			},
		} as unknown as SlashCommandRuntime;
		const result = await spec?.handle?.({ name: "help", args: "", text: "/help" }, runtime);
		expect(result).toEqual({ consumed: true });
		expect(output).toContain("/help — List available commands");
		expect(output).toContain("/hotkeys — Show all keyboard shortcuts");
		expect(output.split("\n").length).toBeGreaterThan(20);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Docked catalog selector — 99.20.08 (나) 확정 (model-selector grammar)
// ═══════════════════════════════════════════════════════════════════════════

const CATALOG: HelpCatalogEntry[] = [
	{ name: "model", description: "Select default model", origin: "builtin" },
	{ name: "compact", description: "Compact the conversation", origin: "builtin" },
	{ name: "k-writing", description: "한국어 글쓰기 톤 보정", origin: "skill" },
	{ name: "deploy-check", description: "Run deploy checklist", origin: "custom" },
];

function makeSelector(opts?: { onSelect?: (name: string) => void; onCancel?: () => void }) {
	return new HelpSelectorComponent(CATALOG, opts?.onSelect ?? (() => {}), opts?.onCancel ?? (() => {}));
}

function renderText(selector: HelpSelectorComponent, width = 90): string {
	return Bun.stripANSI(selector.render(width).join("\n"));
}

describe("HelpSelectorComponent (99.20.08 나)", () => {
	it("opens on the Built-in tab with per-tab counts and only builtin rows", () => {
		const selector = makeSelector();
		expect(selector.getActiveTabIdForTest()).toBe("builtin");
		const rendered = renderText(selector);
		expect(rendered).toContain("Built-in (2)");
		expect(rendered).toContain("Skills (1)");
		expect(rendered).toContain("Custom (1)");
		expect(rendered).toContain("/compact");
		expect(rendered).not.toContain("/k-writing");
	});

	it("tab cycles sections — Skills shows skill commands only", () => {
		const selector = makeSelector();
		selector.handleInput("\t");
		expect(selector.getActiveTabIdForTest()).toBe("skill");
		const rendered = renderText(selector);
		expect(rendered).toContain("/k-writing");
		expect(rendered).not.toContain("/compact");
	});

	it("sorts rows by name and filters with incremental search", () => {
		const selector = makeSelector();
		const entries = selector.getFilteredEntriesForTest().map(entry => entry.name);
		expect(entries).toEqual(["compact", "model"]); // localeCompare 정렬
		selector.handleInput("m");
		selector.handleInput("o");
		expect(selector.getFilteredEntriesForTest().map(entry => entry.name)).toEqual(["model"]);
	});

	it("enter inserts the selected command via onSelect", () => {
		let picked = "";
		const selector = makeSelector({ onSelect: name => (picked = name) });
		selector.handleInput("\x1b[B"); // down → /model (compact가 첫 행)
		selector.handleInput("\r");
		expect(picked).toBe("model");
	});

	it("escape cancels via onCancel", () => {
		let cancelled = false;
		const selector = makeSelector({ onCancel: () => (cancelled = true) });
		selector.handleInput("\x1b");
		expect(cancelled).toBe(true);
	});

	it("renders a two-pane body — detail follows the cursor (260613 2창)", () => {
		const selector = makeSelector();
		// First row selected: /compact detail on the right of the pane separator.
		let rendered = renderText(selector);
		expect(rendered).toContain("│");
		expect(rendered).toContain("Compact the conversation");
		expect(rendered).toContain("built-in");
		// Move down → /model detail replaces it.
		selector.handleInput("\x1b[B");
		rendered = renderText(selector);
		expect(rendered).toContain("Select default model");
		expect(selector.getSelectedEntryForTest()?.name).toBe("model");
	});

	it("detail pane shows aliases, usage, and subcommands when present", () => {
		const selector = new HelpSelectorComponent(
			[
				{
					name: "session",
					description: "Manage sessions",
					origin: "builtin",
					aliases: ["sessions", "switch"],
					inlineHint: "<subcommand>",
					subcommands: [{ name: "list", description: "List sessions", usage: "[query]" }],
				},
			],
			() => {},
			() => {},
		);
		const rendered = renderText(selector, 100);
		expect(rendered).toContain("aliases: /sessions, /switch");
		expect(rendered).toContain("usage: /session <subcommand>");
		expect(rendered).toContain("list [query] — List sessions");
	});

	it("shows the CC-style empty message on a bare empty tab", () => {
		const selector = new HelpSelectorComponent(
			CATALOG.filter(entry => entry.origin !== "custom"),
			() => {},
			() => {},
		);
		selector.handleInput("\t"); // skills
		selector.handleInput("\t"); // custom (empty)
		expect(renderText(selector)).toContain("No custom commands found");
	});
});
