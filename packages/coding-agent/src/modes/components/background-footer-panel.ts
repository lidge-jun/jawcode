import { type Component, replaceTabs, truncateToWidth } from "@jawcode-dev/tui";
import { theme } from "../theme/theme";
import type { BackgroundFooterModel, BackgroundFooterRow } from "./background-footer-panel-model";

export interface BackgroundFooterPanelCallbacks {
	openDetail(rowId: string): void;
	requestRender(): void;
}

const MAX_VISIBLE_ROWS = 3;

function sanitize(text: string): string {
	return replaceTabs(text)
		.replace(/[\r\n]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export class BackgroundFooterPanel implements Component {
	#expanded = false;
	#model: BackgroundFooterModel = { compactText: undefined, rows: [], attention: false, totalVisible: 0 };
	#selectedIndex = 0;

	constructor(private readonly callbacks: BackgroundFooterPanelCallbacks) {}

	setExpanded(expanded: boolean): void {
		if (this.#expanded === expanded) return;
		this.#expanded = expanded;
		this.callbacks.requestRender();
	}

	isExpanded(): boolean {
		return this.#expanded;
	}

	setModel(model: BackgroundFooterModel): void {
		this.#model = model;
		if (this.#selectedIndex >= model.rows.length) this.#selectedIndex = Math.max(0, model.rows.length - 1);
		if (model.rows.length === 0 && this.#expanded) this.#expanded = false;
	}

	moveSelection(delta: -1 | 1): void {
		if (!this.#expanded || this.#model.rows.length === 0) return;
		this.#selectedIndex = Math.max(0, Math.min(this.#selectedIndex + delta, this.#model.rows.length - 1));
		this.callbacks.requestRender();
	}

	openSelected(): void {
		if (!this.#expanded) return;
		const row = this.#model.rows[this.#selectedIndex];
		if (!row) return;
		this.callbacks.openDetail(row.id);
	}

	collapse(): void {
		this.setExpanded(false);
	}

	invalidate(): void {
		// Stateless render cache boundary; parent TUI drives repaint via requestRender.
	}

	render(width: number): string[] {
		if (!this.#expanded || this.#model.rows.length === 0) return [];
		const start = Math.max(
			0,
			Math.min(this.#selectedIndex - Math.floor(MAX_VISIBLE_ROWS / 2), this.#model.rows.length - MAX_VISIBLE_ROWS),
		);
		const end = Math.min(start + MAX_VISIBLE_ROWS, this.#model.rows.length);
		const lines: string[] = [];
		for (let index = start; index < end; index++) {
			const row = this.#model.rows[index];
			if (!row) continue;
			lines.push(this.#renderRow(row, index === this.#selectedIndex, width));
		}
		return lines;
	}

	#renderRow(row: BackgroundFooterRow, selected: boolean, width: number): string {
		const prefix = selected ? "●" : "○";
		const label = sanitize(row.label);
		const hint = row.hint ? ` · ${sanitize(row.hint)}` : "";
		const text = `${prefix} ${row.kind.padEnd(4)} ${label}${hint}`;
		const colored = selected
			? theme.bold(theme.fg(row.attention ? "warning" : "accent", text))
			: theme.fg(row.attention ? "warning" : "dim", text);
		return truncateToWidth(colored, width);
	}
}
