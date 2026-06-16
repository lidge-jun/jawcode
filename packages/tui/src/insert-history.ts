/**
 * Scrollback history commit primitive (devlog 083.9 P1, Codex insert_history
 * parity — verified against codex-rs source, see 083.9 §0b).
 *
 * Writes finalized lines ONCE into the real terminal scrollback above an
 * inline live zone, leaving the live zone pixels untouched. The committed
 * lines are immutable afterwards — this is the renderer-side counterpart of
 * commit-time folding (99.20.04) and assistant segment split (083.3).
 *
 * Mechanics (the part everyone gets wrong): lines only enter scrollback when
 * the scroll region's TOP is row 1 (`CSI 1;N r`) on the primary screen — a
 * region with top > 1 silently DISCARDS lines pushed out of it. The commit
 * therefore positions the cursor at the BOTTOM of a `1..liveZoneTop` region
 * and emits `\r\n` per line: the region scrolls up, its top line exits into
 * scrollback, and the new line is written on the freed bottom row. Reverse
 * Index (`\x1bM`) is NOT the commit mechanism — it is only used to push the
 * live zone itself downward when it is not flush with the screen bottom.
 */

/** How history lines are committed for the active terminal. */
export type HistoryLaneMode = "standard" | "zellij-raw" | "unsupported";

/**
 * Env-based lane detection (Codex parity: no terminal probe — codex-rs
 * terminal-detection is pure env inspection). Zellij does not constrain
 * soft-wrapped rows to the scroll region, so it gets a raw-append mode;
 * dumb terminals get none. tmux works through the standard path — lines land
 * in tmux's own pane history, which is the intended behavior.
 */
export function detectHistoryLaneMode(env: Record<string, string | undefined> = process.env): HistoryLaneMode {
	if (env.TERM === "dumb") return "unsupported";
	if (env.ZELLIJ || env.ZELLIJ_SESSION_NAME || env.ZELLIJ_VERSION) return "zellij-raw";
	return "standard";
}

export interface InsertHistoryGeometry {
	/** 0-based screen row where the live zone begins. Rows above it are the history region. */
	liveZoneTop: number;
	/** 0-based screen row where the live zone ends (exclusive); usually screen height. */
	liveZoneBottom: number;
	/** Total terminal rows. */
	screenRows: number;
	/** 0-based cursor position the live zone expects; restored after the commit. */
	cursor: { row: number; col: number };
}

/**
 * Build the escape sequence that commits `lines` into scrollback above the
 * live zone. Lines must already be pre-wrapped to the terminal width (083.9
 * §0b-6 — committed pixels never reflow). Returns "" when there is no room
 * for a history region and the live zone cannot be pushed down.
 *
 * The caller wraps the write in synchronized output (`CSI ?2026 h/l`) as part
 * of its frame, mirroring Codex where insert_history flushes inside draw().
 */
export function buildInsertHistorySequence(lines: readonly string[], geometry: InsertHistoryGeometry): string {
	if (lines.length === 0) return "";
	let { liveZoneTop } = geometry;
	const { liveZoneBottom, screenRows, cursor } = geometry;
	let out = "";

	// Phase 1 (only when the live zone is not flush with the screen bottom):
	// push the live zone down with Reverse Index in a region spanning from the
	// live zone to the bottom, opening more history rows above it.
	if (liveZoneBottom < screenRows) {
		const scrollAmount = Math.min(lines.length, screenRows - liveZoneBottom);
		out += `\x1b[${liveZoneTop + 1};${screenRows}r`; // region: live zone .. bottom (1-based)
		out += `\x1b[${liveZoneTop + 1};1H`; // cursor to region top
		out += "\x1bM".repeat(scrollAmount); // RI: scroll region down, live zone moves down
		out += "\x1b[r";
		liveZoneTop += scrollAmount;
	}

	if (liveZoneTop < 1) {
		// No history region exists (live zone starts at row 0) — nothing can
		// enter scrollback without disturbing the live zone.
		return "";
	}

	// Phase 2: scroll the `1..liveZoneTop` region upward from its bottom row.
	// Region top is row 1, so lines exiting the top enter the scrollback.
	out += `\x1b[1;${liveZoneTop}r`; // 1-based: rows 1 .. liveZoneTop
	out += `\x1b[${liveZoneTop};1H`; // cursor to region bottom row
	for (const line of lines) {
		out += "\r\n"; // scroll region up: top row exits to scrollback
		out += "\x1b[2K"; // the freed bottom row may carry stale pixels
		out += line;
	}
	out += "\x1b[r"; // reset region FIRST (DECSTBM homes the cursor) …
	out += `\x1b[${cursor.row + 1};${cursor.col + 1}H`; // … then restore the live-zone cursor
	return out;
}
