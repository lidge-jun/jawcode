import {
	type Component,
	Container,
	getKeybindings,
	Input,
	matchesKey,
	Spacer,
	TabBar,
	Text,
	truncateToWidth,
	visibleWidth,
} from "@jawcode-dev/tui";
import { getTabBarTheme } from "../shared";
import { theme } from "../theme/theme";
import { DynamicBorder } from "./dynamic-border";

/** Where a slash command came from — drives the /help tab split (99.20.08 나). */
export type HelpCommandOrigin = "builtin" | "skill" | "custom";

export interface HelpCatalogEntry {
	name: string;
	description?: string;
	origin: HelpCommandOrigin;
	/** Alternate invocations (builtin `aliases`), shown in the detail pane. */
	aliases?: string[];
	/** Inline argument hint (builtin `inlineHint`), shown as usage. */
	inlineHint?: string;
	/** Declarative subcommands (builtin `subcommands`), listed in the detail pane. */
	subcommands?: ReadonlyArray<{ name: string; description: string; usage?: string }>;
	/** Provenance label for non-builtin commands (skill source, file path …). */
	sourceLabel?: string;
}

const TAB_DEFS: ReadonlyArray<{ id: HelpCommandOrigin; label: string; empty: string }> = [
	{ id: "builtin", label: "Built-in", empty: "No built-in commands found" },
	{ id: "skill", label: "Skills", empty: "No skill commands found" },
	{ id: "custom", label: "Custom", empty: "No custom commands found" }, // CC-동형 빈 메시지
];

const MAX_VISIBLE = 12;
const MAX_DETAIL_LINES = 14;
const ORIGIN_LABELS: Record<HelpCommandOrigin, string> = {
	builtin: "built-in",
	skill: "skill",
	custom: "custom",
};

/** Greedy word wrap for plain (ANSI-free) text. */
function wrapPlain(text: string, width: number): string[] {
	if (width <= 4) return [truncateToWidth(text, width)];
	const words = text.split(/\s+/).filter(Boolean);
	const lines: string[] = [];
	let line = "";
	for (const word of words) {
		if (line === "") {
			line = word;
		} else if (visibleWidth(line) + 1 + visibleWidth(word) <= width) {
			line += ` ${word}`;
		} else {
			lines.push(line);
			line = word;
		}
	}
	if (line) lines.push(line);
	return lines;
}

/** Stateless child that pulls its lines from the host at render time. */
class PaneComponent implements Component {
	constructor(private readonly renderPane: (width: number) => string[]) {}
	invalidate(): void {}
	render(width: number): string[] {
		return this.renderPane(width);
	}
}

/**
 * Docked /help command catalog (devlog 99.20.08 §5.3 (나) — 확정 260613,
 * 2-pane 확장 260613). Model-selector grammar: tab bar (Built-in / Skills /
 * Custom) + incremental search + ↑↓ master list; the right pane shows the
 * selected command's detail (description, usage, subcommands, aliases) and
 * follows the cursor. Enter inserts the command into the editor. Mounted in
 * place of the editor via SelectorController.showSelector, so the transcript
 * stays clean (99.20.07 read-once principle).
 */
export class HelpSelectorComponent extends Container {
	#entries: HelpCatalogEntry[];
	#tabBar: TabBar;
	#searchInput: Input;
	#filtered: HelpCatalogEntry[] = [];
	#selectedIndex = 0;
	#onSelect: (commandName: string) => void;
	#onCancel: () => void;

	constructor(entries: HelpCatalogEntry[], onSelect: (commandName: string) => void, onCancel: () => void) {
		super();
		this.#entries = entries;
		this.#onSelect = onSelect;
		this.#onCancel = onCancel;

		this.addChild(new DynamicBorder());
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.bold(theme.fg("accent", "Help")), 1, 0));
		this.addChild(
			new Text(theme.fg("dim", "enter send · !cmd bash mode · ? shortcuts · /hotkeys keyboard reference"), 1, 0),
		);
		this.addChild(new Spacer(1));

		const tabs = TAB_DEFS.map(def => ({
			id: def.id,
			label: `${def.label} (${entries.filter(entry => entry.origin === def.id).length})`,
		}));
		this.#tabBar = new TabBar("Commands", tabs, getTabBarTheme());
		this.#tabBar.onTabChange = () => {
			this.#selectedIndex = 0;
			this.#refresh();
		};
		this.addChild(this.#tabBar);
		this.addChild(new Spacer(1));

		this.#searchInput = new Input();
		this.addChild(this.#searchInput);
		this.addChild(new Spacer(1));

		this.addChild(new PaneComponent(width => this.#renderPane(width)));

		this.addChild(new Spacer(1));
		this.addChild(
			new Text(theme.fg("dim", "↑↓ navigate · enter insert · tab/←→ section · type to search · esc close"), 1, 0),
		);
		this.addChild(new DynamicBorder());

		this.#refresh();
	}

	#activeOrigin(): HelpCommandOrigin {
		return this.#tabBar.getActiveTab().id as HelpCommandOrigin;
	}

	#refresh(): void {
		const query = this.#searchInput.getValue().trim().toLowerCase();
		const origin = this.#activeOrigin();
		this.#filtered = this.#entries
			.filter(entry => entry.origin === origin)
			.filter(
				entry =>
					query === "" ||
					entry.name.toLowerCase().includes(query) ||
					(entry.description ?? "").toLowerCase().includes(query),
			)
			.sort((a, b) => a.name.localeCompare(b.name));
		this.#selectedIndex = Math.min(this.#selectedIndex, Math.max(0, this.#filtered.length - 1));
	}

	/** Two-pane body: windowed master list on the left, live detail on the right. */
	#renderPane(width: number): string[] {
		if (this.#filtered.length === 0) {
			const def = TAB_DEFS.find(tab => tab.id === this.#activeOrigin());
			const message = this.#searchInput.getValue().trim() ? "No matches" : (def?.empty ?? "No commands found");
			return [` ${theme.fg("dim", message)}`];
		}

		// Left column sized to the longest visible name, clamped.
		const start = Math.max(0, Math.min(this.#selectedIndex - (MAX_VISIBLE - 1), this.#filtered.length - MAX_VISIBLE));
		const visible = this.#filtered.slice(start, start + MAX_VISIBLE);
		const leftWidth = Math.min(
			26,
			Math.max(12, visible.reduce((max, entry) => Math.max(max, entry.name.length + 1), 0) + 4),
		);
		const detailWidth = Math.max(10, width - leftWidth - 5);

		const left: string[] = visible.map((entry, i) => {
			const selected = start + i === this.#selectedIndex;
			const cursor = selected ? theme.fg("accent", "❯ ") : "  ";
			const name = truncateToWidth(`/${entry.name}`, leftWidth - 3);
			const label = selected ? theme.bold(theme.fg("accent", name)) : theme.fg("accent", name);
			return ` ${cursor}${label}`;
		});
		if (this.#filtered.length > MAX_VISIBLE) {
			left.push(` ${theme.fg("dim", truncateToWidth(`… ${this.#filtered.length - MAX_VISIBLE} more`, leftWidth))}`);
		}

		const right = this.#renderDetail(this.#filtered[this.#selectedIndex], detailWidth);

		const rows = Math.max(left.length, right.length);
		const sep = theme.fg("dim", "│");
		const lines: string[] = [];
		for (let i = 0; i < rows; i++) {
			const leftCell = left[i] ?? "";
			const pad = " ".repeat(Math.max(0, leftWidth - visibleWidth(leftCell)));
			lines.push(truncateToWidth(`${leftCell}${pad} ${sep} ${right[i] ?? ""}`, width));
		}
		return lines;
	}

	/** Detail block for the selected command (description, usage, subcommands, aliases). */
	#renderDetail(entry: HelpCatalogEntry | undefined, width: number): string[] {
		if (!entry) return [];
		const lines: string[] = [];
		lines.push(theme.bold(theme.fg("accent", truncateToWidth(`/${entry.name}`, width))));

		const meta: string[] = [ORIGIN_LABELS[entry.origin]];
		if (entry.aliases?.length) meta.push(`aliases: ${entry.aliases.map(alias => `/${alias}`).join(", ")}`);
		if (entry.sourceLabel) meta.push(entry.sourceLabel);
		lines.push(theme.fg("dim", truncateToWidth(meta.join(" · "), width)));
		lines.push("");

		for (const wrapped of wrapPlain(entry.description ?? "(no description)", width)) {
			lines.push(theme.fg("text", wrapped));
		}

		if (entry.inlineHint) {
			lines.push("");
			lines.push(theme.fg("dim", truncateToWidth(`usage: /${entry.name} ${entry.inlineHint}`, width)));
		}

		if (entry.subcommands?.length) {
			lines.push("");
			lines.push(theme.fg("text", "subcommands"));
			for (const sub of entry.subcommands) {
				const usage = sub.usage ? ` ${sub.usage}` : "";
				lines.push(theme.fg("dim", truncateToWidth(`  ${sub.name}${usage} — ${sub.description}`, width)));
			}
		}

		if (lines.length > MAX_DETAIL_LINES) {
			const clipped = lines.slice(0, MAX_DETAIL_LINES - 1);
			clipped.push(theme.fg("dim", "…"));
			return clipped;
		}
		return lines;
	}

	handleInput(keyData: string): void {
		if (this.#tabBar.handleInput(keyData)) {
			return;
		}
		if (matchesKey(keyData, "up")) {
			if (this.#filtered.length === 0) return;
			this.#selectedIndex = this.#selectedIndex === 0 ? this.#filtered.length - 1 : this.#selectedIndex - 1;
			return;
		}
		if (matchesKey(keyData, "down")) {
			if (this.#filtered.length === 0) return;
			this.#selectedIndex = this.#selectedIndex === this.#filtered.length - 1 ? 0 : this.#selectedIndex + 1;
			return;
		}
		if (matchesKey(keyData, "enter") || matchesKey(keyData, "return") || keyData === "\n") {
			const selected = this.#filtered[this.#selectedIndex];
			if (selected) this.#onSelect(selected.name);
			return;
		}
		if (getKeybindings().matches(keyData, "tui.select.cancel")) {
			this.#onCancel();
			return;
		}
		this.#searchInput.handleInput(keyData);
		this.#selectedIndex = 0;
		this.#refresh();
	}

	/** Test hook: visible filtered entries for the active tab. */
	getFilteredEntriesForTest(): ReadonlyArray<HelpCatalogEntry> {
		return this.#filtered;
	}

	getActiveTabIdForTest(): string {
		return this.#tabBar.getActiveTab().id;
	}

	getSelectedEntryForTest(): HelpCatalogEntry | undefined {
		return this.#filtered[this.#selectedIndex];
	}
}
