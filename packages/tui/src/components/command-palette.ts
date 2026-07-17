import { fuzzyFilter } from "../fuzzy";
import { getKeybindings } from "../keybindings";
import type { Component, Focusable } from "../tui";
import { padding, replaceTabs, truncateToWidth, visibleWidth } from "../utils";
import { Input } from "./input";

const DEFAULT_MAX_VISIBLE = 8;

function singleLine(text: string): string {
	return replaceTabs(text)
		.replace(/[\r\n]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export interface CommandPaletteEntry {
	id: string;
	label: string;
	description: string;
	keybinding?: string;
	searchText?: string;
}

export interface CommandPaletteTheme {
	border: (text: string) => string;
	title: (text: string) => string;
	queryPrefix: (text: string) => string;
	selectedPrefix: (text: string) => string;
	selectedText: (text: string) => string;
	description: (text: string) => string;
	muted: (text: string) => string;
	cursor: string;
}

export interface CommandPaletteOptions {
	maxVisible?: number;
	onSelect: (entry: CommandPaletteEntry) => void;
	onCancel: () => void;
	onChange?: () => void;
}

/** Searchable, keyboard-driven command chooser suitable for a TUI overlay. */
export class CommandPalette implements Component, Focusable {
	readonly #input = new Input();
	readonly #entries: ReadonlyArray<CommandPaletteEntry>;
	readonly #maxVisible: number;
	#filteredEntries: ReadonlyArray<CommandPaletteEntry>;
	#selectedIndex = 0;
	#focused = false;

	constructor(
		entries: ReadonlyArray<CommandPaletteEntry>,
		private readonly theme: CommandPaletteTheme,
		private readonly options: CommandPaletteOptions,
	) {
		this.#entries = entries;
		this.#filteredEntries = entries;
		this.#maxVisible = Math.max(1, options.maxVisible ?? DEFAULT_MAX_VISIBLE);
	}

	get focused(): boolean {
		return this.#focused;
	}

	set focused(focused: boolean) {
		this.#focused = focused;
		this.#input.focused = focused;
	}

	invalidate(): void {}

	render(width: number): string[] {
		const contentWidth = Math.max(1, width - 4);
		const border = this.theme.border("─".repeat(Math.max(1, width)));
		const inputLine = this.#input.render(contentWidth)[0] ?? "";
		const lines = [border, this.theme.title("  Commands"), `${this.theme.queryPrefix("  › ")}${inputLine}`, ""];

		if (this.#filteredEntries.length === 0) {
			lines.push(this.theme.muted("  No matching commands"), border);
			return lines;
		}

		const start = Math.max(
			0,
			Math.min(
				this.#selectedIndex - Math.floor(this.#maxVisible / 2),
				this.#filteredEntries.length - this.#maxVisible,
			),
		);
		const end = Math.min(start + this.#maxVisible, this.#filteredEntries.length);
		for (let index = start; index < end; index += 1) {
			const entry = this.#filteredEntries[index];
			if (!entry) continue;
			const selected = index === this.#selectedIndex;
			const prefixText = `${this.theme.cursor} `;
			const prefix = selected ? this.theme.selectedPrefix(prefixText) : padding(visibleWidth(prefixText));
			const keybinding = entry.keybinding ? this.theme.muted(singleLine(entry.keybinding)) : "";
			const availableLabelWidth = Math.max(
				1,
				width - visibleWidth(prefix) - visibleWidth(keybinding) - (keybinding ? 1 : 0),
			);
			const label = truncateToWidth(singleLine(entry.label), availableLabelWidth);
			const labelPadding = padding(Math.max(0, availableLabelWidth - visibleWidth(label)));
			const renderedLabel = selected ? this.theme.selectedText(label) : label;
			lines.push(`${prefix}${renderedLabel}${labelPadding}${keybinding ? ` ${keybinding}` : ""}`);
			lines.push(this.theme.description(truncateToWidth(`  ${singleLine(entry.description)}`, width)));
		}

		if (start > 0 || end < this.#filteredEntries.length) {
			lines.push(this.theme.muted(`  (${this.#selectedIndex + 1}/${this.#filteredEntries.length})`));
		}
		lines.push("", this.theme.muted("  Enter to run · Esc to close"), border);
		return lines;
	}

	handleInput(data: string): void {
		const keybindings = getKeybindings();
		if (keybindings.matches(data, "tui.select.cancel")) {
			this.options.onCancel();
			return;
		}
		if (keybindings.matches(data, "tui.select.up")) {
			this.#selectedIndex = Math.max(0, this.#selectedIndex - 1);
			this.options.onChange?.();
			return;
		}
		if (keybindings.matches(data, "tui.select.down")) {
			this.#selectedIndex = Math.min(this.#filteredEntries.length - 1, this.#selectedIndex + 1);
			this.options.onChange?.();
			return;
		}
		if (keybindings.matches(data, "tui.select.confirm") || data === "\n") {
			const entry = this.#filteredEntries[this.#selectedIndex];
			if (entry) this.options.onSelect(entry);
			return;
		}

		this.#input.handleInput(data);
		this.#filteredEntries = fuzzyFilter([...this.#entries], this.#input.getValue(), entry =>
			[entry.label, entry.description, entry.keybinding ?? "", entry.searchText ?? ""].join(" "),
		);
		this.#selectedIndex = 0;
		this.options.onChange?.();
	}
}
