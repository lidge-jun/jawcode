/**
 * Minimal TUI implementation with differential rendering
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { performance } from "node:perf_hooks";
import { $env, $flag, getDebugLogPath, logger } from "@jawcode-dev/utils";
import { VIEWPORT_FILL_SENTINEL } from "./components/viewport-fill";
import { buildInsertHistorySequence, detectHistoryLaneMode, type HistoryLaneMode } from "./insert-history";
import { isKeyRelease, matchesKey } from "./keys";
import { flushPerfEventsSync, isPerfJsonlFlushEnabled, renderMetrics } from "./metrics";
import type { Terminal } from "./terminal";
import { ImageProtocol, setCellDimensions, setTerminalImageProtocol, TERMINAL } from "./terminal-capabilities";
import {
	Ellipsis,
	extractSegments,
	getAmbiguousWidthMode,
	normalizeTerminalOutput,
	setAmbiguousWidthMode,
	sliceByColumn,
	sliceWithWidth,
	truncateToWidth,
	visibleWidth,
} from "./utils";

const SEGMENT_RESET = "\x1b[0m";
/**
 * Per-line terminator written at the end of every non-image line. Closes both
 * SGR state and any in-flight OSC 8 hyperlink so styles/links cannot bleed
 * across lines in scrollback. Applied by the prepared-line path before
 * diffing so `#previousLines` mirrors what was actually written.
 */
const LINE_TERMINATOR = "\x1b[0m\x1b]8;;\x07";
const PREPARED_LINE_CACHE_LIMIT = 4096;
const PREPARED_LINE_CACHE_EVICT_COUNT = Math.max(1, Math.floor(PREPARED_LINE_CACHE_LIMIT / 4));

interface PreparedLineStats {
	normalizeHit: number;
	normalizeMiss: number;
	truncateHit: number;
	truncateMiss: number;
}
type InputListenerResult = { consume?: boolean; data?: string } | undefined;
type InputListener = (data: string) => InputListenerResult;

/**
 * Component interface - all components must implement this
 */
export interface Component {
	/**
	 * Render the component to lines for the given viewport width
	 * @param width - Current viewport width
	 * @returns Array of strings, each representing a line
	 */
	render(width: number): string[];
	/**
	 * Optional overlay lifecycle hint. TUI calls this before rendering an overlay
	 * with the resolved visible row budget so viewport-like overlays do not have
	 * to guess from process.stdout.rows.
	 */
	setOverlayViewportRows?(rows: number): void;
	/**
	 * Optional handler for keyboard input when component has focus
	 */
	handleInput?(data: string): void;

	/**
	 * If true, component receives key release events (Kitty protocol).
	 * Default is false - release events are filtered out.
	 */
	wantsKeyRelease?: boolean;

	/**
	 * Invalidate any cached rendering state.
	 * Called when theme changes or when component needs to re-render from scratch.
	 */
	invalidate(): void;

	/**
	 * 083.9 P4: set once the component's pixels were committed to the terminal
	 * scrollback (commit lane). Frame assembly skips committed components — they
	 * remain in their container for data consumers (transcript overlay, sweeps).
	 */
	committed?: boolean;
}

/**
 * Interface for components that can receive focus and display a hardware cursor.
 * When focused, the component should emit CURSOR_MARKER at the cursor position
 * in its render output. TUI will find this marker and position the hardware
 * cursor there for proper IME candidate window positioning.
 */
export interface Focusable {
	/** Set by TUI when focus changes. Component should emit CURSOR_MARKER when true. */
	focused: boolean;
}

/** Type guard to check if a component implements Focusable */
export function isFocusable(component: Component | null): component is Component & Focusable {
	return component !== null && "focused" in component;
}

/**
 * Cursor position marker - APC (Application Program Command) sequence.
 * This is a zero-width escape sequence that terminals ignore.
 * Components emit this at the cursor position when focused.
 * TUI finds and strips this marker, then positions the hardware cursor there.
 */
export const CURSOR_MARKER = "\x1b_pi:c\x07";

export { visibleWidth };

/**
 * Anchor position for overlays
 */
export type OverlayAnchor =
	| "center"
	| "top-left"
	| "top-right"
	| "bottom-left"
	| "bottom-right"
	| "top-center"
	| "bottom-center"
	| "left-center"
	| "right-center";

/**
 * Margin configuration for overlays
 */
export interface OverlayMargin {
	top?: number;
	right?: number;
	bottom?: number;
	left?: number;
}

/** Value that can be absolute (number) or percentage (string like "50%") */
export type SizeValue = number | `${number}%`;

/** Parse a SizeValue into absolute value given a reference size */
function parseSizeValue(value: SizeValue | undefined, referenceSize: number): number | undefined {
	if (value === undefined) return undefined;
	if (typeof value === "number") return value;
	// Parse percentage string like "50%"
	const match = value.match(/^(\d+(?:\.\d+)?)%$/);
	if (match) {
		return Math.floor((referenceSize * parseFloat(match[1])) / 100);
	}
	return undefined;
}

function isTermuxSession(): boolean {
	return Boolean(process.env.TERMUX_VERSION);
}

/** Detect terminal multiplexers where scrollback clearing and height-change redraws are hostile. */
function isMultiplexerSession(): boolean {
	return Boolean(process.env.TMUX || process.env.STY || process.env.ZELLIJ);
}

function useLegacyMultiplexerFullRender(): boolean {
	return $flag("PI_TUI_LEGACY_MULTIPLEXER_FULL_RENDER");
}

/**
 * Options for overlay positioning and sizing.
 * Values can be absolute numbers or percentage strings (e.g., "50%").
 */
export interface OverlayOptions {
	// === Sizing ===
	/** Width in columns, or percentage of terminal width (e.g., "50%") */
	width?: SizeValue;
	/** Minimum width in columns */
	minWidth?: number;
	/** Maximum height in rows, or percentage of terminal height (e.g., "50%") */
	maxHeight?: SizeValue;

	// === Positioning - anchor-based ===
	/** Anchor point for positioning (default: 'center') */
	anchor?: OverlayAnchor;
	/** Horizontal offset from anchor position (positive = right) */
	offsetX?: number;
	/** Vertical offset from anchor position (positive = down) */
	offsetY?: number;

	// === Positioning - percentage or absolute ===
	/** Row position: absolute number, or percentage (e.g., "25%" = 25% from top) */
	row?: SizeValue;
	/** Column position: absolute number, or percentage (e.g., "50%" = centered horizontally) */
	col?: SizeValue;

	// === Margin from terminal edges ===
	/** Margin from terminal edges. Number applies to all sides. */
	margin?: OverlayMargin | number;

	// === Visibility ===
	/**
	 * Control overlay visibility based on terminal dimensions.
	 * If provided, overlay is only rendered when this returns true.
	 * Called each render cycle with current terminal dimensions.
	 */
	visible?: (termWidth: number, termHeight: number) => boolean;
}

/**
 * Handle returned by showOverlay for controlling the overlay
 */
export interface OverlayHandle {
	/** Permanently remove the overlay (cannot be shown again) */
	hide(): void;
	/** Temporarily hide or show the overlay */
	setHidden(hidden: boolean): void;
	/** Check if overlay is temporarily hidden */
	isHidden(): boolean;
}

/**
 * Container - a component that contains other components
 */
export class Container implements Component {
	children: Component[] = [];

	addChild(component: Component): void {
		this.children.push(component);
	}

	removeChild(component: Component): void {
		const index = this.children.indexOf(component);
		if (index !== -1) {
			this.children.splice(index, 1);
		}
	}

	clear(): void {
		this.children = [];
	}

	invalidate(): void {
		for (const child of this.children) {
			child.invalidate?.();
		}
	}

	render(width: number): string[] {
		width = Math.max(1, width);
		const lines: string[] = [];
		for (const child of this.children) {
			// Commit lane (083.9 P4): committed pixels live in the scrollback —
			// the frame must not carry a second copy.
			if (child.committed) continue;
			lines.push(...safeRenderComponent(child, width, "container-child"));
		}
		return lines;
	}
}

const MAX_REPORTED_RENDER_ERRORS = 200;
const reportedRenderErrors = new Set<string>();

function safeRenderComponent(component: Component, width: number, where: string): string[] {
	try {
		return component.render(width);
	} catch (error) {
		const name = component.constructor?.name || "Component";
		const message = error instanceof Error ? error.message : String(error);
		const key = `${where}:${name}:${message}`;
		if (!reportedRenderErrors.has(key)) {
			if (reportedRenderErrors.size >= MAX_REPORTED_RENDER_ERRORS) reportedRenderErrors.clear();
			reportedRenderErrors.add(key);
			logger.error("Component render failed; emitting fallback line", {
				where,
				component: name,
				error: message,
				stack: error instanceof Error ? error.stack : undefined,
			});
		}
		return [`[render error: ${name}]`];
	}
}

/**
 * TUI - Main class for managing terminal UI with differential rendering
 */
export class TUI extends Container {
	terminal: Terminal;
	#previousLines: string[] = [];
	#previousWidth = 0;
	#previousHeight = 0;
	#focusedComponent: Component | null = null;
	#inputListeners = new Set<InputListener>();

	/** Global callback for debug key (Shift+Ctrl+D). Called before input is forwarded to focused component. */
	onDebug?: () => void;
	#renderRequested = false;
	// ── History commit lane (devlog 083.9 P2) ──────────────────────────
	/** How committed lines reach the scrollback for this terminal. */
	#historyLane: HistoryLaneMode = "unsupported";
	/** Committed pixel rows sitting directly above the live zone, not yet scrolled into scrollback. */
	#committedScreenRows = 0;
	/**
	 * 260703 v3 — 1-based screen row where the on-screen committed block ENDS.
	 * 0 = no parked block: callers fall back to the fill-region bottom
	 * (#lastFillRows / prevFillRows), which is byte-identical to the pre-v3
	 * behavior. Set by realignOverflowedFrame, which parks the previous turn's
	 * visible tail at rows 1..blockRows while the NEXT frame's fill can be
	 * taller — the block bottom, not the raw fill, is the history-region
	 * boundary, or growth scroll-outs stamp the trailing-blank gap into the
	 * scrollback (gap repro, 20_realign_v3_committed_bottom.md).
	 */
	#committedBottomRow = 0;
	/** True once any line was committed — the scrollback is then canonical and 3J is forbidden. */
	#hasCommittedHistory = false;
	/**
	 * 260703 WP5 — sticky: true once an overflowing frame was PHYSICALLY
	 * printed/scrolled (above-viewport rows exist as real terminal history).
	 * Multiplexer clearing replays downgrade to a viewport repaint only after
	 * this point — downgrading a first-ever overflow render instead LOSES the
	 * rows for good (no 3J-less path ever materializes them; mux golden repro).
	 * Never reset: #restoreOverflowFloor zeroes the floor on every no-sentinel
	 * render, so the floor cannot serve as this memory for legacy frames.
	 */
	#hasMaterializedOverflow = false;
	/** Fill rows at the top of the frame as last painted (= history region height). */
	#lastFillRows = 0;
	#renderTimer: NodeJS.Timeout | undefined;
	#lastRenderAt = 0;
	static readonly #MIN_RENDER_INTERVAL_MS = 16;
	/**
	 * 260703 WP1 — one-shot request for an absolute viewport repaint, consumed
	 * by the next #doRender pass. Set via resyncViewport(); any absolute render
	 * branch (first render, width/height change, quarantine) satisfies it too.
	 */
	#resyncRequested = false;
	// Input-priority scheduling: an input keystroke must never be starved behind a
	// pending normal (frame-budget) render timer. When set, an input-priority render
	// is queued for the next tick and supersedes any pending normal timer.
	#inputRenderPending = false;
	#preparedNormalizeCache = new Map<string, string>();
	#preparedTruncateCache = new Map<string, string>();

	#cursorRow = 0; // Logical cursor row (end of rendered content)
	#hardwareCursorRow = 0; // Actual terminal cursor row (may differ due to IME positioning)
	#viewportTopRow = 0; // Content row currently mapped to screen row 0
	#sixelProbePendingDa = false;
	#sixelProbePendingGraphics = false;
	#sixelProbeBuffer = "";
	#sixelProbeTimeout?: NodeJS.Timeout;
	#sixelProbeUnsubscribe?: () => void;
	// ── Ambiguous-width probe (260703 WP2.5) ───────────────────────────
	#ambiguousProbePending = false;
	#ambiguousProbeBuffer = "";
	#ambiguousProbeTimeout?: NodeJS.Timeout;
	#ambiguousProbeUnsubscribe?: () => void;
	/** Post-timeout grace: swallow one late CPR reply, never apply it. */
	#ambiguousProbeGrace = false;
	/**
	 * False only while a CPR probe is outstanding. commitLines() refuses
	 * while unresolved: a mismeasured PAINT is row-safe (DECAWM off) and
	 * repainted after the probe, but a mismeasured COMMIT would bake wrongly
	 * truncated pixels into canonical scrollback forever.
	 */
	#ambiguousWidthResolved = true;
	/**
	 * 260703 WP3b-min — true while a high-churn output phase is in progress
	 * (the embedding app streams a response). While streaming and the user
	 * may be scrolled off-bottom, DECSTBM history insertions fight native
	 * scrolling (the top-pinned-block symptom) — new commits then defer to
	 * the virtual lane. Agent-agnostic on purpose: the TUI stays
	 * message-agnostic.
	 */
	#streamingActive = false;
	#showHardwareCursor = $flag("PI_HARDWARE_CURSOR");
	#clearOnShrink = $flag("PI_CLEAR_ON_SHRINK"); // Clear empty rows when content shrinks (default: off)
	#maxLinesRendered = 0; // Line count from last render, used for viewport calculation
	#fullRedrawCount = 0;
	#stopped = false;
	#terminalUnavailable = false;

	// Overlay stack for modal components rendered on top of base content
	overlayStack: {
		component: Component;
		options?: OverlayOptions;
		preFocus: Component | null;
		hidden: boolean;
	}[] = [];

	constructor(terminal: Terminal, showHardwareCursor?: boolean) {
		super();
		this.terminal = terminal;
		if (showHardwareCursor !== undefined) {
			this.#showHardwareCursor = showHardwareCursor;
		}
	}

	get fullRedraws(): number {
		return this.#fullRedrawCount;
	}

	getShowHardwareCursor(): boolean {
		return this.#showHardwareCursor;
	}

	setShowHardwareCursor(enabled: boolean): void {
		if (this.#showHardwareCursor === enabled) return;
		this.#showHardwareCursor = enabled;
		if (!enabled) {
			this.#hideCursor();
		}
		this.requestRender();
	}

	getClearOnShrink(): boolean {
		return this.#clearOnShrink;
	}

	/**
	 * Set whether to trigger full re-render when content shrinks.
	 * When true (default), empty rows are cleared when content shrinks.
	 * When false, empty rows remain (reduces redraws on slower terminals).
	 */
	setClearOnShrink(enabled: boolean): void {
		this.#clearOnShrink = enabled;
	}

	setFocus(component: Component | null): void {
		// Clear focused flag on old component
		if (isFocusable(this.#focusedComponent)) {
			this.#focusedComponent.focused = false;
		}

		this.#focusedComponent = component;

		// Set focused flag on new component
		if (isFocusable(component)) {
			component.focused = true;
		}
	}

	/**
	 * Show an overlay component with configurable positioning and sizing.
	 * Returns a handle to control the overlay's visibility.
	 */
	showOverlay(component: Component, options?: OverlayOptions): OverlayHandle {
		const entry = { component, options, preFocus: this.#focusedComponent, hidden: false };
		this.overlayStack.push(entry);
		// Only focus if overlay is actually visible
		if (this.#isOverlayVisible(entry)) {
			this.setFocus(component);
		}
		this.#hideCursor();
		this.requestRender();

		// Return handle for controlling this overlay
		return {
			hide: () => {
				const index = this.overlayStack.indexOf(entry);
				if (index !== -1) {
					this.overlayStack.splice(index, 1);
					// Restore focus if this overlay had focus
					if (this.#focusedComponent === component) {
						const topVisible = this.#getTopmostVisibleOverlay();
						this.setFocus(topVisible?.component ?? entry.preFocus);
					}
					if (this.overlayStack.length === 0) this.#hideCursor();
					this.requestRender();
				}
			},
			setHidden: (hidden: boolean) => {
				if (entry.hidden === hidden) return;
				entry.hidden = hidden;
				// Update focus when hiding/showing
				if (hidden) {
					// If this overlay had focus, move focus to next visible or preFocus
					if (this.#focusedComponent === component) {
						const topVisible = this.#getTopmostVisibleOverlay();
						this.setFocus(topVisible?.component ?? entry.preFocus);
					}
				} else {
					// Restore focus to this overlay when showing (if it's actually visible)
					if (this.#isOverlayVisible(entry)) {
						this.setFocus(component);
					}
				}
				this.requestRender();
			},
			isHidden: () => entry.hidden,
		};
	}

	/** Hide the topmost overlay and restore previous focus. */
	hideOverlay(): void {
		const overlay = this.overlayStack.pop();
		if (!overlay) return;
		// Find topmost visible overlay, or fall back to preFocus
		const topVisible = this.#getTopmostVisibleOverlay();
		this.setFocus(topVisible?.component ?? overlay.preFocus);
		if (this.overlayStack.length === 0) this.#hideCursor();
		this.requestRender();
	}

	/** Check if there are any visible overlays */
	hasOverlay(): boolean {
		return this.overlayStack.some(o => this.#isOverlayVisible(o));
	}

	/** Check if an overlay entry is currently visible */
	#isOverlayVisible(entry: (typeof this.overlayStack)[number]): boolean {
		if (entry.hidden) return false;
		if (entry.options?.visible) {
			return entry.options.visible(this.terminal.columns, this.terminal.rows);
		}
		return true;
	}

	/** Find the topmost visible overlay, if any */
	#getTopmostVisibleOverlay(): (typeof this.overlayStack)[number] | undefined {
		for (let i = this.overlayStack.length - 1; i >= 0; i--) {
			if (this.#isOverlayVisible(this.overlayStack[i])) {
				return this.overlayStack[i];
			}
		}
		return undefined;
	}

	override invalidate(): void {
		super.invalidate();
		for (const overlay of this.overlayStack) overlay.component.invalidate?.();
	}

	start(): void {
		this.#stopped = false;
		this.#terminalUnavailable = false;
		this.#historyLane = detectHistoryLaneMode();
		this.terminal.start(
			data => this.#handleInput(data),
			() => this.#handleResize(),
		);
		this.#hideCursor();
		this.#querySixelSupport();
		this.#queryCellSize();
		this.#queryAmbiguousWidth();
		this.requestRender(true);
	}

	get terminalAvailable(): boolean {
		return !this.#terminalUnavailable && this.terminal.available;
	}

	#markTerminalUnavailable(): void {
		this.#terminalUnavailable = true;
		this.#stopped = true;
		this.#renderRequested = false;
		if (this.#renderTimer) {
			clearTimeout(this.#renderTimer);
			this.#renderTimer = undefined;
			if (renderMetrics.enabled) renderMetrics.setTimerGauge("tui.renderTimer", 0);
		}
		this.#clearSixelProbeState();
		this.#clearAmbiguousProbeState();
		this.#ambiguousWidthResolved = true;
	}

	#writeTerminal(data: string): boolean {
		return this.#guardTerminalOperation(() => this.terminal.write(data));
	}

	#hideCursor(): boolean {
		return this.#guardTerminalOperation(() => this.terminal.hideCursor());
	}

	#showCursor(): boolean {
		return this.#guardTerminalOperation(() => this.terminal.showCursor());
	}

	#guardTerminalOperation(operation: () => void): boolean {
		if (!this.terminalAvailable) {
			this.#markTerminalUnavailable();
			return false;
		}
		try {
			operation();
		} catch {
			this.#markTerminalUnavailable();
			return false;
		}
		if (!this.terminal.available) {
			this.#markTerminalUnavailable();
			return false;
		}
		return true;
	}

	addInputListener(listener: InputListener): () => void {
		this.#inputListeners.add(listener);
		return () => {
			this.#inputListeners.delete(listener);
		};
	}

	removeInputListener(listener: InputListener): void {
		this.#inputListeners.delete(listener);
	}

	#querySixelSupport(): void {
		if (TERMINAL.imageProtocol) return;
		if (process.platform !== "win32") return;
		if (!process.env.WT_SESSION) return;
		if (!process.stdin.isTTY || !process.stdout.isTTY) return;

		this.#clearSixelProbeState();
		this.#sixelProbePendingDa = true;
		this.#sixelProbePendingGraphics = true;
		this.#sixelProbeUnsubscribe = this.addInputListener(data => this.#handleSixelProbeInput(data));
		if (!this.#writeTerminal("\x1b[c")) return;
		if (!this.#writeTerminal("\x1b[?2;1;0S")) return;
		this.#sixelProbeTimeout = setTimeout(() => {
			this.#finishSixelProbe(false);
		}, 250);
	}

	#handleSixelProbeInput(data: string): InputListenerResult {
		if (!this.#sixelProbePendingDa && !this.#sixelProbePendingGraphics) {
			return undefined;
		}

		this.#sixelProbeBuffer += data;
		let passthrough = "";
		let probeOutcome: boolean | null = null;

		while (this.#sixelProbeBuffer.length > 0) {
			const daMatch = this.#sixelProbeBuffer.match(/\x1b\[\?([0-9;]+)c/u);
			const graphicsMatch = this.#sixelProbeBuffer.match(/\x1b\[\?2;(\d+);([0-9;]+)S/u);

			if (!daMatch && !graphicsMatch) break;

			const daIndex = daMatch?.index ?? Number.POSITIVE_INFINITY;
			const graphicsIndex = graphicsMatch?.index ?? Number.POSITIVE_INFINITY;
			const useDa = daIndex <= graphicsIndex;
			const match = useDa ? daMatch : graphicsMatch;
			if (!match || match.index === undefined) break;

			passthrough += this.#sixelProbeBuffer.slice(0, match.index);
			this.#sixelProbeBuffer = this.#sixelProbeBuffer.slice(match.index + match[0].length);

			if (useDa && this.#sixelProbePendingDa) {
				this.#sixelProbePendingDa = false;
				const attributes = (match[1] ?? "")
					.split(";")
					.map(value => Number.parseInt(value, 10))
					.filter(value => Number.isFinite(value));
				const hasSixelAttribute = attributes.includes(4);
				if (hasSixelAttribute) {
					this.#sixelProbePendingGraphics = false;
					probeOutcome = true;
				} else if (!this.#sixelProbePendingGraphics) {
					probeOutcome = false;
				}
			} else if (!useDa && this.#sixelProbePendingGraphics) {
				this.#sixelProbePendingGraphics = false;
				const status = Number.parseInt(match[1] ?? "", 10);
				const supportsSixel = !Number.isNaN(status) && status !== 0;
				if (supportsSixel) {
					this.#sixelProbePendingDa = false;
					probeOutcome = true;
				} else if (!this.#sixelProbePendingDa) {
					probeOutcome = false;
				}
			}
		}

		if (this.#sixelProbePendingDa || this.#sixelProbePendingGraphics) {
			const partialStart = this.#getSixelProbePartialStart(this.#sixelProbeBuffer);
			if (partialStart >= 0) {
				passthrough += this.#sixelProbeBuffer.slice(0, partialStart);
				this.#sixelProbeBuffer = this.#sixelProbeBuffer.slice(partialStart);
			} else {
				passthrough += this.#sixelProbeBuffer;
				this.#sixelProbeBuffer = "";
			}
		} else {
			passthrough += this.#sixelProbeBuffer;
			this.#sixelProbeBuffer = "";
		}

		if (probeOutcome !== null) {
			this.#finishSixelProbe(probeOutcome);
		}

		if (passthrough.length === 0) {
			return { consume: true };
		}

		return { data: passthrough };
	}

	#getSixelProbePartialStart(buffer: string): number {
		const lastEsc = buffer.lastIndexOf("\x1b");
		if (lastEsc < 0) return -1;
		const tail = buffer.slice(lastEsc);
		if (/^\x1b\[\?[0-9;]*$/u.test(tail)) {
			return lastEsc;
		}
		return -1;
	}

	#clearSixelProbeState(): void {
		if (this.#sixelProbeTimeout) {
			clearTimeout(this.#sixelProbeTimeout);
			this.#sixelProbeTimeout = undefined;
		}
		if (this.#sixelProbeUnsubscribe) {
			this.#sixelProbeUnsubscribe();
			this.#sixelProbeUnsubscribe = undefined;
		}
		this.#sixelProbePendingDa = false;
		this.#sixelProbePendingGraphics = false;
		this.#sixelProbeBuffer = "";
	}

	#finishSixelProbe(supported: boolean): void {
		this.#clearSixelProbeState();
		if (!supported || TERMINAL.imageProtocol) return;

		setTerminalImageProtocol(ImageProtocol.Sixel);
		this.#queryCellSize();
		this.invalidate();
		this.requestRender(true);
	}
	#queryCellSize(): void {
		// Only query if terminal supports images (cell size is only used for image rendering)
		if (!TERMINAL.imageProtocol) {
			return;
		}
		// Query terminal for cell size in pixels: CSI 16 t
		// Response format: CSI 6 ; height ; width t
		this.#writeTerminal("\x1b[16t");
	}

	/**
	 * 260703 WP2.5 — learn how the terminal renders East Asian AMBIGUOUS
	 * characters. One invisible round-trip before the first frame: clear the
	 * line, print three EAW-A probes, ask for the cursor position (CPR),
	 * clear again — the reply (CSI row;col R) arrives async. col-1 of 6 means
	 * ambiguous-wide (3 chars × 2 cells); 3 means narrow. The verdict feeds
	 * BOTH width tables (Bun.stringWidth and pi-natives) via
	 * setAmbiguousWidthMode. Env override JWC_AMBIGUOUS_WIDTH=1|narrow|2|wide
	 * wins and skips the probe (also the deterministic path for replays).
	 * Timeout keeps the current default: most terminals render ambiguous
	 * narrow, and post-WP2 (DECAWM off) a wrong narrow only clips a cell,
	 * while a wrong wide would mis-lay-out every padded line.
	 */
	#queryAmbiguousWidth(): void {
		const override = $env.JWC_AMBIGUOUS_WIDTH;
		if (override === "2" || override === "wide") {
			setAmbiguousWidthMode("wide");
			return;
		}
		if (override === "1" || override === "narrow") {
			setAmbiguousWidthMode("narrow");
			return;
		}
		// stdin too: without a readable TTY the reply can never arrive — the
		// probe would only stall the commit gate for the timeout window.
		if (!process.stdout.isTTY || !process.stdin.isTTY) return;
		// A terminal too narrow for the probe chars would clip them (DECAWM
		// off) and report a meaningless column.
		if (this.terminal.columns < 8) return;

		this.#clearAmbiguousProbeState();
		this.#ambiguousProbePending = true;
		this.#ambiguousWidthResolved = false;
		this.#ambiguousProbeUnsubscribe = this.addInputListener(data => this.#handleAmbiguousProbeInput(data));
		// Single write: clear, probe chars, CPR snapshot, clear again — the
		// terminal processes in order, so the screen is never visibly
		// disturbed and the cursor ends at column 1 exactly as the first
		// render (fullRender without clear) expects.
		if (!this.#writeTerminal("\r\x1b[2K§…·\x1b[6n\r\x1b[2K")) {
			this.#resolveAmbiguousProbe(null);
			return;
		}
		this.#ambiguousProbeTimeout = setTimeout(() => {
			this.#enterAmbiguousProbeGrace();
		}, 150);
	}

	/**
	 * Timeout path: unblock the commit gate immediately (safe-default narrow)
	 * but keep a short-lived swallower listening — a terminal that answers
	 * CPR late would otherwise leak `ESC[r;cR` into the editor as keystrokes.
	 * The late reply is cleanup only: it never changes the width mode
	 * (re-measuring after content may have rendered/committed is more
	 * disruptive than a one-cell clip).
	 */
	#enterAmbiguousProbeGrace(): void {
		this.#ambiguousWidthResolved = true;
		this.#ambiguousProbeGrace = true;
		if (this.#ambiguousProbeTimeout) clearTimeout(this.#ambiguousProbeTimeout);
		this.#ambiguousProbeTimeout = setTimeout(() => {
			this.#clearAmbiguousProbeState();
		}, 800);
	}

	#handleAmbiguousProbeInput(data: string): InputListenerResult {
		if (!this.#ambiguousProbePending) return undefined;
		this.#ambiguousProbeBuffer += data;

		const match = this.#ambiguousProbeBuffer.match(/\x1b\[(\d+);(\d+)R/);
		if (match?.index !== undefined) {
			const passthrough =
				this.#ambiguousProbeBuffer.slice(0, match.index) +
				this.#ambiguousProbeBuffer.slice(match.index + match[0].length);
			this.#ambiguousProbeBuffer = "";
			if (this.#ambiguousProbeGrace) {
				// Late reply after the timeout window: swallow it, keep narrow.
				this.#clearAmbiguousProbeState();
			} else {
				this.#resolveAmbiguousProbe(Number.parseInt(match[2], 10));
			}
			if (passthrough.length === 0) return { consume: true };
			return { data: passthrough };
		}

		// Keep a plausible CPR prefix (plain CSI — the terminal-side
		// reassembler only covers private `ESC[?` replies); pass everything
		// before it through so user keystrokes are never swallowed.
		const lastEsc = this.#ambiguousProbeBuffer.lastIndexOf("\x1b");
		if (lastEsc >= 0 && /^\x1b(\[[0-9;]*)?$/.test(this.#ambiguousProbeBuffer.slice(lastEsc))) {
			const passthrough = this.#ambiguousProbeBuffer.slice(0, lastEsc);
			this.#ambiguousProbeBuffer = this.#ambiguousProbeBuffer.slice(lastEsc);
			if (passthrough.length === 0) return { consume: true };
			return { data: passthrough };
		}

		const passthrough = this.#ambiguousProbeBuffer;
		this.#ambiguousProbeBuffer = "";
		if (passthrough.length === 0) return { consume: true };
		return { data: passthrough };
	}

	/** Apply the probe verdict; null = timeout/failure (keep current mode). */
	#resolveAmbiguousProbe(col: number | null): void {
		this.#clearAmbiguousProbeState();
		this.#ambiguousWidthResolved = true;
		if (col === null) return;
		const mode = col - 1 >= 6 ? "wide" : "narrow";
		if (mode === getAmbiguousWidthMode()) return;
		setAmbiguousWidthMode(mode);
		// Every cached prepared line and rendered layout was measured with the
		// old table — rebuild from scratch.
		this.#clearPreparedLineCaches();
		this.invalidate();
		this.requestRender(true);
	}

	#clearAmbiguousProbeState(): void {
		if (this.#ambiguousProbeTimeout) {
			clearTimeout(this.#ambiguousProbeTimeout);
			this.#ambiguousProbeTimeout = undefined;
		}
		if (this.#ambiguousProbeUnsubscribe) {
			this.#ambiguousProbeUnsubscribe();
			this.#ambiguousProbeUnsubscribe = undefined;
		}
		this.#ambiguousProbePending = false;
		this.#ambiguousProbeGrace = false;
		this.#ambiguousProbeBuffer = "";
	}

	stop(): void {
		this.#clearSixelProbeState();
		this.#clearAmbiguousProbeState();
		this.#ambiguousWidthResolved = true;
		this.#resyncRequested = false;
		this.#stopped = true;
		if (this.#renderTimer) {
			clearTimeout(this.#renderTimer);
			this.#renderTimer = undefined;
			if (renderMetrics.enabled) renderMetrics.setTimerGauge("tui.renderTimer", 0);
		}
		if (renderMetrics.enabled && isPerfJsonlFlushEnabled()) {
			flushPerfEventsSync(renderMetrics);
		}
		// Move cursor to the end of the content to prevent overwriting/artifacts on exit
		if (this.#previousLines.length > 0) {
			const targetRow = this.#previousLines.length; // Line after the last content
			const lineDiff = targetRow - this.#hardwareCursorRow;
			if (lineDiff > 0) {
				this.#writeTerminal(`\x1b[${lineDiff}B`);
			} else if (lineDiff < 0) {
				this.#writeTerminal(`\x1b[${-lineDiff}A`);
			}
			this.#writeTerminal("\r\n");
		}

		this.#showCursor();
		try {
			this.terminal.stop();
		} catch {
			this.#markTerminalUnavailable();
		}
		// Teardown: release the retained rendered transcript so a stopped TUI does
		// not pin a flat copy of every emitted line for the process lifetime.
		// Safe across temporary stop/start (Ctrl-Z resume, external editor): start()
		// issues a forced render that rebuilds this state and fully redraws, and
		// focus/listener state is intentionally preserved so input routing survives
		// a resume.
		this.#previousLines = [];
		this.#previousWidth = 0;
		this.#previousHeight = 0;
		this.#clearPreparedLineCaches();
	}

	requestRender(force = false, source = "unknown"): void {
		if (!this.terminalAvailable) {
			this.#markTerminalUnavailable();
			return;
		}
		if (renderMetrics.enabled) renderMetrics.recordRequest(source);
		if (force) {
			// A forced full redraw supersedes any queued input-priority render.
			this.#inputRenderPending = false;
			this.#previousLines = [];
			this.#previousWidth = -1; // -1 triggers widthChanged, forcing a full clear
			this.#clearPreparedLineCaches();
			this.#previousHeight = -1; // -1 triggers heightChanged, forcing a full clear
			this.#cursorRow = 0;
			this.#hardwareCursorRow = 0;
			this.#viewportTopRow = 0;
			this.#maxLinesRendered = 0;
			if (this.#renderTimer) {
				clearTimeout(this.#renderTimer);
				this.#renderTimer = undefined;
				if (renderMetrics.enabled) renderMetrics.setTimerGauge("tui.renderTimer", 0);
			}
			this.#renderRequested = true;
			process.nextTick(() => {
				if (this.#stopped || !this.#renderRequested) {
					return;
				}
				this.#renderRequested = false;
				this.#lastRenderAt = performance.now();
				const t0 = renderMetrics.now();
				this.#doRender();
				if (renderMetrics.enabled) renderMetrics.recordRender(renderMetrics.now() - t0);
			});
			return;
		}
		// Input-priority path: expedite so the keystroke echoes within the next tick
		// instead of waiting for (or behind) the frame-budget timer. Re-entrant input
		// requests in the same turn coalesce via #inputRenderPending, so at most one
		// expedited render commits per event-loop turn (no repaint storms). This only
		// changes WHEN #doRender runs; the render output path is unchanged.
		if (source === "input" || source === "editor.input") {
			if (!this.#inputRenderPending) {
				this.#inputRenderPending = true;
				this.#renderRequested = true;
				process.nextTick(() => this.#commitExpeditedRender());
			}
			return;
		}
		if (this.#renderRequested) return;
		this.#renderRequested = true;
		process.nextTick(() => this.#scheduleRender());
	}

	#scheduleRender(): void {
		if (this.#stopped || this.#renderTimer || !this.#renderRequested) {
			return;
		}
		const elapsed = performance.now() - this.#lastRenderAt;
		const delay = Math.max(0, TUI.#MIN_RENDER_INTERVAL_MS - elapsed);
		this.#renderTimer = setTimeout(() => {
			this.#renderTimer = undefined;
			if (renderMetrics.enabled) renderMetrics.setTimerGauge("tui.renderTimer", 0);
			if (this.#stopped || !this.#renderRequested) {
				return;
			}
			this.#renderRequested = false;
			this.#lastRenderAt = performance.now();
			const t0 = renderMetrics.now();
			this.#doRender();
			if (renderMetrics.enabled) renderMetrics.recordRender(renderMetrics.now() - t0);
			if (this.#renderRequested) {
				this.#scheduleRender();
			}
		}, delay);
		if (renderMetrics.enabled) renderMetrics.setTimerGauge("tui.renderTimer", 1);
	}

	// Commit a single input-priority render on the next tick, cancelling any normal
	// frame-budget timer scheduled in the same turn. nextTick always precedes a
	// pending setTimeout, so the keystroke is never starved behind streaming renders.
	#commitExpeditedRender(): void {
		if (!this.#inputRenderPending) return; // cancelled (e.g., by a forced render)
		this.#inputRenderPending = false;
		if (this.#stopped || !this.#renderRequested) {
			return;
		}
		if (this.#renderTimer) {
			clearTimeout(this.#renderTimer);
			this.#renderTimer = undefined;
			if (renderMetrics.enabled) renderMetrics.setTimerGauge("tui.renderTimer", 0);
		}
		this.#renderRequested = false;
		this.#lastRenderAt = performance.now();
		const t0 = renderMetrics.now();
		this.#doRender();
		if (renderMetrics.enabled) renderMetrics.recordRender(renderMetrics.now() - t0);
	}

	#handleInput(data: string): void {
		if (this.#inputListeners.size > 0) {
			let current = data;
			for (const listener of this.#inputListeners) {
				const result = listener(current);
				if (result?.consume) {
					return;
				}
				if (result?.data !== undefined) {
					current = result.data;
				}
			}
			if (current.length === 0) {
				return;
			}
			data = current;
		}

		// Consume terminal cell size responses without blocking unrelated input.
		if (this.#consumeCellSizeResponse(data)) {
			return;
		}

		// Global debug key handler (Shift+Ctrl+D)
		if (matchesKey(data, "shift+ctrl+d") && this.onDebug) {
			this.onDebug();
			return;
		}

		// If focused component is an overlay, verify it's still visible
		// (visibility can change due to terminal resize or visible() callback)
		const focusedOverlay = this.overlayStack.find(o => o.component === this.#focusedComponent);
		if (focusedOverlay && !this.#isOverlayVisible(focusedOverlay)) {
			// Focused overlay is no longer visible, redirect to topmost visible overlay
			const topVisible = this.#getTopmostVisibleOverlay();
			if (topVisible) {
				this.setFocus(topVisible.component);
			} else {
				// No visible overlays, restore to preFocus
				this.setFocus(focusedOverlay.preFocus);
			}
		}

		// Pass input to focused component (including Ctrl+C)
		// The focused component can decide how to handle Ctrl+C
		if (this.#focusedComponent?.handleInput) {
			// Filter out key release events unless component opts in
			if (isKeyRelease(data) && !this.#focusedComponent.wantsKeyRelease) {
				return;
			}
			this.#focusedComponent.handleInput(data);
			this.requestRender(false, "input");
		}
	}

	#consumeCellSizeResponse(data: string): boolean {
		// Response format: ESC [ 6 ; height ; width t
		const match = data.match(/^\x1b\[6;(\d+);(\d+)t$/);
		if (!match) {
			return false;
		}

		const heightPx = parseInt(match[1], 10);
		const widthPx = parseInt(match[2], 10);
		if (heightPx <= 0 || widthPx <= 0) {
			return true;
		}

		setCellDimensions({ widthPx, heightPx });
		// Invalidate all components so images re-render with correct dimensions.
		this.invalidate();
		this.requestRender();
		return true;
	}

	/**
	 * Resolve overlay layout from options.
	 * Returns { width, row, col, maxHeight } for rendering.
	 */
	#resolveOverlayLayout(
		options: OverlayOptions | undefined,
		overlayHeight: number,
		termWidth: number,
		termHeight: number,
	): { width: number; row: number; col: number; maxHeight: number | undefined } {
		const opt = options ?? {};

		// Parse margin (clamp to non-negative)
		const margin =
			typeof opt.margin === "number"
				? { top: opt.margin, right: opt.margin, bottom: opt.margin, left: opt.margin }
				: (opt.margin ?? {});
		const marginTop = Math.max(0, margin.top ?? 0);
		const marginRight = Math.max(0, margin.right ?? 0);
		const marginBottom = Math.max(0, margin.bottom ?? 0);
		const marginLeft = Math.max(0, margin.left ?? 0);

		// Available space after margins
		const availWidth = Math.max(1, termWidth - marginLeft - marginRight);
		const availHeight = Math.max(1, termHeight - marginTop - marginBottom);

		// === Resolve width ===
		let width = parseSizeValue(opt.width, termWidth) ?? Math.min(80, availWidth);
		// Apply minWidth
		if (opt.minWidth !== undefined) {
			width = Math.max(width, opt.minWidth);
		}
		// Clamp to available space
		width = Math.max(1, Math.min(width, availWidth));

		// === Resolve maxHeight ===
		let maxHeight = parseSizeValue(opt.maxHeight, termHeight);
		// Clamp to available space
		if (maxHeight !== undefined) {
			maxHeight = Math.max(1, Math.min(maxHeight, availHeight));
		}

		// Effective overlay height (may be clamped by maxHeight)
		const effectiveHeight = maxHeight !== undefined ? Math.min(overlayHeight, maxHeight) : overlayHeight;

		// === Resolve position ===
		let row: number;
		let col: number;

		if (opt.row !== undefined) {
			if (typeof opt.row === "string") {
				// Percentage: 0% = top, 100% = bottom (overlay stays within bounds)
				const match = opt.row.match(/^(\d+(?:\.\d+)?)%$/);
				if (match) {
					const maxRow = Math.max(0, availHeight - effectiveHeight);
					const percent = parseFloat(match[1]) / 100;
					row = marginTop + Math.floor(maxRow * percent);
				} else {
					// Invalid format, fall back to center
					row = this.#resolveAnchorRow("center", effectiveHeight, availHeight, marginTop);
				}
			} else {
				// Absolute row position
				row = opt.row;
			}
		} else {
			// Anchor-based (default: center)
			const anchor = opt.anchor ?? "center";
			row = this.#resolveAnchorRow(anchor, effectiveHeight, availHeight, marginTop);
		}

		if (opt.col !== undefined) {
			if (typeof opt.col === "string") {
				// Percentage: 0% = left, 100% = right (overlay stays within bounds)
				const match = opt.col.match(/^(\d+(?:\.\d+)?)%$/);
				if (match) {
					const maxCol = Math.max(0, availWidth - width);
					const percent = parseFloat(match[1]) / 100;
					col = marginLeft + Math.floor(maxCol * percent);
				} else {
					// Invalid format, fall back to center
					col = this.#resolveAnchorCol("center", width, availWidth, marginLeft);
				}
			} else {
				// Absolute column position
				col = opt.col;
			}
		} else {
			// Anchor-based (default: center)
			const anchor = opt.anchor ?? "center";
			col = this.#resolveAnchorCol(anchor, width, availWidth, marginLeft);
		}

		// Apply offsets
		if (opt.offsetY !== undefined) row += opt.offsetY;
		if (opt.offsetX !== undefined) col += opt.offsetX;

		// Clamp to terminal bounds (respecting margins)
		row = Math.max(marginTop, Math.min(row, termHeight - marginBottom - effectiveHeight));
		col = Math.max(marginLeft, Math.min(col, termWidth - marginRight - width));

		return { width, row, col, maxHeight };
	}

	#resolveAnchorRow(anchor: OverlayAnchor, height: number, availHeight: number, marginTop: number): number {
		switch (anchor) {
			case "top-left":
			case "top-center":
			case "top-right":
				return marginTop;
			case "bottom-left":
			case "bottom-center":
			case "bottom-right":
				return marginTop + availHeight - height;
			case "left-center":
			case "center":
			case "right-center":
				return marginTop + Math.floor((availHeight - height) / 2);
		}
	}

	#resolveAnchorCol(anchor: OverlayAnchor, width: number, availWidth: number, marginLeft: number): number {
		switch (anchor) {
			case "top-left":
			case "left-center":
			case "bottom-left":
				return marginLeft;
			case "top-right":
			case "right-center":
			case "bottom-right":
				return marginLeft + availWidth - width;
			case "top-center":
			case "center":
			case "bottom-center":
				return marginLeft + Math.floor((availWidth - width) / 2);
		}
	}

	/** Composite all overlays into content lines (in stack order, later = on top). */
	#compositeOverlays(lines: string[], termWidth: number, termHeight: number): string[] {
		if (this.overlayStack.length === 0) return lines;
		const result = [...lines];

		// Pre-render all visible overlays and calculate positions
		const rendered: { overlayLines: string[]; row: number; col: number; w: number }[] = [];
		let minLinesNeeded = result.length;

		for (const entry of this.overlayStack) {
			// Skip invisible overlays (hidden or visible() returns false)
			if (!this.#isOverlayVisible(entry)) continue;

			const { component, options } = entry;

			// Get layout with height=0 first to determine width and maxHeight
			// (width and maxHeight don't depend on overlay height)
			const { width, maxHeight } = this.#resolveOverlayLayout(options, 0, termWidth, termHeight);

			// Let viewport-like overlays size themselves from the resolved layout
			// instead of guessing from process.stdout.rows.
			component.setOverlayViewportRows?.(Math.max(1, maxHeight ?? termHeight));

			// Render component at calculated width
			let overlayLines = safeRenderComponent(component, width, "overlay");

			// Apply maxHeight if specified
			if (maxHeight !== undefined && overlayLines.length > maxHeight) {
				overlayLines = overlayLines.slice(0, maxHeight);
			}

			// Get final row/col with actual overlay height
			const { row, col } = this.#resolveOverlayLayout(options, overlayLines.length, termWidth, termHeight);

			rendered.push({ overlayLines, row, col, w: width });
			minLinesNeeded = Math.max(minLinesNeeded, row + overlayLines.length);
		}

		// Ensure result is tall enough for overlay placement.
		// NOTE: Do not pad to maxLinesRendered.
		// maxLinesRendered tracks the terminal "working area" (max lines ever rendered) and can be much larger
		// than the current content. Padding to it can cause the renderer to output hundreds/thousands of blank
		// lines, effectively scrolling the terminal when an overlay is shown.
		const workingHeight = Math.max(result.length, minLinesNeeded);

		// Extend result with empty lines if content is too short for overlay placement
		while (result.length < workingHeight) {
			result.push("");
		}

		const viewportStart = Math.max(0, workingHeight - termHeight);

		// Track which lines were modified for final verification
		const modifiedLines = new Set<number>();

		// Composite each overlay
		for (const { overlayLines, row, col, w } of rendered) {
			for (let i = 0; i < overlayLines.length; i++) {
				const idx = viewportStart + row + i;
				if (idx >= 0 && idx < result.length) {
					// Defensive: truncate overlay line to declared width before compositing
					// (components should already respect width, but this ensures it)
					const truncatedOverlayLine =
						visibleWidth(overlayLines[i]) > w ? sliceByColumn(overlayLines[i], 0, w, true) : overlayLines[i];
					result[idx] = this.#compositeLineAt(result[idx], truncatedOverlayLine, col, w, termWidth);
					modifiedLines.add(idx);
				}
			}
		}

		// Final verification: ensure no composited line exceeds terminal width
		// This is a belt-and-suspenders safeguard - compositeLineAt should already
		// guarantee this, but we verify here to prevent crashes from any edge cases
		// Only check lines that were actually modified (optimization)
		for (const idx of modifiedLines) {
			const lineWidth = visibleWidth(result[idx]);
			if (lineWidth > termWidth) {
				result[idx] = sliceByColumn(result[idx], 0, termWidth, true);
			}
		}

		return result;
	}

	/** Splice overlay content into a base line at a specific column. Single-pass optimized. */
	#compositeLineAt(
		baseLine: string,
		overlayLine: string,
		startCol: number,
		overlayWidth: number,
		totalWidth: number,
	): string {
		if (TERMINAL.isImageLine(baseLine)) return baseLine;

		// Single pass through baseLine extracts both before and after segments
		const afterStart = startCol + overlayWidth;
		const base = extractSegments(baseLine, startCol, afterStart, totalWidth - afterStart, true);

		// Extract overlay with width tracking (strict=true to exclude wide chars at boundary)
		const overlay = sliceWithWidth(overlayLine, 0, overlayWidth, true);

		// Pad segments to target widths
		const beforePad = Math.max(0, startCol - base.beforeWidth);
		const overlayPad = Math.max(0, overlayWidth - overlay.width);
		const actualBeforeWidth = Math.max(startCol, base.beforeWidth);
		const actualOverlayWidth = Math.max(overlayWidth, overlay.width);
		const afterTarget = Math.max(0, totalWidth - actualBeforeWidth - actualOverlayWidth);
		const afterPad = Math.max(0, afterTarget - base.afterWidth);

		// Compose result
		const r = SEGMENT_RESET;
		const result =
			base.before +
			" ".repeat(beforePad) +
			r +
			overlay.text +
			" ".repeat(overlayPad) +
			r +
			base.after +
			" ".repeat(afterPad);

		// CRITICAL: Always verify and truncate to terminal width.
		// This is the final safeguard against width overflow which would crash the TUI.
		// Width tracking can drift from actual visible width due to:
		// - Complex ANSI/OSC sequences (hyperlinks, colors)
		// - Wide characters at segment boundaries
		// - Edge cases in segment extraction
		const resultWidth = visibleWidth(result);
		if (resultWidth <= totalWidth) {
			return result;
		}
		// Truncate with strict=true to ensure we don't exceed totalWidth
		return sliceByColumn(result, 0, totalWidth, true);
	}

	/**
	 * Find and extract cursor position from rendered lines.
	 * Searches for CURSOR_MARKER, calculates its position, and strips it from the output.
	 * Only scans the bottom terminal height lines (visible viewport).
	 * @param lines - Rendered lines to search
	 * @param height - Terminal height (visible viewport size)
	 * @returns Cursor position { row, col } or null if no marker found
	 */
	#extractCursorPosition(lines: string[], height: number): { row: number; col: number } | null {
		// Only scan the bottom `height` lines (visible viewport)
		const viewportTop = Math.max(0, lines.length - height);
		for (let row = lines.length - 1; row >= viewportTop; row--) {
			const line = lines[row];
			const markerIndex = line.indexOf(CURSOR_MARKER);
			if (markerIndex !== -1) {
				// Calculate visual column (width of text before marker)
				const beforeMarker = line.slice(0, markerIndex);
				const col = visibleWidth(beforeMarker);

				// Strip marker from the line
				lines[row] = line.slice(0, markerIndex) + line.slice(markerIndex + CURSOR_MARKER.length);

				return { row, col };
			}
		}
		return null;
	}

	#clearPreparedLineCaches(): void {
		this.#preparedNormalizeCache.clear();
		this.#preparedTruncateCache.clear();
	}

	#emptyPreparedLineStats(): PreparedLineStats {
		return { normalizeHit: 0, normalizeMiss: 0, truncateHit: 0, truncateMiss: 0 };
	}

	#rememberPreparedLine(cache: Map<string, string>, key: string, value: string): string {
		if (!cache.has(key) && cache.size >= PREPARED_LINE_CACHE_LIMIT) {
			let remaining = PREPARED_LINE_CACHE_EVICT_COUNT;
			for (const retainedKey of cache.keys()) {
				cache.delete(retainedKey);
				remaining--;
				if (remaining <= 0) break;
			}
		}
		cache.set(key, value);
		return value;
	}

	#isPrintableAsciiLine(line: string): boolean {
		for (let i = 0; i < line.length; i++) {
			const code = line.charCodeAt(i);
			if (code < 0x20 || code > 0x7e) return false;
		}
		return true;
	}

	#terminalTerminator(line: string): string {
		return line.includes("\x1b]8;") ? LINE_TERMINATOR : SEGMENT_RESET;
	}

	#truncatePreparedLineToWidth(line: string, width: number): string {
		if (TERMINAL.isImageLine(line) || visibleWidth(line) <= width) return line;
		const truncated = truncateToWidth(line, width, Ellipsis.Omit);
		return truncated + this.#terminalTerminator(truncated);
	}

	#prepareLineForTerminal(line: string, width: number, stats: PreparedLineStats): string {
		if (TERMINAL.isImageLine(line)) return line;

		let prepared = this.#preparedNormalizeCache.get(line);
		if (prepared !== undefined) {
			stats.normalizeHit++;
		} else {
			stats.normalizeMiss++;
			const normalized = normalizeTerminalOutput(line);
			prepared = this.#rememberPreparedLine(
				this.#preparedNormalizeCache,
				line,
				normalized + this.#terminalTerminator(normalized),
			);
		}

		if (this.#isPrintableAsciiLine(line) && line.length <= width) return prepared;
		if (visibleWidth(prepared) <= width) return prepared;

		const truncateKey = `${width}\0${prepared}`;
		const truncatedHit = this.#preparedTruncateCache.get(truncateKey);
		if (truncatedHit !== undefined) {
			stats.truncateHit++;
			return truncatedHit;
		}

		stats.truncateMiss++;
		return this.#rememberPreparedLine(
			this.#preparedTruncateCache,
			truncateKey,
			this.#truncatePreparedLineToWidth(prepared, width),
		);
	}

	#prepareLinesForTerminal(lines: string[], width: number): { lines: string[]; stats: PreparedLineStats } {
		const stats = this.#emptyPreparedLineStats();
		for (let i = 0; i < lines.length; i++) {
			lines[i] = this.#prepareLineForTerminal(lines[i], width, stats);
		}
		return { lines, stats };
	}

	#recordPreparedLineStats(stats: PreparedLineStats, owner: "render" | "commit"): void {
		if (!renderMetrics.enabled) return;
		renderMetrics.recordEvent(
			"tui.preparedLine",
			{
				"normalize.hit": stats.normalizeHit,
				"normalize.miss": stats.normalizeMiss,
				"truncate.hit": stats.truncateHit,
				"truncate.miss": stats.truncateMiss,
			},
			{ owner },
		);
	}

	/**
	 * Physical frame length while the frame overflows the viewport (260630).
	 * The terminal cannot un-scroll: once an N-row frame was painted, rows may
	 * already live in the scrollback, so the frame must stay N rows long until
	 * a deliberate clearing full render realigns screen and frame. Shrinks are
	 * absorbed by #restoreOverflowFloor tombstones instead of shifting rows.
	 */
	#overflowFloor = 0;
	/**
	 * Raw (post-fill, pre-composite, pre-prepare) lines of the last frame.
	 * #restoreOverflowFloor scans these to anchor shrink tombstones at the
	 * exact first changed row; survives forced renders so the floor invariant
	 * holds across requestRender(true).
	 */
	#previousRawLines: string[] = [];
	/** Tombstone rows inserted by the last #restoreOverflowFloor pass. */
	#lastTombstoneRows = 0;
	/** Whether the current frame carries a ViewportFill sentinel (pin model). */
	#fillSentinelPresent = false;
	/**
	 * While true (transient in-frame expansion, e.g. ctrl+o), growth must not
	 * physically scroll the terminal: the grown rows are painted via viewport
	 * repaint only and the overflow floor stays frozen, so collapsing back
	 * restores the pre-expansion screen exactly instead of leaving a blank
	 * residue the height of the expansion (260630 ctrl+o hole follow-up).
	 */
	#overflowFloorFrozen = false;

	/**
	 * Mark the current in-frame expansion as transient (see
	 * #overflowFloorFrozen). Callers freeze before rendering the expansion and
	 * unfreeze when it collapses or the turn ends; leaving it frozen only
	 * degrades to viewport-repaint growth (no duplication, scrollback pauses).
	 */
	setOverflowFloorFrozen(frozen: boolean): void {
		this.#overflowFloorFrozen = frozen;
	}

	/**
	 * 260703 WP1 — request a one-shot absolute repaint of the visible viewport
	 * on the next render. Unlike requestRender(true) this neither clears the
	 * scrollback nor rebuilds the mirrors from scratch: it replays the current
	 * frame's visible rows at absolute coordinates (the viewportRepaint lane),
	 * re-synchronizing the physical screen with the renderer's row bookkeeping
	 * after drift the diff path cannot detect (stale-width writes during a
	 * resize race, terminal reflow moving the cursor, autowrap-inserted rows).
	 * Cannot destroy history: scrollback pixels are never touched.
	 */
	resyncViewport(reason = "resync viewport"): void {
		if (this.#stopped || !this.terminalAvailable) return;
		this.#resyncRequested = true;
		this.requestRender(false, reason);
	}

	/**
	 * 260703 WP1 — resize events whose dimensions DIFFER from the last render
	 * are healed by the width/height-change branches (absolute repaints), so
	 * they only need a normal render request. The dangerous residue is a
	 * flip-back (A→B→A inside one render window, e.g. a drag-resize that
	 * returns to the original size): widthChanged never trips, yet the
	 * terminal reflowed the screen and may have moved the cursor — the diff
	 * path would then paint relative to a fiction. Detect it at event time
	 * (deterministically — no wall-clock timer, which would inject repaints
	 * at nondeterministic points of a streaming byte sequence) and request the
	 * one-shot absolute resync.
	 */
	#handleResize(): void {
		if (
			this.#previousWidth > 0 &&
			this.#previousHeight > 0 &&
			this.terminal.columns === this.#previousWidth &&
			this.terminal.rows === this.#previousHeight
		) {
			this.resyncViewport("resize flip-back");
			return;
		}
		this.requestRender();
	}

	/**
	 * 260702 F3 (v2 — user e2e follow-up 3) — turn-boundary realign as PURE
	 * BOOKKEEPING. While the frame overflows, the visible transcript tail
	 * exists only on screen. Instead of scrolling it out and rebuilding (which
	 * blanked the viewport into a full-screen fill wall every turn), the tail
	 * is re-declared as the commit lane's on-screen committed block (§6-2):
	 *
	 * - No terminal write happens here. The physical screen stays exactly
	 *   as-is: [content K][trailing blanks][cluster at the bottom].
	 * - The K visible content rows become `#committedScreenRows`, and
	 *   `#committedBottomRow = K` anchors the history region at the block's
	 *   bottom row. The NEXT frame's `#expandViewportFill` may declare a
	 *   taller blank prefix (`#lastFillRows = F > K`); the block bottom, not
	 *   the raw fill, stays the scroll-out boundary (v3) — otherwise growth
	 *   scroll-outs march the trailing-blank gap into the scrollback.
	 * - `#previousLines` is rewritten to the equivalent short-frame mirror:
	 *   blanks over the block and the gap (logically-blank rows are never
	 *   repainted, so the physical pixels survive), plus the old cluster lines
	 *   at their real bottom-anchored rows (so the next frame diffs/erases the
	 *   cluster normally).
	 * - As the next turn's content grows past the trailing-blank gap, the
	 *   `#scrollOutCommittedRows` lane feeds the block into the real
	 *   scrollback exactly as fast as the fill drops below the block bottom —
	 *   region `1..#committedBottomRow` is content-only, so never blanks; the
	 *   gap itself is painted over in place and never reaches the scrollback.
	 *
	 * Returns false (pure no-op) unless every precondition holds. The caller
	 * additionally gates on commitLaneEnabled() and a fully-markable backlog.
	 */
	realignOverflowedFrame(liveClusterRows: number): boolean {
		if (this.#stopped || !this.terminalAvailable) return false;
		if (!this.#fillSentinelPresent) return false;
		// The block hand-off relies on scroll-region ops downstream
		// (#scrollOutCommittedRows / commitLines) — refuse on lanes where
		// regions misbehave (zellij) exactly like the commit lane does.
		if (this.#historyLane !== "standard") return false;
		if (this.overlayStack.length > 0) return false;
		const height = this.terminal.rows;
		const width = this.terminal.columns;
		// Overflowing means EITHER a materialized floor beyond the viewport OR
		// a quarantined logical frame (floor reset by a previous realign that
		// immediately re-overflowed via downgraded viewport repaints). The
		// quarantined case must stay realignable or the commit lane would be
		// permanently dead again (B-verify finding 1); rows that never
		// materialized during a quarantine window are the documented
		// history-gap tradeoff.
		if (Math.max(this.#overflowFloor, this.#maxLinesRendered) <= height) return false;
		// A negative/NaN cluster measurement means the caller could not locate
		// the composer cluster — a wrong block boundary would hand composer
		// pixels to the history lane, so refuse.
		if (!Number.isFinite(liveClusterRows) || liveClusterRows < 0) return false;
		const clusterRows = Math.floor(liveClusterRows);
		if (height - clusterRows <= 0) return false;
		const raw = this.#previousRawLines;
		const painted = this.#previousLines;
		// Both mirrors must describe the painted frame for the row surgery to
		// be sound; bail to a no-op otherwise (next submit retries).
		if (painted.length < height || raw.length !== painted.length) return false;
		// Last visible content row above the cluster — the trailing run of
		// tombstone/spacing blanks is left as the in-viewport growth gap and
		// is later painted over by new content (never scrolled to history).
		const visibleTop = Math.max(0, raw.length - height);
		let lastContent = raw.length - clusterRows - 1;
		while (lastContent >= visibleTop && raw[lastContent].trim() === "") lastContent--;
		const blockRows = Math.max(0, lastContent - visibleTop + 1);
		// Rewrite the mirrors as the short-frame equivalent of the CURRENT
		// physical screen: logically blank over block + gap, real cluster
		// lines at the bottom. The painted mirror must use the PREPARED blank
		// representation (prepare appends an SGR terminator to every line) or
		// the next diff sees blank≠blank and 2K-erases the block pixels.
		const preparedBlank = this.#prepareLinesForTerminal([""], width).lines[0];
		const mirror = new Array<string>(height).fill(preparedBlank);
		const rawMirror = new Array<string>(height).fill("");
		for (let i = 0; i < clusterRows; i++) {
			const src = painted.length - clusterRows + i;
			if (src >= 0) {
				mirror[height - clusterRows + i] = painted[src];
				rawMirror[height - clusterRows + i] = raw[src];
			}
		}
		this.#previousLines = mirror;
		this.#previousRawLines = rawMirror;
		this.#previousWidth = width;
		this.#previousHeight = height;
		// The on-screen block (and everything already scrolled above it) is
		// canonical history now — 3J must never wipe it.
		this.#hasCommittedHistory = true;
		this.#committedScreenRows = blockRows;
		this.#committedBottomRow = blockRows;
		this.#lastFillRows = blockRows;
		this.#overflowFloor = 0;
		this.#lastTombstoneRows = 0;
		this.#maxLinesRendered = height;
		this.#viewportTopRow = 0;
		this.#hardwareCursorRow = Math.max(0, Math.min(height - 1, this.#hardwareCursorRow - visibleTop));
		this.#cursorRow = height - 1;
		this.requestRender(false, "realign overflowed frame");
		return true;
	}

	/**
	 * Scroll the history region (screen rows 1..regionBottom, 1-based) up by
	 * `count` rows: its top rows enter the scrollback and `count` blank rows
	 * open at the region bottom (devlog 083.9 §3b-3). The live zone below the
	 * region is untouched.
	 */
	#scrollOutCommittedRows(count: number, regionBottom: number): void {
		if (count <= 0 || regionBottom < 1) return;
		const height = this.terminal.rows;
		// DECSTBM requires bottom > top — terminals silently IGNORE a 1-row
		// region (`CSI 1;1r`), so the \r\n would just move the cursor and the
		// last committed row would never reach the scrollback (v3 repro: the
		// final parked-block row was overwritten by the next diff). Widen to
		// [1..2]: row 1 exits into scrollback, live row 2 shifts up, and the
		// mirrors are rotated the same way so the following diff still maps
		// every physical row correctly.
		const widened = regionBottom === 1;
		if (widened) count = 1;
		const bottom = widened ? 2 : regionBottom;
		let buffer = "\x1b[?2026h";
		buffer += `\x1b[1;${bottom}r`;
		buffer += `\x1b[${bottom};1H`;
		buffer += "\r\n".repeat(count);
		buffer += "\x1b[r";
		const screenCursorRow = Math.max(0, Math.min(height - 1, this.#hardwareCursorRow - this.#viewportTopRow));
		buffer += `\x1b[${screenCursorRow + 1};1H`;
		buffer += "\x1b[?2026l";
		if (!this.#writeTerminal(buffer)) return;
		if (widened) {
			// Mirror the physical shift of the widened region in the PAINTED
			// mirror (the one the same-pass diff maps rows against): screen row 2
			// moved up to row 1, row 2 opened blank. #previousRawLines is left
			// alone — at the growth call site it already holds the CURRENT
			// frame's raw lines (overwritten before the scroll-out runs), and the
			// flush call sites replace both mirrors wholesale right after.
			// Skipped when no mirror exists (a forced render repaints every row).
			const vt = Math.max(0, this.#previousLines.length - height);
			if (this.#previousLines.length > vt + 1) {
				const width = this.terminal.columns;
				this.#previousLines[vt] = this.#previousLines[vt + 1];
				this.#previousLines[vt + 1] = this.#prepareLinesForTerminal([""], width).lines[0];
			}
		}
	}

	/**
	 * Commit finalized lines into the terminal scrollback above the live zone
	 * (devlog 083.9 P2). The lines never enter the diff-rendered frame — they
	 * become immutable pixels. Returns false when the commit lane is
	 * unavailable (no fill region, overlay open, unsupported terminal); the
	 * caller falls back to virtual-lane behavior (chatContainer append).
	 */
	/**
	 * 260703 WP3b-min — mark the boundaries of a high-churn output phase.
	 * While active, the history lane defers new commits whenever the user may
	 * be scrolled off-bottom (see #canUseHistoryLaneNow). Callers should
	 * flushHistoryLane() at both boundaries: before streaming so the phase
	 * never starts with parked rows (which would force mandatory mid-stream
	 * drains), and after it so deferred content reaches the scrollback in one
	 * discrete write.
	 */
	setStreamingActive(active: boolean): void {
		this.#streamingActive = active;
	}

	/**
	 * 260703 WP3b-min — the gating policy (GPT Pro round-5 spec): an overlay
	 * always blocks; outside a streaming phase the lane is free; while
	 * streaming, a known off-bottom viewport blocks, and an UNKNOWN viewport
	 * blocks only in multiplexers (tmux/screen pane history is where DECSTBM
	 * churn visibly fights user scrolling — direct terminals allow in v1;
	 * JWC_TUI_DEFER_UNKNOWN_BOTTOM=1 opts into the conservative policy).
	 */
	#canUseHistoryLaneNow(): boolean {
		if (this.overlayStack.length > 0) return false;
		if (!this.#streamingActive) return true;
		const bottom = this.terminal.isViewportAtBottom?.();
		if (bottom === false) return false;
		if (bottom === undefined && (isMultiplexerSession() || $flag("JWC_TUI_DEFER_UNKNOWN_BOTTOM"))) return false;
		return true;
	}

	/**
	 * 260703 WP3b-min — push any committed rows still parked on screen into
	 * the terminal scrollback in one discrete write, then resync. Called at
	 * streaming boundaries so per-growth-frame drains (which mutate the top
	 * region while the user may be reading history) become rare. Safe by the
	 * mirror-blank contract: the flushed region is logically blank in the
	 * mirrors, and the resync repaints the frame absolutely.
	 */
	flushHistoryLane(): void {
		if (this.#stopped || !this.terminalAvailable) return;
		if (this.#historyLane !== "standard") return;
		if (this.overlayStack.length > 0) return;
		if (this.#committedScreenRows <= 0) return;
		const flushBottom = this.#committedBottomRow > 0 ? this.#committedBottomRow : this.#lastFillRows;
		if (flushBottom <= 0) return;
		this.#scrollOutCommittedRows(flushBottom, flushBottom);
		this.#committedScreenRows = 0;
		this.#committedBottomRow = 0;
		this.resyncViewport("history lane flush");
	}

	commitLines(lines: string[]): boolean {
		if (this.#historyLane !== "standard" || this.#stopped || !this.terminalAvailable) return false;
		if (this.overlayStack.length > 0) return false;
		// 260703 WP2.5: while the ambiguous-width CPR probe is outstanding the
		// width tables may still change — committed pixels are immutable, so
		// defer to the virtual lane until the mode is resolved (~150ms max).
		if (!this.#ambiguousWidthResolved) return false;
		// 260703 WP3b-min: while streaming with the user possibly off-bottom,
		// creating NEW parked rows would guarantee scroll-fighting drains —
		// defer to the virtual lane (the turn-boundary sweep retries).
		if (!this.#canUseHistoryLaneNow()) return false;
		// 260703 v3: while a realign-parked block sits at rows 1..bottom, new
		// commits must insert DIRECTLY below it — inserting at the (taller) raw
		// fill bottom would fragment the committed region around the
		// trailing-blank gap and later scroll blanks into the scrollback.
		const liveZoneTop = this.#committedBottomRow > 0 ? this.#committedBottomRow : this.#lastFillRows;
		// <= 1 (not 0): DECSTBM ignores a 1-row region, so the insert sequence
		// would paint the "committed" line INTO the live zone at row 2 instead
		// of scrolling row 1 out. Fall back to the virtual lane.
		if (liveZoneTop <= 1 || lines.length === 0) return false;
		const width = this.terminal.columns;
		const height = this.terminal.rows;
		const { lines: prepared, stats } = this.#prepareLinesForTerminal([...lines], width);
		this.#recordPreparedLineStats(stats, "commit");
		const screenCursorRow = Math.max(0, Math.min(height - 1, this.#hardwareCursorRow - this.#viewportTopRow));
		const seq = buildInsertHistorySequence(prepared, {
			liveZoneTop,
			liveZoneBottom: height,
			screenRows: height,
			cursor: { row: screenCursorRow, col: 0 },
		});
		if (!seq) return false;
		if (!this.#writeTerminal(`\x1b[?2026h${seq}\x1b[?2026l`)) return false;
		this.#committedScreenRows = Math.min(this.#committedScreenRows + prepared.length, liveZoneTop);
		this.#hasCommittedHistory = true;
		return true;
	}

	/** Fill rows at the frame top as last painted (083.9 P3: 0 = live zone overflowing). */
	get viewportFillRows(): number {
		return this.#lastFillRows;
	}

	compactViewportFill(): void {
		// 260630: the post-overflow top gap no longer exists — shrink residue is
		// kept as in-place tombstone rows (#restoreOverflowFloor) that later
		// growth consumes, because inserting the gap at the frame top shifted
		// every row below over pixels already in the scrollback and duplicated
		// the viewport-top rows. The forced render remains as the compact pass:
		// while 3J is still allowed it rebuilds the buffer without tombstones,
		// and fullRender downgrades it to a viewport repaint whenever a
		// clearing replay could duplicate the scrollback.
		if (this.#lastTombstoneRows === 0) return;
		this.requestRender(true, "viewportFill compact");
	}

	/**
	 * Replace the first ViewportFill sentinel with enough blank lines to pad
	 * the frame to the viewport height, pinning everything after it to the
	 * terminal bottom (devlog 083.7). Extra sentinels are dropped (misuse
	 * guard); when no sentinel is present the input is returned as-is.
	 */
	#expandViewportFill(lines: string[], height: number): string[] {
		const first = lines.indexOf(VIEWPORT_FILL_SENTINEL);
		this.#fillSentinelPresent = first !== -1;
		if (first === -1) {
			this.#lastFillRows = 0;
			return lines;
		}
		const expandStart = renderMetrics.now();
		const result: string[] = [];
		for (const line of lines) {
			if (line !== VIEWPORT_FILL_SENTINEL) result.push(line);
		}
		// While content overflows the viewport, no top fill is emitted (260630).
		// The old policy grew a sticky top gap on shrink to preserve the frame
		// length; that shifted every content row DOWN over pixels already in
		// the terminal scrollback, so the viewport repaint duplicated the last
		// scrolled-out rows at the viewport top (scroll-seam-duplication repro).
		// Post-overflow shrinks are now absorbed by #restoreOverflowFloor with
		// in-place tombstone rows at the first changed row instead.
		const overflowed = result.length > height;
		const fill = overflowed ? 0 : Math.max(0, height - result.length);
		if (fill > 0) {
			const blanks = new Array<string>(fill).fill("");
			result.splice(first, 0, ...blanks);
		}
		// 083.9 P2: the fill region doubles as the history region — record its
		// painted height so commitLines/growth scroll-out know the region bottom.
		// While overflowed the fill rows would sit ABOVE the viewport, not at the
		// screen top, so the commit lane must stay disabled (fill = 0).
		this.#lastFillRows = first === 0 ? fill : 0;
		if (renderMetrics.enabled) renderMetrics.recordHelper("viewportFill", renderMetrics.now() - expandStart);
		return result;
	}

	/**
	 * Enforce the overflow frame-length floor (260630 seam fix). While the
	 * frame overflows the viewport, its head rows physically live in the
	 * terminal scrollback and cannot be reclaimed; a net shrink therefore must
	 * not move any surviving row. The removed rows are replaced by tombstones
	 * at the first changed row: rows above the old viewport top keep their
	 * previously painted bytes (frozen pixels), visible rows become blank.
	 * The prefix keeps its absolute indices, the suffix realigns to its
	 * previous rows, and subsequent growth consumes the tombstones in place
	 * before the frame extends again.
	 */
	#restoreOverflowFloor(lines: string[], width: number, height: number): string[] {
		// The floor invariant belongs to the composer-pin model. Legacy frames
		// (no ViewportFill sentinel) keep their original shrink behavior
		// byte-identically (clearOnShrink full rebuild).
		if (!this.#fillSentinelPresent) {
			this.#overflowFloor = 0;
			this.#lastTombstoneRows = 0;
			return lines;
		}
		const realResize =
			(this.#previousWidth > 0 && this.#previousWidth !== width) ||
			(this.#previousHeight > 0 && this.#previousHeight !== height);
		// A forced rebuild (requestRender(true) marks dimensions -1) that is
		// still allowed to clear the scrollback (3J) realigns screen and frame
		// from scratch — the compact path. Once the scrollback is canonical
		// (committed history) or user-navigated (multiplexer) the rebuild is
		// downgraded to a viewport repaint, so the floor must survive.
		const forcedRebuild = this.#previousWidth === -1;
		const canClearScrollback = !isMultiplexerSession() && !this.#hasCommittedHistory;
		if (realResize || (forcedRebuild && canClearScrollback)) {
			// Re-wrap / full clear invalidates row identity; the clearing full
			// render that follows realigns screen and frame, so the floor restarts.
			this.#overflowFloor = 0;
			this.#previousRawLines = [];
			this.#lastTombstoneRows = 0;
		} else if (this.#overflowFloor > height && lines.length < this.#overflowFloor) {
			const prev = this.#previousRawLines;
			const missing = this.#overflowFloor - lines.length;
			let firstChanged = 0;
			const scanEnd = Math.min(lines.length, prev.length);
			while (firstChanged < scanEnd && lines[firstChanged] === prev[firstChanged]) firstChanged++;
			// 260702: freeze only rows PHYSICALLY in the scrollback. The logical
			// #viewportTopRow can exceed the physical seam after repaint-only
			// growth (quarantine state); frozen pixels below the real seam would
			// resurface stale transcript rows inside the visible viewport.
			const physicalSeam = Math.max(0, this.#overflowFloor - height);
			const freezeEnd = Math.min(physicalSeam, prev.length);
			const tombstones = new Array<string>(missing);
			for (let i = 0; i < missing; i++) {
				const row = firstChanged + i;
				tombstones[i] = row < freezeEnd ? prev[row] : "";
			}
			lines.splice(firstChanged, 0, ...tombstones);
			this.#lastTombstoneRows = missing;
			// Fixed-C recurrence guard (260702): raw content that fits again can
			// have re-inserted top fill (#expandViewportFill ran first), but the
			// padded frame still overflows the viewport — that fill is NOT a
			// screen-top history region, so the commit lane must stay on its
			// fallback until the floor is genuinely reset.
			this.#lastFillRows = 0;
		} else {
			this.#lastTombstoneRows = 0;
		}
		// The floor is NOT raised here: it tracks the physically materialized
		// frame length, so it only advances in paths that actually scroll or
		// fully print the frame (diff append, append-growth, real fullRender).
		// Growth painted via viewportRepaint (unknown viewport, frozen floor)
		// leaves the floor behind on purpose — those rows never entered the
		// scrollback, so a later shrink may repaint over them freely.
		return lines;
	}

	/** Raise the physical floor after a path that scrolled/printed the frame. */
	#raiseOverflowFloor(frameLength: number, height: number): void {
		if (frameLength > height) {
			this.#overflowFloor = Math.max(this.#overflowFloor, frameLength);
			this.#hasMaterializedOverflow = true;
		}
	}

	#doRender(): void {
		if (this.#stopped || !this.terminalAvailable) return;
		// 260703 WP1: consume the one-shot resync request up front — whichever
		// branch renders this pass satisfies it (every non-diff branch is
		// already an absolute repaint).
		const resyncRequested = this.#resyncRequested;
		this.#resyncRequested = false;
		const width = this.terminal.columns;
		const height = this.terminal.rows;
		const widthChanged = this.#previousWidth !== 0 && this.#previousWidth !== width;
		const heightChanged = this.#previousHeight !== 0 && this.#previousHeight !== height;
		if (widthChanged) this.#clearPreparedLineCaches();
		let viewportTop = Math.max(0, this.#maxLinesRendered - height);
		let prevViewportTop = this.#viewportTopRow;
		let hardwareCursorRow = this.#hardwareCursorRow;
		const computeLineDiff = (targetRow: number): number => {
			const currentScreenRow = hardwareCursorRow - prevViewportTop;
			const targetScreenRow = targetRow - viewportTop;
			return targetScreenRow - currentScreenRow;
		};

		// Render all components to get new lines
		const renderTreeStart = renderMetrics.now();
		let newLines = this.render(width);
		if (renderMetrics.enabled) renderMetrics.recordHelper("renderTree", renderMetrics.now() - renderTreeStart);

		// Expand the viewport-fill sentinel (devlog 083.7) to the viewport
		// remainder. Must run before overlay compositing (overlays position
		// against the final frame) and before cursor extraction (absolute rows
		// must be final). No sentinel present → input returned untouched, so the
		// legacy path stays byte-identical.
		const prevFillRows = this.#lastFillRows;
		newLines = this.#expandViewportFill(newLines, height);

		// 260703 v3 overlay guard: overlays composite into arbitrary top rows and
		// the diff then repaints them, destroying parked committed pixels that
		// never reached the scrollback. Flush the block first — region
		// `1..flushBottom` is content-only while parked. Must run HERE, before
		// #restoreOverflowFloor overwrites #previousRawLines, while both mirrors
		// still declare the block rows logically blank (no rewrite needed).
		// Parked blocks only (#committedBottomRow > 0): the ordinary commit-lane
		// state keeps its pre-v3 bytes (B-verify byte-compat finding).
		// 260703 WP3a: a scroll-region mutation mid-pass invalidates the relative
		// lanes' cursor/mirror assumptions (clamp mismatch + unrotated mirrors —
		// devlog 30_wp3a). Track it and finish such passes with an absolute
		// repaint instead of the relative diff.
		let scrolledOutThisPass = false;
		if (this.overlayStack.length > 0 && this.#committedBottomRow > 0) {
			const flushBottom = this.#committedBottomRow;
			this.#scrollOutCommittedRows(flushBottom, flushBottom);
			this.#committedScreenRows = 0;
			this.#committedBottomRow = 0;
			scrolledOutThisPass = true;
		}

		// 260630 seam fix: while overflowed, absorb net shrinks with in-place
		// tombstones so no row shifts over pixels already in the scrollback.
		// Must run before overlay compositing (overlays anchor on the final
		// frame) and the raw copy must be taken before cursor extraction and
		// line preparation mutate the array. Updating the raw snapshot before
		// the terminal write is safe because a failed write marks the terminal
		// unavailable and stops rendering permanently — a stale snapshot can
		// never be consumed by a later frame (codex audit 260630 발견 1).
		newLines = this.#restoreOverflowFloor(newLines, width, height);
		this.#previousRawLines = [...newLines];

		// Composite overlays into the rendered lines (before differential compare)
		if (this.overlayStack.length > 0) {
			newLines = this.#compositeOverlays(newLines, width, height);
		}

		// Extract cursor position (marker must be found before diff comparison)
		const cursorPos = this.#extractCursorPosition(newLines, height);

		// Terminate every non-image line so #previousLines mirrors emitted bytes
		// (closes SGR + OSC 8 hyperlink state). Must run after cursor extraction
		// because the marker is embedded mid-line, and before any diff/full render
		// path so cache comparisons stay byte-accurate.
		const preparedFrame = this.#prepareLinesForTerminal(newLines, width);
		newLines = preparedFrame.lines;
		if (renderMetrics.enabled) {
			renderMetrics.recordCounter("tui.frame", "frame.count", 1);
			renderMetrics.recordCounter("tui.frame", "frame.lines", newLines.length);
			renderMetrics.recordEvent("tui.frame", { "frame.emittedLines": 0 }, { placeholder: "true" });
			this.#recordPreparedLineStats(preparedFrame.stats, "render");
			renderMetrics.recordEvent("tui.text", { "wrap.calls": 0, "visibleWidth.calls": 0 }, { placeholder: "true" });
		}

		// 083.9 §3b-3: live-zone growth shrinks the fill region. The committed
		// pixel block ends at the history-region bottom (parked: its own bottom
		// row; otherwise the old fill bottom) — scroll the region up so the
		// block lands exactly at the new fill bottom, BEFORE the diff paints
		// content over its old rows. Parked blocks (260703 v3) do NOT move
		// while the fill is still taller than the block: the growth is absorbed
		// by painting the trailing-blank gap bottom-up, and only region
		// `1..#committedBottomRow` (content-only) ever scrolls — the gap blanks
		// below the block can never enter the scrollback.
		const historyBottom = this.#committedBottomRow > 0 ? this.#committedBottomRow : prevFillRows;
		if (this.#committedScreenRows > 0 && this.#lastFillRows < historyBottom) {
			// 260703 WP3b-min: this drain is MANDATORY even while the history
			// lane is gated — the live zone is about to paint over the parked
			// rows, and skipping the scroll-out would erase committed pixels
			// (the class WP3a fixed). Gating prevents NEW parked rows instead;
			// record when the corner still fires so the policy is observable.
			if (renderMetrics.enabled && !this.#canUseHistoryLaneNow()) {
				renderMetrics.recordCounter("tui.historyLane", "mandatoryDrainWhileBlocked", 1);
			}
			this.#scrollOutCommittedRows(historyBottom - this.#lastFillRows, historyBottom);
			this.#committedScreenRows = Math.min(this.#committedScreenRows, this.#lastFillRows);
			this.#committedBottomRow =
				this.#committedBottomRow > 0 && this.#committedScreenRows > 0 ? this.#lastFillRows : 0;
			scrolledOutThisPass = true;
		}

		// Width/height changes need full re-render handling below.
		// Helper to clear scrollback and viewport and render all new lines
		const fullRender = (clear: boolean, reason = "full render"): void => {
			// 260630: once 3J is forbidden (committed history is canonical, or a
			// multiplexer owns the scrollback), a clearing replay of an
			// overflowing frame pushes a duplicate copy of every above-viewport
			// row into the scrollback. Repaint the visible viewport instead;
			// above-viewport pixels stay as immutable history.
			// 260703 WP5: a multiplexer downgrades only AFTER something was
			// physically materialized — downgrading the first-ever overflow
			// render silently drops the above-viewport rows from the pane
			// history instead of preventing a duplicate (there is none yet).
			if (
				clear &&
				newLines.length > height &&
				!useLegacyMultiplexerFullRender() &&
				(this.#hasCommittedHistory || (isMultiplexerSession() && this.#hasMaterializedOverflow))
			) {
				viewportRepaint(`${reason} (scrollback-safe downgrade)`);
				return;
			}
			// 083.9 P2: a clearing render would erase committed pixels that have
			// not scrolled into the scrollback yet — push the history region out
			// first (the bottom committed row needs regionBottom scrolls to
			// cross row 1 into the scrollback). 260703 v3: a parked block ends
			// at #committedBottomRow, not the raw fill bottom — flushing
			// prevFillRows would stamp the trailing-blank gap into history.
			if (clear && this.#committedScreenRows > 0) {
				const flushBottom = this.#committedBottomRow > 0 ? this.#committedBottomRow : prevFillRows;
				this.#scrollOutCommittedRows(flushBottom, flushBottom);
				this.#committedScreenRows = 0;
				this.#committedBottomRow = 0;
			}
			this.#fullRedrawCount += 1;
			if (renderMetrics.enabled) renderMetrics.recordFullRedraw(reason);
			let buffer = "\x1b[?2026h"; // Begin synchronized output
			// Skip clearing scrollback (3J) in multiplexers (users navigate it) and
			// once the commit lane has written history — scrollback is then the
			// CANONICAL transcript and must never be erased (083.9 P2).
			if (clear)
				buffer += isMultiplexerSession() || this.#hasCommittedHistory ? "\x1b[2J\x1b[H" : "\x1b[2J\x1b[H\x1b[3J";
			for (let i = 0; i < newLines.length; i++) {
				if (i > 0) buffer += "\r\n";
				// Lines were pre-terminated/normalized by #prepareLinesForTerminal; image
				// lines were left untouched there.
				buffer += newLines[i];
			}
			this.#cursorRow = Math.max(0, newLines.length - 1);
			const { seq, toRow } = this.#cursorControlSequence(cursorPos, newLines.length, this.#cursorRow);
			this.#hardwareCursorRow = toRow;
			buffer += seq;
			buffer += "\x1b[?2026l"; // End synchronized output
			if (!this.#writeTerminal(buffer)) return;
			// Reset max lines when clearing, otherwise track growth
			if (clear) {
				this.#maxLinesRendered = newLines.length;
			} else {
				this.#maxLinesRendered = Math.max(this.#maxLinesRendered, newLines.length);
			}
			// A full render realigns physical screen and frame — the overflow
			// floor restarts from this frame's length (260630).
			this.#overflowFloor = newLines.length > height ? newLines.length : 0;
			if (newLines.length > height) this.#hasMaterializedOverflow = true;
			this.#viewportTopRow = Math.max(0, this.#maxLinesRendered - height);
			this.#previousLines = newLines;
			this.#previousWidth = width;
			this.#previousHeight = height;
		};

		// Viewport-only repaint without 2J/3J: replays the visible rows in place and
		// leaves scrollback pixels untouched. Originally multiplexer-only; now the
		// default for every above-viewport change (devlog 083.8 S3).
		const viewportRepaint = (reason: string): void => {
			// 260703 v3: the absolute repaint 2K-erases every screen row — parked
			// committed pixels (logically blank in the frame) would be silently
			// destroyed while the bookkeeping still claims them, and later
			// scroll-outs would push the now-blank rows into the scrollback as if
			// they were content. Flush the block into the real scrollback first;
			// region `1..flushBottom` is content-only while parked. Parked blocks
			// only (#committedBottomRow > 0): the ordinary commit-lane state keeps
			// its pre-v3 bytes (B-verify byte-compat finding).
			if (this.#committedBottomRow > 0) {
				const flushBottom = this.#committedBottomRow;
				this.#scrollOutCommittedRows(flushBottom, flushBottom);
				this.#committedScreenRows = 0;
				this.#committedBottomRow = 0;
			}
			this.#fullRedrawCount += 1;
			if (renderMetrics.enabled) renderMetrics.recordFullRedraw(reason);
			const nextViewportTop = Math.max(0, newLines.length - height);
			let buffer = "\x1b[?2026h\x1b[H";
			for (let screenRow = 0; screenRow < height; screenRow++) {
				if (screenRow > 0) buffer += "\r\n";
				buffer += "\x1b[2K";
				const lineIndex = nextViewportTop + screenRow;
				if (lineIndex >= newLines.length) continue;
				buffer += this.#truncatePreparedLineToWidth(newLines[lineIndex], width);
			}

			const finalPhysicalRow = nextViewportTop + Math.max(0, height - 1);
			let cursorSeq = "\x1b[?25l";
			let cursorToRow = finalPhysicalRow;
			if (cursorPos && cursorPos.row >= nextViewportTop && cursorPos.row < nextViewportTop + height) {
				const cursor = this.#cursorControlSequence(cursorPos, newLines.length, finalPhysicalRow);
				cursorSeq = cursor.seq;
				cursorToRow = cursor.toRow;
			}
			this.#hardwareCursorRow = cursorToRow;
			buffer += cursorSeq;
			buffer += "\x1b[?2026l";
			if (!this.#writeTerminal(buffer)) return;

			if ($flag("PI_DEBUG_REDRAW")) {
				const logPath = getDebugLogPath();
				const msg = `[${new Date().toISOString()}] viewportRepaint: ${reason} (prev=${this.#previousLines.length}, new=${newLines.length}, height=${height}, viewportTop=${nextViewportTop})\n`;
				fs.appendFileSync(logPath, msg);
			}
			// Deliberately prioritizes the live viewport over historical scrollback
			// repair. After offscreen changes, #previousLines tracks the desired
			// logical transcript, not every byte emitted into the scrollback.
			this.#cursorRow = Math.max(0, newLines.length - 1);
			this.#maxLinesRendered = newLines.length;
			this.#viewportTopRow = nextViewportTop;
			this.#previousLines = newLines;
			this.#previousWidth = width;
			this.#previousHeight = height;
		};

		// 260703 WP3a: absolute repaint of the LIVE ZONE ONLY (screen rows below
		// the fill region). Used by the scroll-out barrier while committed
		// pixels are still parked in the fill region: those rows are
		// mirror-blank by contract (never repainted by diffs), so a full
		// viewportRepaint's per-row 2K would erase them. Bookkeeping updates
		// mirror viewportRepaint's wholesale rewrite — fill rows in newLines
		// are prepared blanks, matching the untouched physical rows above.
		const liveZoneRepaint = (reason: string): void => {
			this.#fullRedrawCount += 1;
			if (renderMetrics.enabled) renderMetrics.recordFullRedraw(reason);
			const nextViewportTop = Math.max(0, newLines.length - height);
			const startRow = Math.max(0, this.#lastFillRows);
			let buffer = "\x1b[?2026h";
			if (startRow < height) {
				// A fill region spanning the whole screen has no live-zone rows —
				// clearing anything would erase parked pixels; bookkeeping still
				// updates below (GPT Pro round-4 guard).
				buffer += `\x1b[${startRow + 1};1H`;
				for (let screenRow = startRow; screenRow < height; screenRow++) {
					if (screenRow > startRow) buffer += "\r\n";
					buffer += "\x1b[2K";
					const lineIndex = nextViewportTop + screenRow;
					if (lineIndex >= newLines.length) continue;
					buffer += this.#truncatePreparedLineToWidth(newLines[lineIndex], width);
				}
			}
			const finalPhysicalRow = nextViewportTop + Math.max(0, height - 1);
			let cursorSeq = "\x1b[?25l";
			let cursorToRow = finalPhysicalRow;
			if (cursorPos && cursorPos.row >= nextViewportTop + startRow && cursorPos.row < nextViewportTop + height) {
				const cursor = this.#cursorControlSequence(cursorPos, newLines.length, finalPhysicalRow);
				cursorSeq = cursor.seq;
				cursorToRow = cursor.toRow;
			}
			this.#hardwareCursorRow = cursorToRow;
			buffer += cursorSeq;
			buffer += "\x1b[?2026l";
			if (!this.#writeTerminal(buffer)) return;
			this.#cursorRow = Math.max(0, newLines.length - 1);
			this.#maxLinesRendered = newLines.length;
			this.#viewportTopRow = nextViewportTop;
			this.#previousLines = newLines;
			this.#previousWidth = width;
			this.#previousHeight = height;
		};

		const appendGrowthAndRepaintViewport = (reason: string): void => {
			this.#fullRedrawCount += 1;
			if (renderMetrics.enabled) renderMetrics.recordFullRedraw(reason);
			const appended = newLines.slice(this.#previousLines.length);
			const nextViewportTop = Math.max(0, newLines.length - height);
			let buffer = "\x1b[?2026h";

			if (appended.length > 0) {
				buffer += `\x1b[${height};1H`;
				for (const line of appended) {
					buffer += "\r\n\x1b[2K";
					buffer += line;
				}
			}

			buffer += "\x1b[H";
			for (let screenRow = 0; screenRow < height; screenRow++) {
				if (screenRow > 0) buffer += "\r\n";
				buffer += "\x1b[2K";
				const lineIndex = nextViewportTop + screenRow;
				if (lineIndex >= newLines.length) continue;
				buffer += this.#truncatePreparedLineToWidth(newLines[lineIndex], width);
			}

			const finalPhysicalRow = nextViewportTop + Math.max(0, height - 1);
			let cursorSeq = "\x1b[?25l";
			let cursorToRow = finalPhysicalRow;
			if (cursorPos && cursorPos.row >= nextViewportTop && cursorPos.row < nextViewportTop + height) {
				const cursor = this.#cursorControlSequence(cursorPos, newLines.length, finalPhysicalRow);
				cursorSeq = cursor.seq;
				cursorToRow = cursor.toRow;
			}
			this.#hardwareCursorRow = cursorToRow;
			buffer += cursorSeq;
			buffer += "\x1b[?2026l";

			if (!this.#writeTerminal(buffer)) return;

			if ($flag("PI_DEBUG_REDRAW")) {
				const logPath = getDebugLogPath();
				const msg = `[${new Date().toISOString()}] appendGrowthAndRepaintViewport: ${reason} (prev=${this.#previousLines.length}, new=${newLines.length}, height=${height}, viewportTop=${nextViewportTop})\n`;
				fs.appendFileSync(logPath, msg);
			}

			this.#cursorRow = Math.max(0, newLines.length - 1);
			this.#maxLinesRendered = newLines.length;
			this.#viewportTopRow = nextViewportTop;
			this.#previousLines = newLines;
			this.#previousWidth = width;
			this.#previousHeight = height;
			this.#raiseOverflowFloor(newLines.length, height);
		};

		const debugRedraw = $flag("PI_DEBUG_REDRAW");
		const logRedraw = (reason: string): void => {
			if (!debugRedraw) return;
			const logPath = getDebugLogPath();
			const msg = `[${new Date().toISOString()}] fullRender: ${reason} (prev=${this.#previousLines.length}, new=${newLines.length}, height=${height})\n`;
			fs.appendFileSync(logPath, msg);
		};

		// First render - just output everything without clearing (assumes clean screen)
		if (this.#previousLines.length === 0 && !widthChanged && !heightChanged) {
			logRedraw("first render");
			fullRender(false, "first render");
			return;
		}

		// Width changes always need a full re-render because wrapping changes.
		if (widthChanged) {
			logRedraw(`terminal width changed (${this.#previousWidth} -> ${width})`);
			fullRender(true, "terminal width changed");
			return;
		}

		// Height changes normally need a full re-render to keep the visible viewport aligned,
		// but Termux changes height when the software keyboard shows or hides.
		// In that environment, a full redraw causes the entire history to replay on every toggle.
		if (heightChanged) {
			if (isMultiplexerSession() && !useLegacyMultiplexerFullRender()) {
				viewportRepaint(`terminal height changed (${this.#previousHeight} -> ${height})`);
				return;
			}
			if (!isTermuxSession() && !isMultiplexerSession()) {
				logRedraw(`terminal height changed (${this.#previousHeight} -> ${height})`);
				fullRender(true, "terminal height changed");
				return;
			}
		}

		// 260702 misaligned-viewport quarantine: #maxLinesRendered beyond
		// Math.max(#overflowFloor, height) means rows were painted via viewport
		// repaint only and never physically materialized — the logical frame is
		// longer than the terminal's real scroll history. Any relative diff
		// would map frame rows onto wrong physical rows (confirmed drift: the
		// frame tail painted at the viewport top, composer mid-screen, stale
		// bands — scroll-misalignment.test.ts). Every render stays on the
		// absolute viewport repaint until a frame realigns: a shrink back to
		// the floor (tombstone-padded to exactly #overflowFloor) or a fitting
		// frame lets viewportRepaint record #maxLinesRendered = length again.
		// Evaluated on the POST-overlay frame (overlays can extend the frame);
		// resize branches above keep their own reset semantics. Legacy frames
		// (no ViewportFill sentinel) never enter this state.
		if (this.#fillSentinelPresent && this.#maxLinesRendered > Math.max(this.#overflowFloor, height)) {
			viewportRepaint(
				`misaligned viewport quarantine (max=${this.#maxLinesRendered} > floor=${this.#overflowFloor})`,
			);
			return;
		}

		// 260703 WP1 — explicit resync (resize settle, external callers): replay
		// the visible viewport at absolute coordinates. Guard: a legacy
		// no-sentinel frame shorter than the viewport may not be anchored at
		// screen row 1 (the first render prints at the shell cursor without
		// clearing), so an ESC[H repaint would stamp frame rows over shell
		// history — downgrade that case to the normal diff. Pin-model frames
		// are always ≥ height after fill expansion.
		if (resyncRequested && (this.#fillSentinelPresent || newLines.length >= height)) {
			viewportRepaint("explicit resync");
			return;
		}

		// Content shrunk below the previous render and no overlays - re-render to clear empty rows
		// (overlays need the padding, so only do this when no overlays are active)
		// Configurable via setClearOnShrink() or PI_CLEAR_ON_SHRINK=0 env var
		if (this.#clearOnShrink && newLines.length < this.#previousLines.length && this.overlayStack.length === 0) {
			logRedraw(`clearOnShrink (prev=${this.#previousLines.length}, new=${newLines.length})`);
			fullRender(true, "clearOnShrink");
			return;
		}

		// Find first and last changed lines
		let firstChanged = -1;
		let lastChanged = -1;
		const maxLines = Math.max(newLines.length, this.#previousLines.length);
		for (let i = 0; i < maxLines; i++) {
			const oldLine = i < this.#previousLines.length ? this.#previousLines[i] : "";
			const newLine = i < newLines.length ? newLines[i] : "";

			if (oldLine !== newLine) {
				if (firstChanged === -1) {
					firstChanged = i;
				}
				lastChanged = i;
			}
		}
		const appendedLines = newLines.length > this.#previousLines.length;
		if (appendedLines) {
			if (firstChanged === -1) {
				firstChanged = this.#previousLines.length;
			}
			lastChanged = newLines.length - 1;
		}
		const appendStart = appendedLines && firstChanged === this.#previousLines.length && firstChanged > 0;

		// 260703 WP3a scroll-out repaint barrier: the DECSTBM mutation above
		// shifted physical rows and restored the cursor to a CLAMPED screen row,
		// while the relative lanes below still compute moves from the UNCLAMPED
		// captured locals against unrotated mirrors. Those lanes survived on the
		// blank-region coincidence only (devlog 30_wp3a) — finish the pass with
		// an ABSOLUTE repaint instead. While committed pixels still sit in the
		// fill region (mirror-blank rows the frame must never erase), repaint
		// only the live zone below them; a full viewportRepaint would 2K those
		// rows away (B-phase finding). With an overlay open the fill rows can
		// carry composited overlay content, so flush the committed rows into
		// the scrollback first and take the full repaint.
		if (scrolledOutThisPass) {
			if (this.#committedScreenRows > 0 && this.overlayStack.length > 0 && this.#lastFillRows > 1) {
				// Committed rows sit at the BOTTOM of the 1..flushBottom region —
				// the bottom row needs flushBottom scrolls to cross row 1 into the
				// scrollback (same rule as fullRender's flush; scrolling by only
				// #committedScreenRows would leave the tail rows on screen for the
				// full repaint to erase — GPT Pro round-4 finding).
				const flushBottom = this.#committedBottomRow > 0 ? this.#committedBottomRow : this.#lastFillRows;
				this.#scrollOutCommittedRows(flushBottom, flushBottom);
				this.#committedScreenRows = 0;
				this.#committedBottomRow = 0;
			}
			if (this.#committedScreenRows > 0) {
				liveZoneRepaint("scroll-out repaint barrier");
			} else {
				viewportRepaint("scroll-out repaint barrier");
			}
			return;
		}

		// No changes - but still need to update hardware cursor position if it moved
		if (firstChanged === -1) {
			this.#writeCursorPosition(cursorPos, newLines.length);
			this.#viewportTopRow = Math.max(0, this.#maxLinesRendered - height);
			return;
		}

		// All changes are in deleted lines (nothing to render, just clear)
		if (firstChanged >= newLines.length) {
			if (this.#previousLines.length > newLines.length) {
				let buffer = "\x1b[?2026h";
				// Move to end of new content (clamp to 0 for empty content)
				const targetRow = Math.max(0, newLines.length - 1);
				const lineDiff = computeLineDiff(targetRow);
				if (lineDiff > 0) buffer += `\x1b[${lineDiff}B`;
				else if (lineDiff < 0) buffer += `\x1b[${-lineDiff}A`;
				buffer += "\r";
				// Clear extra lines without scrolling
				const extraLines = this.#previousLines.length - newLines.length;
				if (extraLines > height) {
					logRedraw(`extraLines > height (${extraLines} > ${height})`);
					if (useLegacyMultiplexerFullRender()) {
						fullRender(true, "extraLines > height");
					} else {
						viewportRepaint(`extraLines > height (${extraLines} > ${height})`);
					}
					return;
				}
				const clearStartOffset = newLines.length > 0 && extraLines > 0 ? 1 : 0;
				if (clearStartOffset > 0) {
					buffer += `\x1b[${clearStartOffset}B`;
				}
				for (let i = 0; i < extraLines; i++) {
					buffer += "\r\x1b[2K";
					if (i < extraLines - 1) buffer += "\x1b[1B";
				}
				const moveUp = extraLines - 1 + clearStartOffset;
				if (moveUp > 0) {
					buffer += `\x1b[${moveUp}A`;
				}
				this.#cursorRow = targetRow;
				const { seq, toRow } = this.#cursorControlSequence(cursorPos, newLines.length, targetRow);
				this.#hardwareCursorRow = toRow;
				buffer += seq;
				buffer += "\x1b[?2026l";
				if (!this.#writeTerminal(buffer)) return;
			}
			this.#previousLines = newLines;
			this.#previousWidth = width;
			this.#previousHeight = height;
			this.#maxLinesRendered = newLines.length;
			this.#viewportTopRow = Math.max(0, newLines.length - height);
			return;
		}

		// Differential rendering can only touch what was actually visible.
		// A change above the previous viewport used to force fullRender(true) —
		// 2J+3J wipes the terminal scrollback and repaints, which reads as the
		// screen being "sucked upward" right when a trailing thinking block
		// collapses at message_end (devlog 083.8 ④). Codex-parity policy instead:
		// repaint only the live viewport and leave scrollback pixels alone —
		// #previousLines tracks the desired logical transcript, and the next
		// deliberate full rebuild (width change, /redraw, compactViewportFill)
		// reconciles scrollback.
		//
		// Exception: when a non-multiplexer frame GREW in the same pass (append +
		// offscreen change together), append only the new tail rows and repaint the
		// viewport in one synchronized write. Known off-bottom viewports skip the
		// append phase to avoid forcing the user's scrollback view to the bottom.
		if (firstChanged < prevViewportTop) {
			logRedraw(`firstChanged < viewportTop (${firstChanged} < ${prevViewportTop})`);
			const grew = newLines.length > this.#previousLines.length;
			const viewportAtBottom = this.terminal.isViewportAtBottom?.();
			if (useLegacyMultiplexerFullRender()) {
				fullRender(true, "firstChanged < viewportTop");
			} else if (
				grew &&
				!isMultiplexerSession() &&
				viewportAtBottom === true &&
				// The floor freeze belongs to the composer-pin model — legacy
				// no-sentinel frames must stay byte-identical even when a caller
				// set the flag (260702 gpt-5.5 review finding).
				!(this.#overflowFloorFrozen && this.#fillSentinelPresent)
			) {
				appendGrowthAndRepaintViewport(`firstChanged < viewportTop (${firstChanged} < ${prevViewportTop})`);
			} else {
				viewportRepaint(`firstChanged < viewportTop (${firstChanged} < ${prevViewportTop})`);
			}
			return;
		}

		// Render from first changed line to end
		// Build buffer with all updates wrapped in synchronized output
		let buffer = "\x1b[?2026h"; // Begin synchronized output
		const prevViewportBottom = prevViewportTop + height - 1;
		// 260630 ctrl+o follow-up: a transient expansion must not scroll the
		// terminal — pushed rows can never be un-scrolled, leaving a blank
		// residue the size of the expansion after collapse. Any differential
		// render that would walk the cursor past the current screen bottom
		// (explicit scroll or the paint loop itself) repaints the viewport in
		// place instead; the floor stays frozen so collapsing restores the
		// pre-expansion screen exactly.
		if (
			this.#overflowFloorFrozen &&
			// Pin-model only — legacy no-sentinel frames ignore the freeze so
			// their write stream stays byte-identical (260702 gpt-5.5 review).
			this.#fillSentinelPresent &&
			Math.min(lastChanged, newLines.length - 1) > prevViewportBottom
		) {
			viewportRepaint(`growth while floor frozen (${lastChanged} > ${prevViewportBottom})`);
			return;
		}
		const moveTargetRow = appendStart ? firstChanged - 1 : firstChanged;
		if (moveTargetRow > prevViewportBottom) {
			const currentScreenRow = Math.max(0, Math.min(height - 1, hardwareCursorRow - prevViewportTop));
			const moveToBottom = height - 1 - currentScreenRow;
			if (moveToBottom > 0) {
				buffer += `\x1b[${moveToBottom}B`;
			}
			const scroll = moveTargetRow - prevViewportBottom;
			buffer += "\r\n".repeat(scroll);
			prevViewportTop += scroll;
			viewportTop += scroll;
			hardwareCursorRow = moveTargetRow;
		}

		// Move cursor to first changed line (use hardwareCursorRow for actual position)
		const lineDiff = computeLineDiff(moveTargetRow);
		if (lineDiff > 0) {
			buffer += `\x1b[${lineDiff}B`; // Move down
		} else if (lineDiff < 0) {
			buffer += `\x1b[${-lineDiff}A`; // Move up
		}

		buffer += appendStart ? "\r\n" : "\r"; // Move to column 0

		// Only render changed lines (firstChanged to lastChanged), not all lines to end
		// This reduces flicker when only a single line changes (e.g., spinner animation)
		const renderEnd = Math.min(lastChanged, newLines.length - 1);
		for (let i = firstChanged; i <= renderEnd; i++) {
			if (i > firstChanged) buffer += "\r\n";
			buffer += "\x1b[2K"; // Clear current line
			buffer += this.#truncatePreparedLineToWidth(newLines[i], width);
		}

		// Track where cursor ended up after rendering
		let finalCursorRow = renderEnd;

		// If we had more lines before, clear them and move cursor back
		if (this.#previousLines.length > newLines.length) {
			// Move to end of new content first if we stopped before it
			if (renderEnd < newLines.length - 1) {
				const moveDown = newLines.length - 1 - renderEnd;
				buffer += `\x1b[${moveDown}B`;
				finalCursorRow = newLines.length - 1;
			}
			const extraLines = this.#previousLines.length - newLines.length;
			for (let i = newLines.length; i < this.#previousLines.length; i++) {
				buffer += "\r\n\x1b[2K";
			}
			// Move cursor back to end of new content
			buffer += `\x1b[${extraLines}A`;
		}

		const { seq, toRow } = this.#cursorControlSequence(cursorPos, newLines.length, finalCursorRow);
		this.#hardwareCursorRow = toRow;
		buffer += seq;
		buffer += "\x1b[?2026l"; // End synchronized output

		if ($flag("PI_TUI_DEBUG")) {
			const debugDir = "/tmp/tui";
			fs.mkdirSync(debugDir, { recursive: true });
			const debugPath = path.join(debugDir, `render-${Date.now()}-${Math.random().toString(36).slice(2)}.log`);
			const debugData = [
				`firstChanged: ${firstChanged}`,
				`viewportTop: ${viewportTop}`,
				`cursorRow: ${this.#cursorRow}`,
				`height: ${height}`,
				`lineDiff: ${lineDiff}`,
				`hardwareCursorRow: ${hardwareCursorRow}`,
				`hardwareCursorRow (post): ${this.#hardwareCursorRow}`,
				`renderEnd: ${renderEnd}`,
				`finalCursorRow: ${finalCursorRow}`,
				`cursorPos: ${JSON.stringify(cursorPos)}`,
				`newLines.length: ${newLines.length}`,
				`previousLines.length: ${this.#previousLines.length}`,
				"",
				"=== newLines ===",
				JSON.stringify(newLines, null, 2),
				"",
				"=== previousLines ===",
				JSON.stringify(this.#previousLines, null, 2),
				"",
				"=== buffer ===",
				JSON.stringify(buffer),
			].join("\n");
			fs.writeFileSync(debugPath, debugData);
		}

		// Write entire buffer at once
		if (!this.#writeTerminal(buffer)) return;

		// Track cursor position for next render.
		// cursorRow tracks end of content (for viewport calculation).
		// #hardwareCursorRow was already updated by #cursorControlSequence above.
		this.#cursorRow = Math.max(0, newLines.length - 1);
		// Track content height for viewport calculation
		this.#maxLinesRendered = newLines.length;
		this.#viewportTopRow = Math.max(0, newLines.length - height);

		this.#previousLines = newLines;
		this.#previousWidth = width;
		this.#previousHeight = height;
		// The differential path walks the cursor through every appended row, so
		// any growth beyond the previous bottom physically scrolled — the frame
		// is materialized to its full length.
		this.#raiseOverflowFloor(newLines.length, height);
	}

	/**
	 * Build cursor control sequences to position the hardware cursor for the IME
	 * candidate window. Returns escape sequences and the resulting cursor row for
	 * the caller to update `#hardwareCursorRow`. The sequences should be appended
	 * into the caller's own synchronized output block to avoid a flicker between
	 * content and cursor frames.
	 */
	#cursorControlSequence(
		cursorPos: { row: number; col: number } | null,
		totalLines: number,
		fromRow: number,
	): { seq: string; toRow: number } {
		// No IME target or no content — hide cursor regardless of preference
		if (!cursorPos || totalLines <= 0) return { seq: "\x1b[?25l", toRow: fromRow };

		// Clamp cursor position to valid range
		const targetRow = Math.max(0, Math.min(cursorPos.row, totalLines - 1));
		const targetCol = Math.max(0, cursorPos.col);

		// Move cursor from current position to target
		const rowDelta = targetRow - fromRow;
		let seq = "";
		if (rowDelta > 0) {
			seq += `\x1b[${rowDelta}B`; // Move down
		} else if (rowDelta < 0) {
			seq += `\x1b[${-rowDelta}A`; // Move up
		}
		// Move to absolute column (1-indexed)
		seq += `\x1b[${targetCol + 1}G`;
		seq += this.#showHardwareCursor ? "\x1b[?25h" : "\x1b[?25l";

		return { seq, toRow: targetRow };
	}

	/**
	 * Write the hardware cursor position to the terminal as a standalone
	 * synchronized output block. Use when there is no surrounding render buffer
	 * to embed the sequences into.
	 */
	#writeCursorPosition(cursorPos: { row: number; col: number } | null, totalLines: number): void {
		if (!cursorPos || totalLines <= 0) {
			this.#hideCursor();
			return;
		}
		const { seq, toRow } = this.#cursorControlSequence(cursorPos, totalLines, this.#hardwareCursorRow);
		this.#hardwareCursorRow = toRow;
		this.#writeTerminal(`\x1b[?2026h${seq}\x1b[?2026l`);
	}
}
