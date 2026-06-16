import { type Component, Container, matchesKey } from "@jawcode-dev/tui";
import { theme } from "../theme/theme";

export type FullTranscriptSource =
	| { kind: "components"; items: Component[] }
	| { kind: "session"; historicalItems: Component[]; liveItems: Component[]; itemCount: number };

type FullTranscriptRenderable = {
	renderFullTranscript(width: number): string[];
};

function hasFullTranscriptRenderer(component: unknown): component is FullTranscriptRenderable {
	return (
		typeof component === "object" &&
		component !== null &&
		"renderFullTranscript" in component &&
		typeof (component as { renderFullTranscript?: unknown }).renderFullTranscript === "function"
	);
}

export class FullTranscriptOverlayComponent extends Container {
	#source: FullTranscriptSource;
	#close: () => void;
	#requestRender: () => void;
	#scroll = 0;
	#scrollInitialized = false;
	#pinnedToBottom = true;
	#cache?: { width: number; lines: string[] };
	#viewportRowsOverride?: number;

	constructor(source: FullTranscriptSource, callbacks: { close: () => void; requestRender: () => void }) {
		super();
		this.#source = source;
		this.#close = callbacks.close;
		this.#requestRender = callbacks.requestRender;
	}

	getFocus(): FullTranscriptOverlayComponent {
		return this;
	}

	#viewportRows(): number {
		return this.#viewportRowsOverride ?? Math.max(1, (process.stdout.rows || Number(process.env.LINES) || 30) - 2);
	}

	setOverlayViewportRows(rows: number): void {
		const nextRows = Math.max(1, Math.floor(rows) - 2);
		if (this.#viewportRowsOverride === nextRows) return;
		this.#viewportRowsOverride = nextRows;
	}

	#renderComponent(component: Component, width: number): string[] {
		if (hasFullTranscriptRenderer(component)) {
			return component.renderFullTranscript(width);
		}
		return component.render(width);
	}

	#renderItems(items: Component[], width: number): string[] {
		const lines: string[] = [];
		for (const item of items) {
			lines.push(...this.#renderComponent(item, width));
		}
		return lines;
	}

	#transcriptLines(width: number): string[] {
		const lines: string[] = [];
		if (this.#source.kind === "components") {
			lines.push(...this.#renderItems(this.#source.items, width));
		} else {
			lines.push(...this.#renderItems(this.#source.historicalItems, width));
			lines.push(...this.#renderItems(this.#source.liveItems, width));
		}
		while (lines.length > 0 && lines[0] === "") lines.shift();
		this.#cache = { width, lines };
		return lines;
	}

	#moveScroll(next: number, maxScroll: number): void {
		this.#scroll = Math.max(0, Math.min(maxScroll, next));
		this.#pinnedToBottom = this.#scroll >= maxScroll;
	}

	handleInput(data: string): void {
		const rows = this.#viewportRows();
		const total = this.#cache?.lines.length ?? 0;
		const maxScroll = Math.max(0, total - rows);
		if (matchesKey(data, "escape") || matchesKey(data, "ctrl+t") || data === "q") {
			this.#close();
			return;
		}
		if (matchesKey(data, "up")) this.#moveScroll(this.#scroll - 1, maxScroll);
		else if (matchesKey(data, "down")) this.#moveScroll(this.#scroll + 1, maxScroll);
		else if (matchesKey(data, "pageUp")) this.#moveScroll(this.#scroll - rows, maxScroll);
		else if (matchesKey(data, "pageDown")) this.#moveScroll(this.#scroll + rows, maxScroll);
		else if (data === "g") {
			this.#scroll = 0;
			this.#pinnedToBottom = maxScroll === 0;
		} else if (data === "G") this.#moveScroll(maxScroll, maxScroll);
		else return;
		this.#requestRender();
	}

	override render(width: number): string[] {
		const lines = this.#transcriptLines(width);
		const rows = this.#viewportRows();
		const maxScroll = Math.max(0, lines.length - rows);
		if (!this.#scrollInitialized) {
			this.#scroll = maxScroll;
			this.#scrollInitialized = true;
			this.#pinnedToBottom = true;
		} else if (this.#pinnedToBottom) {
			this.#scroll = maxScroll;
		} else {
			this.#scroll = Math.min(this.#scroll, maxScroll);
		}
		const position =
			lines.length === 0
				? "empty"
				: `${this.#scroll + 1}–${Math.min(this.#scroll + rows, lines.length)}/${lines.length}`;
		const itemCount = this.#source.kind === "components" ? this.#source.items.length : this.#source.itemCount;
		const visibleLines = lines.slice(this.#scroll, this.#scroll + rows);
		while (visibleLines.length < rows) {
			visibleLines.push(" ".repeat(Math.max(1, width)));
		}
		return [
			theme.fg("accent", ` Full transcript (${itemCount} entries, ${position})`),
			...visibleLines,
			theme.fg("dim", " ↑↓ scroll · pgup/pgdn page · g/G top/bottom · ctrl+t/q/esc close"),
		];
	}
}
