import { describe, expect, it } from "bun:test";
import { SettingsList, type SettingsListTheme } from "@jawcode-dev/tui";

// 260613 00:08 crash: an unset setting (default: undefined) leaked a
// non-string currentValue into the list renderer and truncateToWidth threw
// from the native binding, killing the whole TUI mid-frame.
const theme: SettingsListTheme = {
	cursor: "> ",
	label: (text: string) => text,
	value: (text: string) => text,
	hint: (text: string) => text,
	description: (text: string) => text,
};

describe("SettingsList undefined currentValue (crash regression)", () => {
	it("renders without throwing when currentValue is undefined", () => {
		const list = new SettingsList(
			[
				{ id: "a", label: "Normal", currentValue: "on", values: ["on", "off"] },
				{
					id: "b",
					label: "Runtime Default",
					currentValue: undefined as unknown as string,
					values: ["commit", "verbose"],
				},
			],
			10,
			theme,
			() => {},
			() => {},
		);
		expect(() => list.render(60)).not.toThrow();
		const lines = list.render(60).map(line => Bun.stripANSI(line));
		expect(lines.some(line => line.includes("Runtime Default"))).toBeTrue();
	});
});
