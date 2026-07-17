import { encodeSixel } from "@jawcode-dev/natives";
import { $env } from "@jawcode-dev/utils";

export enum ImageProtocol {
	Kitty = "\x1b_G",
	Iterm2 = "\x1b]1337;File=",
	Sixel = "\x1bPq",
}

export enum NotifyProtocol {
	Bell = "\x07",
	Osc99 = "\x1b]99;;",
	Osc9 = "\x1b]9;",
}

export type TerminalId = "kitty" | "ghostty" | "wezterm" | "iterm2" | "vscode" | "alacritty" | "base" | "trueColor";

const SIXEL_DCS_START_REGEX = /\x1bP(?:[0-9;]*)q/u;
const KITTY_GRAPHICS_CONTROL_REGEX = /\x1b_G(?:[a-z]=|;)/u;
/** Terminal capability details used for rendering and protocol selection. */
export class TerminalInfo {
	constructor(
		public readonly id: TerminalId,
		public readonly imageProtocol: ImageProtocol | null,
		public readonly trueColor: boolean,
		public readonly hyperlinks: boolean,
		public readonly notifyProtocol: NotifyProtocol = NotifyProtocol.Bell,
	) {}

	isImageLine(line: string): boolean {
		if (!this.imageProtocol) return false;
		if (this.imageProtocol === ImageProtocol.Sixel) {
			return SIXEL_DCS_START_REGEX.test(line.slice(0, 128));
		}
		if (this.imageProtocol === ImageProtocol.Kitty) {
			return KITTY_GRAPHICS_CONTROL_REGEX.test(line.slice(0, 128));
		}
		return line.slice(0, 64).includes(this.imageProtocol);
	}

	formatNotification(message: string): string {
		if (this.notifyProtocol === NotifyProtocol.Bell) {
			return NotifyProtocol.Bell;
		}
		return `${this.notifyProtocol}${message}\x1b\\`;
	}

	sendNotification(message: string): void {
		if (isNotificationSuppressed()) return;
		process.stdout.write(this.formatNotification(message));
	}
}

/**
 * 260703 WP5.2 — BCE (back color erase): whether erase ops (EL/ED/2K) paint
 * the CURRENT background color instead of the default. Consumed by WP5.3's
 * renderer-level "SGR bg + erase" row painting, which replaces full-width
 * literal space padding (the reflow-amplifier class). Detection is
 * env-based, no terminfo/infocmp subprocess (absent on minimal systems):
 * `JWC_TUI_BCE=0|1` overrides; TERM dumb/empty → false; every terminal
 * family we can name honors BCE → allowlist by TERM prefix or a recognized
 * TERMINAL_ID; unknown → false (fail closed: the literal-padding fallback is
 * today's behavior, so a false negative costs nothing).
 */
const BCE_TERM_PREFIX = /^(xterm|linux|rxvt|st-|st$|alacritty|kitty|wezterm|ghostty|foot|vte|konsole|iterm)/i;

export function terminalSupportsBce(env: Record<string, string | undefined> = process.env): boolean {
	const override = env.JWC_TUI_BCE;
	if (override === "0" || override === "false") return false;
	if (override === "1" || override === "true") return true;
	// 260704 tmux smoke (P0): tmux/screen declare bce=NO in terminfo and the
	// empirical probe confirms EL-erased cells stay DEFAULT-bg inside tmux —
	// bg rows there must keep the literal-padding fallback (visually correct;
	// the outer-terminal reflow hazard doesn't apply since the mux owns pane
	// wrapping). TMUX env catches sessions where TERM was overridden.
	if (isUnderTerminalMultiplexer(env)) return false;
	const term = env.TERM?.trim() ?? "";
	if (!term || term === "dumb") return false;
	if (BCE_TERM_PREFIX.test(term)) return true;
	return TERMINAL_ID !== "base";
}

export function isNotificationSuppressed(): boolean {
	const value = $env.PI_NOTIFICATIONS;
	if (!value) return false;
	return value === "off" || value === "0" || value === "false";
}

const MULTIPLEXER_DISABLED_ENV_VALUES = new Set(["0", "false", "off", "no"]);

function multiplexerEnvEnabled(value: string | undefined): boolean {
	const normalized = value?.trim().toLowerCase();
	return normalized !== undefined && normalized.length > 0 && !MULTIPLEXER_DISABLED_ENV_VALUES.has(normalized);
}

/** Detect terminal multiplexers that intercept graphics and hyperlink escapes. */
export function isUnderTerminalMultiplexer(env: NodeJS.ProcessEnv = process.env): boolean {
	if (
		multiplexerEnvEnabled(env.TMUX) ||
		multiplexerEnvEnabled(env.TMUX_PANE) ||
		multiplexerEnvEnabled(env.STY) ||
		multiplexerEnvEnabled(env.ZELLIJ) ||
		multiplexerEnvEnabled(env.JWC_TMUX_LAUNCHED) ||
		multiplexerEnvEnabled(env.GJC_TMUX_LAUNCHED)
	) {
		return true;
	}
	const term = env.TERM?.trim().toLowerCase() ?? "";
	return term.startsWith("tmux") || term.startsWith("screen");
}

function getForcedImageProtocol(env: NodeJS.ProcessEnv = process.env): ImageProtocol | null | undefined {
	const raw = env.PI_FORCE_IMAGE_PROTOCOL?.trim().toLowerCase();
	if (!raw) return undefined;
	if (raw === "kitty") return ImageProtocol.Kitty;
	if (raw === "iterm2" || raw === "iterm") return ImageProtocol.Iterm2;
	if (raw === "sixel") return ImageProtocol.Sixel;
	if (raw === "off" || raw === "none" || raw === "0" || raw === "false") return null;
	return null;
}

/** Whether image protocol selection was explicitly configured, including off. */
export function isImageProtocolForced(env: NodeJS.ProcessEnv = process.env): boolean {
	return getForcedImageProtocol(env) !== undefined;
}

function parseMajorMinorVersion(versionRaw?: string): { major: number; minor: number } | null {
	if (!versionRaw) return null;
	const match = /^(\d+)\.(\d+)/u.exec(versionRaw.trim());
	if (!match) return null;
	const major = Number.parseInt(match[1] ?? "", 10);
	const minor = Number.parseInt(match[2] ?? "", 10);
	if (!Number.isFinite(major) || !Number.isFinite(minor)) return null;
	return { major, minor };
}

/**
 * Returns true when running in Windows Terminal with known SIXEL support.
 *
 * Windows Terminal introduced SIXEL support in preview 1.22.
 */
export function isWindowsTerminalPreviewSixelSupported(
	env: NodeJS.ProcessEnv = process.env,
	platform: NodeJS.Platform = process.platform,
): boolean {
	if (platform !== "win32") return false;
	if (!env.WT_SESSION) return false;
	if (env.TERM_PROGRAM && env.TERM_PROGRAM.toLowerCase() !== "windows_terminal") {
		return false;
	}
	const version = parseMajorMinorVersion(env.TERM_PROGRAM_VERSION);
	if (!version) return false;
	return version.major > 1 || (version.major === 1 && version.minor >= 22);
}
function getFallbackImageProtocol(terminalId: TerminalId): ImageProtocol | null {
	if (!process.stdout.isTTY) return null;
	if (terminalId === "vscode" || terminalId === "alacritty") return null;
	const term = process.env.TERM?.toLowerCase() ?? "";
	if (term.includes("ghostty")) {
		return ImageProtocol.Kitty;
	}
	return null;
}
const KNOWN_TERMINALS = Object.freeze({
	// Fallback terminals
	base: new TerminalInfo("base", null, false, false, NotifyProtocol.Bell),
	trueColor: new TerminalInfo("trueColor", null, true, false, NotifyProtocol.Bell),
	// Recognized terminals
	kitty: new TerminalInfo("kitty", ImageProtocol.Kitty, true, true, NotifyProtocol.Osc99),
	ghostty: new TerminalInfo("ghostty", ImageProtocol.Kitty, true, true, NotifyProtocol.Osc9),
	wezterm: new TerminalInfo("wezterm", ImageProtocol.Kitty, true, true, NotifyProtocol.Osc9),
	iterm2: new TerminalInfo("iterm2", ImageProtocol.Iterm2, true, true, NotifyProtocol.Osc9),
	vscode: new TerminalInfo("vscode", null, true, true, NotifyProtocol.Bell),
	alacritty: new TerminalInfo("alacritty", null, true, true, NotifyProtocol.Bell),
});

export const TERMINAL_ID: TerminalId = (() => {
	function caseEq(a: string, b: string): boolean {
		return a.toLowerCase() === b.toLowerCase(); // For compiler to pattern match
	}

	const {
		KITTY_WINDOW_ID,
		GHOSTTY_RESOURCES_DIR,
		WEZTERM_PANE,
		ITERM_SESSION_ID,
		VSCODE_PID,
		ALACRITTY_WINDOW_ID,
		TERM_PROGRAM,
		TERM,
		COLORTERM,
	} = process.env;

	if (KITTY_WINDOW_ID) return "kitty";
	if (GHOSTTY_RESOURCES_DIR) return "ghostty";
	if (WEZTERM_PANE) return "wezterm";
	if (ITERM_SESSION_ID) return "iterm2";
	if (VSCODE_PID) return "vscode";
	if (ALACRITTY_WINDOW_ID) return "alacritty";

	if (TERM_PROGRAM) {
		if (caseEq(TERM_PROGRAM, "kitty")) return "kitty";
		if (caseEq(TERM_PROGRAM, "ghostty")) return "ghostty";
		if (caseEq(TERM_PROGRAM, "wezterm")) return "wezterm";
		if (caseEq(TERM_PROGRAM, "iterm.app")) return "iterm2";
		if (caseEq(TERM_PROGRAM, "vscode")) return "vscode";
		if (caseEq(TERM_PROGRAM, "alacritty")) return "alacritty";
	}

	if (TERM?.toLowerCase().includes("ghostty")) return "ghostty";

	if (COLORTERM) {
		if (caseEq(COLORTERM, "truecolor") || caseEq(COLORTERM, "24bit")) return "trueColor";
	}
	return "base";
})();

export const TERMINAL = (() => {
	const terminal = getTerminalInfo(TERMINAL_ID);
	const forcedImageProtocol = getForcedImageProtocol();
	let resolved = terminal;
	if (forcedImageProtocol !== undefined) {
		resolved = new TerminalInfo(
			terminal.id,
			forcedImageProtocol,
			terminal.trueColor,
			terminal.hyperlinks,
			terminal.notifyProtocol,
		);
	} else if (!terminal.imageProtocol) {
		const fallbackImageProtocol = getFallbackImageProtocol(terminal.id);
		if (fallbackImageProtocol) {
			resolved = new TerminalInfo(
				terminal.id,
				fallbackImageProtocol,
				terminal.trueColor,
				terminal.hyperlinks,
				terminal.notifyProtocol,
			);
		}
	}
	const underMultiplexer = isUnderTerminalMultiplexer();
	// Multiplexers do not reliably forward OSC 8 hyperlinks
	// to the outer terminal, so force them off regardless of detected terminal.
	if (resolved.hyperlinks && underMultiplexer) {
		resolved = new TerminalInfo(
			resolved.id,
			resolved.imageProtocol,
			resolved.trueColor,
			false,
			resolved.notifyProtocol,
		);
	}
	// Raw Kitty/iTerm2 graphics are not end-to-end safe through multiplexers.
	// Suppress automatic detection; an explicit PI_FORCE_IMAGE_PROTOCOL value is
	// the only opt-in for a chain known to forward graphics correctly.
	if (resolved.imageProtocol && forcedImageProtocol === undefined && underMultiplexer) {
		resolved = new TerminalInfo(resolved.id, null, resolved.trueColor, resolved.hyperlinks, resolved.notifyProtocol);
	}
	return resolved;
})();

type MutableTerminalInfo = {
	imageProtocol: ImageProtocol | null;
};

/**
 * Override terminal image protocol at runtime after capability probes complete.
 */
export function setTerminalImageProtocol(imageProtocol: ImageProtocol | null): void {
	(TERMINAL as unknown as MutableTerminalInfo).imageProtocol = imageProtocol;
}

export function getTerminalInfo(terminalId: TerminalId): TerminalInfo {
	return KNOWN_TERMINALS[terminalId];
}

export interface CellDimensions {
	widthPx: number;
	heightPx: number;
}

export interface ImageDimensions {
	widthPx: number;
	heightPx: number;
}

export interface ImageRenderOptions {
	maxWidthCells?: number;
	maxHeightCells?: number;
	preserveAspectRatio?: boolean;
	/** Kitty-only stable image id. Defaults to a content hash. */
	imageId?: number;
	/** Kitty-only stable placement id. Persistent components should allocate one per instance. */
	placementId?: number;
	/** Kitty-only test/custom sink for the one-time transmit sequence. */
	onTransmit?: (sequence: string) => void;
}

/** Derive a stable non-zero kitty image id from the base64 payload. */
export function kittyImageId(base64Data: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < base64Data.length; i++) {
		hash ^= base64Data.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	hash >>>= 0;
	return hash === 0 ? 1 : hash;
}

// Default cell dimensions - updated by TUI when terminal responds to query
let cellDimensions: CellDimensions = { widthPx: 9, heightPx: 18 };

export function getCellDimensions(): CellDimensions {
	return cellDimensions;
}

export function setCellDimensions(dims: CellDimensions): void {
	cellDimensions = dims;
}

export function encodeKitty(
	base64Data: string,
	options: {
		columns?: number;
		rows?: number;
		imageId?: number;
	} = {},
): string {
	const CHUNK_SIZE = 4096;

	const params: string[] = ["a=T", "f=100", "q=2"];

	if (options.columns) params.push(`c=${options.columns}`);
	if (options.rows) params.push(`r=${options.rows}`);
	if (options.imageId) params.push(`i=${options.imageId}`);

	if (base64Data.length <= CHUNK_SIZE) {
		return `\x1b_G${params.join(",")};${base64Data}\x1b\\`;
	}

	const chunks: string[] = [];
	let offset = 0;
	let isFirst = true;

	while (offset < base64Data.length) {
		const chunk = base64Data.slice(offset, offset + CHUNK_SIZE);
		const isLast = offset + CHUNK_SIZE >= base64Data.length;

		if (isFirst) {
			chunks.push(`\x1b_G${params.join(",")},m=1;${chunk}\x1b\\`);
			isFirst = false;
		} else if (isLast) {
			chunks.push(`\x1b_Gm=0;${chunk}\x1b\\`);
		} else {
			chunks.push(`\x1b_Gm=1;${chunk}\x1b\\`);
		}

		offset += CHUNK_SIZE;
	}

	return chunks.join("");
}

const transmittedKittyImageIds = new Set<number>();

/** Forget uploaded kitty image ids, primarily for terminal restarts and tests. */
export function resetKittyTransmissions(): void {
	transmittedKittyImageIds.clear();
}

let kittyTransmitWriter: (sequence: string) => void = sequence => {
	if (process.stdout.isTTY) process.stdout.write(sequence);
};

export function setKittyTransmitWriter(writer: (sequence: string) => void): void {
	kittyTransmitWriter = writer;
}

/** Upload kitty image data without creating a placement. */
export function encodeKittyTransmit(base64Data: string, imageId: number): string {
	const CHUNK_SIZE = 4096;
	const params = ["a=t", "f=100", "q=2", `i=${imageId}`];

	if (base64Data.length <= CHUNK_SIZE) {
		return `\x1b_G${params.join(",")};${base64Data}\x1b\\`;
	}

	const chunks: string[] = [];
	let offset = 0;
	let isFirst = true;
	while (offset < base64Data.length) {
		const chunk = base64Data.slice(offset, offset + CHUNK_SIZE);
		const isLast = offset + CHUNK_SIZE >= base64Data.length;
		if (isFirst) {
			chunks.push(`\x1b_G${params.join(",")},m=1;${chunk}\x1b\\`);
			isFirst = false;
		} else if (isLast) {
			chunks.push(`\x1b_Gm=0;${chunk}\x1b\\`);
		} else {
			chunks.push(`\x1b_Gm=1;${chunk}\x1b\\`);
		}
		offset += CHUNK_SIZE;
	}
	return chunks.join("");
}

/** Place previously uploaded kitty image data without moving the cursor. */
export function encodeKittyPlacement(options: {
	imageId: number;
	placementId: number;
	columns: number;
	rows: number;
}): string {
	return `\x1b_Ga=p,i=${options.imageId},p=${options.placementId},c=${options.columns},r=${options.rows},C=1,q=2\x1b\\`;
}

export function encodeITerm2(
	base64Data: string,
	options: {
		width?: number | string;
		height?: number | string;
		name?: string;
		preserveAspectRatio?: boolean;
		inline?: boolean;
	} = {},
): string {
	const params: string[] = [`inline=${options.inline !== false ? 1 : 0}`];

	if (options.width !== undefined) params.push(`width=${options.width}`);
	if (options.height !== undefined) params.push(`height=${options.height}`);
	if (options.name) {
		const nameBase64 = Buffer.from(options.name).toBase64();
		params.push(`name=${nameBase64}`);
	}
	if (options.preserveAspectRatio === false) {
		params.push("preserveAspectRatio=0");
	}

	return `\x1b]1337;File=${params.join(";")}:${base64Data}\x07`;
}

export function calculateImageRows(
	imageDimensions: ImageDimensions,
	targetWidthCells: number,
	cellDimensions: CellDimensions = { widthPx: 9, heightPx: 18 },
): number {
	const targetWidthPx = targetWidthCells * cellDimensions.widthPx;
	const scale = targetWidthPx / imageDimensions.widthPx;
	const scaledHeightPx = imageDimensions.heightPx * scale;
	const rows = Math.ceil(scaledHeightPx / cellDimensions.heightPx);
	return Math.max(1, rows);
}

function calculateImageFit(
	imageDimensions: ImageDimensions,
	options: ImageRenderOptions,
	cellDims: CellDimensions,
): { columns: number; rows: number } {
	const maxColumns = options.maxWidthCells !== undefined ? Math.max(1, Math.floor(options.maxWidthCells)) : undefined;
	const maxRows = options.maxHeightCells !== undefined ? Math.max(1, Math.floor(options.maxHeightCells)) : undefined;

	if (maxColumns === undefined && maxRows === undefined) {
		const columns = Math.max(1, Math.ceil(imageDimensions.widthPx / cellDims.widthPx));
		const rows = Math.max(1, Math.ceil(imageDimensions.heightPx / cellDims.heightPx));
		return { columns, rows };
	}

	const maxWidthPx = maxColumns !== undefined ? maxColumns * cellDims.widthPx : Number.POSITIVE_INFINITY;
	const maxHeightPx = maxRows !== undefined ? maxRows * cellDims.heightPx : Number.POSITIVE_INFINITY;
	const scale = Math.min(maxWidthPx / imageDimensions.widthPx, maxHeightPx / imageDimensions.heightPx);
	const fittedWidthPx = imageDimensions.widthPx * scale;
	const fittedHeightPx = imageDimensions.heightPx * scale;

	const columns = Math.max(1, Math.floor(fittedWidthPx / cellDims.widthPx));
	const rows = Math.max(1, Math.ceil(fittedHeightPx / cellDims.heightPx));

	return {
		columns: maxColumns !== undefined ? Math.min(columns, maxColumns) : columns,
		rows: maxRows !== undefined ? Math.min(rows, maxRows) : rows,
	};
}

export function getPngDimensions(base64Data: string): ImageDimensions | null {
	try {
		const buffer = Buffer.from(base64Data, "base64");

		if (buffer.length < 24) {
			return null;
		}

		if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47) {
			return null;
		}

		const width = buffer.readUInt32BE(16);
		const height = buffer.readUInt32BE(20);

		return { widthPx: width, heightPx: height };
	} catch {
		return null;
	}
}

export function getJpegDimensions(base64Data: string): ImageDimensions | null {
	try {
		const buffer = Buffer.from(base64Data, "base64");

		if (buffer.length < 2) {
			return null;
		}

		if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
			return null;
		}

		let offset = 2;
		while (offset < buffer.length - 9) {
			if (buffer[offset] !== 0xff) {
				offset++;
				continue;
			}

			const marker = buffer[offset + 1];

			if (marker >= 0xc0 && marker <= 0xc2) {
				const height = buffer.readUInt16BE(offset + 5);
				const width = buffer.readUInt16BE(offset + 7);
				return { widthPx: width, heightPx: height };
			}

			if (offset + 3 >= buffer.length) {
				return null;
			}
			const length = buffer.readUInt16BE(offset + 2);
			if (length < 2) {
				return null;
			}
			offset += 2 + length;
		}

		return null;
	} catch {
		return null;
	}
}

export function getGifDimensions(base64Data: string): ImageDimensions | null {
	try {
		const buffer = Buffer.from(base64Data, "base64");

		if (buffer.length < 10) {
			return null;
		}

		const sig = buffer.slice(0, 6).toString("ascii");
		if (sig !== "GIF87a" && sig !== "GIF89a") {
			return null;
		}

		const width = buffer.readUInt16LE(6);
		const height = buffer.readUInt16LE(8);

		return { widthPx: width, heightPx: height };
	} catch {
		return null;
	}
}

export function getWebpDimensions(base64Data: string): ImageDimensions | null {
	try {
		const buffer = Buffer.from(base64Data, "base64");

		if (buffer.length < 30) {
			return null;
		}

		const riff = buffer.slice(0, 4).toString("ascii");
		const webp = buffer.slice(8, 12).toString("ascii");
		if (riff !== "RIFF" || webp !== "WEBP") {
			return null;
		}

		const chunk = buffer.slice(12, 16).toString("ascii");
		if (chunk === "VP8 ") {
			if (buffer.length < 30) return null;
			const width = buffer.readUInt16LE(26) & 0x3fff;
			const height = buffer.readUInt16LE(28) & 0x3fff;
			return { widthPx: width, heightPx: height };
		} else if (chunk === "VP8L") {
			if (buffer.length < 25) return null;
			const bits = buffer.readUInt32LE(21);
			const width = (bits & 0x3fff) + 1;
			const height = ((bits >> 14) & 0x3fff) + 1;
			return { widthPx: width, heightPx: height };
		} else if (chunk === "VP8X") {
			if (buffer.length < 30) return null;
			const width = (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)) + 1;
			const height = (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)) + 1;
			return { widthPx: width, heightPx: height };
		}

		return null;
	} catch {
		return null;
	}
}

export function getImageDimensions(base64Data: string, mimeType: string): ImageDimensions | null {
	if (mimeType === "image/png") {
		return getPngDimensions(base64Data);
	}
	if (mimeType === "image/jpeg") {
		return getJpegDimensions(base64Data);
	}
	if (mimeType === "image/gif") {
		return getGifDimensions(base64Data);
	}
	if (mimeType === "image/webp") {
		return getWebpDimensions(base64Data);
	}
	return null;
}

export interface RenderedImage {
	sequence: string;
	rows: number;
	/** True when the sequence does not move the cursor or carry pixel data. */
	cursorNeutral?: boolean;
}

export function renderImage(
	base64Data: string,
	imageDimensions: ImageDimensions,
	options: ImageRenderOptions = {},
): RenderedImage | null {
	if (!TERMINAL.imageProtocol) {
		return null;
	}

	const cellDims = getCellDimensions();
	const fit = calculateImageFit(imageDimensions, options, cellDims);

	if (TERMINAL.imageProtocol === ImageProtocol.Kitty) {
		const imageId = options.imageId ?? kittyImageId(base64Data);
		const placementId = options.placementId ?? 1;
		if (!transmittedKittyImageIds.has(imageId)) {
			(options.onTransmit ?? kittyTransmitWriter)(encodeKittyTransmit(base64Data, imageId));
			transmittedKittyImageIds.add(imageId);
		}
		return {
			sequence: encodeKittyPlacement({ imageId, placementId, columns: fit.columns, rows: fit.rows }),
			rows: fit.rows,
			cursorNeutral: true,
		};
	}

	if (TERMINAL.imageProtocol === ImageProtocol.Sixel) {
		try {
			const targetWidthPx = Math.max(1, fit.columns * cellDims.widthPx);
			const targetHeightPx = Math.max(1, fit.rows * cellDims.heightPx);
			const decoded = new Uint8Array(Buffer.from(base64Data, "base64"));
			const sequence = encodeSixel(decoded, targetWidthPx, targetHeightPx);
			return { sequence, rows: fit.rows };
		} catch {
			return null;
		}
	}
	if (TERMINAL.imageProtocol === ImageProtocol.Iterm2) {
		const sequence = encodeITerm2(base64Data, {
			width: fit.columns,
			height: "auto",
			preserveAspectRatio: options.preserveAspectRatio ?? true,
		});
		return { sequence, rows: fit.rows };
	}

	return null;
}

export function imageFallback(mimeType: string, dimensions?: ImageDimensions, filename?: string): string {
	const parts: string[] = [];
	if (filename) parts.push(filename);
	parts.push(`[${mimeType}]`);
	if (dimensions) parts.push(`${dimensions.widthPx}x${dimensions.heightPx}`);
	return `[Image: ${parts.join(" ")}]`;
}
