import { Container, matchesKey } from "@jawcode-dev/tui";
import { theme } from "../theme/theme";

/**
 * Docked usage/quota report panel (083.1 overlay pattern, /quota analogue).
 * Mounted in place of the editor via SelectorController.showSelector so usage
 * reports render like the settings/provider selectors instead of being
 * appended to the chat transcript. Content arrives asynchronously: the panel
 * shows a loading line until `setContent`/`setMessage` is called.
 */
export class QuotaPanelComponent extends Container {
	#title: string;
	#close: () => void;
	#requestRender: () => void;
	#state: "loading" | "ready" | "message" = "loading";
	#message = "";
	#renderContent?: (width: number) => string[];
	#scroll = 0;
	#cache?: { width: number; lines: string[] };

	constructor(title: string, callbacks: { close: () => void; requestRender: () => void }) {
		super();
		this.#title = title;
		this.#close = callbacks.close;
		this.#requestRender = callbacks.requestRender;
	}

	/** Swap the loading state for report content rendered at the current width. */
	setContent(renderContent: (width: number) => string[]): void {
		this.#state = "ready";
		this.#renderContent = renderContent;
		this.#cache = undefined;
		this.#requestRender();
	}

	/** Swap the loading state for a single status/error line. */
	setMessage(message: string): void {
		this.#state = "message";
		this.#message = message;
		this.#requestRender();
	}

	#viewportRows(): number {
		return Math.max(6, (process.stdout.rows ?? 30) - 8);
	}

	#contentLines(width: number): string[] {
		if (!this.#renderContent) return [];
		if (this.#cache?.width === width) return this.#cache.lines;
		const lines = this.#renderContent(width);
		this.#cache = { width, lines };
		return lines;
	}

	handleInput(data: string): void {
		if (matchesKey(data, "escape") || data === "q") {
			this.#close();
			return;
		}
		if (this.#state !== "ready") return;
		const rows = this.#viewportRows();
		const total = this.#cache?.lines.length ?? 0;
		const maxScroll = Math.max(0, total - rows);
		if (matchesKey(data, "up")) this.#scroll = Math.max(0, this.#scroll - 1);
		else if (matchesKey(data, "down")) this.#scroll = Math.min(maxScroll, this.#scroll + 1);
		else if (matchesKey(data, "pageUp")) this.#scroll = Math.max(0, this.#scroll - rows);
		else if (matchesKey(data, "pageDown")) this.#scroll = Math.min(maxScroll, this.#scroll + rows);
		else if (data === "g") this.#scroll = 0;
		else if (data === "G") this.#scroll = maxScroll;
		else return;
		this.#requestRender();
	}

	override render(width: number): string[] {
		const out: string[] = [];
		if (this.#state === "loading") {
			out.push(theme.fg("accent", ` ${this.#title}`));
			out.push(theme.fg("dim", " Fetching usage data…"));
			out.push(theme.fg("dim", " esc close"));
			return out;
		}
		if (this.#state === "message") {
			out.push(theme.fg("accent", ` ${this.#title}`));
			out.push(` ${this.#message}`);
			out.push(theme.fg("dim", " esc close"));
			return out;
		}
		const lines = this.#contentLines(width);
		const rows = this.#viewportRows();
		const maxScroll = Math.max(0, lines.length - rows);
		this.#scroll = Math.min(this.#scroll, maxScroll);
		const scrollHint =
			maxScroll > 0 ? ` (${this.#scroll + 1}–${Math.min(this.#scroll + rows, lines.length)}/${lines.length})` : "";
		out.push(theme.fg("accent", ` ${this.#title}${scrollHint}`));
		out.push(...lines.slice(this.#scroll, this.#scroll + rows));
		out.push(
			theme.fg("dim", maxScroll > 0 ? " ↑↓ scroll · pgup/pgdn page · g/G top/bottom · esc close" : " esc close"),
		);
		return out;
	}
}
