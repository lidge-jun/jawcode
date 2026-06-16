import { beforeAll, describe, expect, it } from "bun:test";
import { HookSelectorComponent } from "@gajae-code/coding-agent/modes/components/hook-selector";
import { getThemeByName, setThemeInstance } from "@gajae-code/coding-agent/modes/theme/theme";
import { CURSOR_MARKER } from "@gajae-code/tui";

beforeAll(async () => {
	const theme = await getThemeByName("red-claw");
	if (theme) setThemeInstance(theme);
});

const TITLE = "Interview question";
const OPTIONS = ["1. Alpha", "2. Beta", "3. Gamma", "4. Delta"];

function renderText(component: HookSelectorComponent, width = 80): string {
	return Bun.stripANSI(component.render(width).join("\n"));
}

describe("HookSelectorComponent output panel (082.3 v2)", () => {
	it("lists only numbered options; output panel shows N. Type your own", () => {
		const component = new HookSelectorComponent(
			TITLE,
			OPTIONS,
			() => {},
			() => {},
			{
				wrapFocused: true,
				customInputListSlot: true,
				listSlotCustomInput: { onSubmit: () => {} },
			},
		);
		const rendered = renderText(component);
		expect(rendered).toContain("1. Alpha");
		expect(rendered).toContain("4. Delta");
		expect(rendered).toContain("5. Type your own");
		expect(rendered).not.toMatch(/❯\s*5\./);
	});

	it("clears the option cursor while the output panel is focused", () => {
		const component = new HookSelectorComponent(
			TITLE,
			OPTIONS,
			() => {},
			() => {},
			{
				wrapFocused: true,
				customInputListSlot: true,
				listSlotCustomInput: { onSubmit: () => {} },
			},
		);
		for (let i = 0; i < 4; i++) component.handleInput("\x1b[B");
		component.handleInput("h");
		const rendered = renderText(component);
		// Exactly one cursor: the slot heading. No option row may keep it.
		expect(rendered).toMatch(/❯\s*5\. Type your own/);
		expect(rendered).not.toMatch(/❯\s*[1-4]\./);
	});

	it("submits trimmed text from output panel on Enter", () => {
		const submitted: string[] = [];
		const component = new HookSelectorComponent(
			TITLE,
			OPTIONS,
			() => {},
			() => {},
			{
				wrapFocused: true,
				customInputListSlot: true,
				listSlotCustomInput: { onSubmit: text => submitted.push(text) },
			},
		);
		for (let i = 0; i < 4; i++) component.handleInput("\x1b[B");
		component.handleInput("h");
		component.handleInput("i");
		component.handleInput("\r");
		expect(submitted).toEqual(["hi"]);
	});

	it("inserts bare j/k while typing in the output panel", () => {
		const submitted: string[] = [];
		const component = new HookSelectorComponent(
			TITLE,
			OPTIONS,
			() => {},
			() => {},
			{
				wrapFocused: true,
				customInputListSlot: true,
				listSlotCustomInput: { onSubmit: text => submitted.push(text) },
			},
		);
		for (let i = 0; i < 4; i++) component.handleInput("\x1b[B");
		component.handleInput("j");
		component.handleInput("k");
		component.handleInput("\r");
		expect(submitted).toEqual(["jk"]);
	});

	it("keeps a constant height and a closed box when slot focus toggles", () => {
		const component = new HookSelectorComponent(
			TITLE,
			OPTIONS,
			() => {},
			() => {},
			{
				wrapFocused: true,
				customInputListSlot: true,
				outline: true,
				listSlotCustomInput: { onSubmit: () => {} },
			},
		);
		const before = component.render(80);
		for (let i = 0; i < 4; i++) component.handleInput("\x1b[B");
		component.handleInput("h");
		const after = component.render(80);
		// Constant height: toggling slot focus must not add/remove rows (the
		// height jump fed the scrollback-artifact differ path — bucket box).
		expect(after.length).toBe(before.length);
		// The editor row keeps its right border with no spurious ellipsis (the
		// zero-width cursor marker used to be counted as 5 visible columns).
		const stripped = after.map(line => Bun.stripANSI(line.replaceAll(CURSOR_MARKER, "")));
		const editorRow = stripped.find(line => line.includes("> h"));
		expect(editorRow).toBeDefined();
		expect(editorRow).not.toContain("…");
		expect(editorRow?.trimEnd().endsWith("│")).toBe(true);
	});

	it("moves from output panel back to last option on Up", () => {
		const component = new HookSelectorComponent(
			TITLE,
			OPTIONS,
			() => {},
			() => {},
			{
				wrapFocused: true,
				customInputListSlot: true,
				listSlotCustomInput: { onSubmit: () => {} },
			},
		);
		for (let i = 0; i < 4; i++) component.handleInput("\x1b[B");
		component.handleInput("\x1b[A");
		const rendered = renderText(component);
		expect(rendered).toContain("❯ 4. Delta");
	});
});
