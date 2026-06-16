import { type Component, truncateToWidth, visibleWidth } from "@jawcode-dev/tui";
import { sanitizeStatusText } from "../shared";
import { theme } from "../theme/theme";

/** Severity → theme color for the footer text (devlog 99.20.06 §2.4). */
export type ComposerFooterColor = "warning" | "danger" | "dim";

/**
 * Composer footer line (devlog 99.20.06): a persistent one-row line rendered
 * below the input composer, modeled on Claude Code's footer. Content resolves
 * through a priority stack — transient (double-press exit notices, IME hints)
 * over mode (plan/goal — slot reserved, unwired in v1) over the idle hint.
 *
 * The row is ALWAYS exactly one line while enabled, even when empty: the
 * composer-pin invariant (083.7, "composer rows are constant") requires the
 * frame length not to change when a notice appears or expires. Disabled
 * (engine brand / setting off) renders zero lines, keeping the legacy frame
 * byte-identical.
 */
export class ComposerFooter implements Component {
	#enabled = true;
	#transient: { text: string; color: ComposerFooterColor } | null = null;
	#transientTimer: NodeJS.Timeout | undefined;
	#mode: string | undefined;
	#hint: string | undefined;
	#backgroundText: string | undefined;

	/** Notifies the host (ui.requestRender) when content changes asynchronously. */
	constructor(private readonly onChanged?: () => void) {}

	setEnabled(v: boolean): void {
		this.#enabled = v;
	}

	isEnabled(): boolean {
		return this.#enabled;
	}

	/**
	 * Show a transient notice; latest call wins and auto-clears after
	 * `durationMs` (CC's notification line collapsed to a single current —
	 * the full priority queue is explicitly out of v1 scope).
	 */
	setTransient(text: string, opts?: { durationMs?: number; color?: ComposerFooterColor }): void {
		this.clearTransient({ silent: true });
		this.#transient = { text, color: opts?.color ?? "warning" };
		this.#transientTimer = setTimeout(() => {
			this.#transientTimer = undefined;
			this.#transient = null;
			this.onChanged?.();
		}, opts?.durationMs ?? 800);
		this.#transientTimer.unref?.();
		this.onChanged?.();
	}

	clearTransient(opts?: { silent?: boolean }): void {
		if (this.#transientTimer) {
			clearTimeout(this.#transientTimer);
			this.#transientTimer = undefined;
		}
		const had = this.#transient !== null;
		this.#transient = null;
		if (had && !opts?.silent) this.onChanged?.();
	}

	/** Persistent mode indicator (plan/goal/…). Slot only in v1 — no callers yet (F4). */
	setMode(text: string | undefined): void {
		this.#mode = text;
		this.onChanged?.();
	}

	/** Idle fallback hint, set once at startup (F5). */
	setBackgroundText(text: string | undefined): void {
		this.#backgroundText = text;
		this.onChanged?.();
	}

	setHint(text: string | undefined): void {
		this.#hint = text;
	}

	dispose(): void {
		this.clearTransient({ silent: true });
	}

	invalidate(): void {}

	render(width: number): string[] {
		if (!this.#enabled) return [];
		let left = "";
		if (this.#transient) {
			left = theme.fg(
				this.#transient.color === "danger" ? "error" : this.#transient.color,
				sanitizeStatusText(this.#transient.text),
			);
		} else if (this.#mode) {
			left = theme.fg("accent", sanitizeStatusText(this.#mode));
		} else if (this.#hint) {
			left = theme.fg("dim", sanitizeStatusText(this.#hint));
		}
		const right = this.#backgroundText ? theme.fg("accent", sanitizeStatusText(this.#backgroundText)) : "";
		if (!left && !right) return [""];
		if (!right) return [truncateToWidth(` ${left}`, width)];
		if (!left)
			return [truncateToWidth(`${" ".repeat(Math.max(0, width - visibleWidth(right) - 1))}${right} `, width)];
		const leftStr = ` ${left}`;
		const rightStr = `${right} `;
		const leftW = visibleWidth(leftStr);
		const rightW = visibleWidth(rightStr);
		const gap = Math.max(1, width - leftW - rightW);
		return [truncateToWidth(`${leftStr}${" ".repeat(gap)}${rightStr}`, width)];
	}
}
