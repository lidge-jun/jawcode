import { execFile as execFileCb } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Path to the compiled Swift helper binary. */
const CU_NATIVE_PATH = process.env.CU_NATIVE_PATH ?? resolve(__dirname, "..", "bin", "cu-native");

/** 10 MB — enough for base64-encoded screenshots. */
const MAX_BUFFER = 10 * 1024 * 1024;

/**
 * Call the Swift helper binary with the given arguments.
 * Returns parsed JSON output.
 */
export async function callNative(args: string[]): Promise<any> {
	const { stdout } = await execFile(CU_NATIVE_PATH, args, {
		maxBuffer: MAX_BUFFER,
		env: { ...process.env },
	});
	return JSON.parse(stdout);
}

// ---------------------------------------------------------------------------
// Typed convenience wrappers — args match Swift CLI flags exactly
// ---------------------------------------------------------------------------

export interface ScreenshotOpts {
	displayId?: number;
	allowedBundleIds?: string[];
	excludeHost?: string;
	quality?: number;
	maxWidth?: number;
	maxHeight?: number;
}

export interface ScreenshotRegionOpts {
	displayId?: number;
	allowedBundleIds?: string[];
	excludeHost?: string;
	x: number;
	y: number;
	width: number;
	height: number;
	outWidth?: number;
	outHeight?: number;
	quality?: number;
}

export const native = {
	// --- Screen capture ---
	screenshot: (opts: ScreenshotOpts) =>
		callNative([
			"screenshot",
			"--allowed",
			(opts.allowedBundleIds ?? []).join(","),
			...(opts.displayId != null ? ["--display", String(opts.displayId)] : []),
			...(opts.excludeHost ? ["--exclude-host", opts.excludeHost] : []),
			...(opts.quality != null ? ["--quality", String(opts.quality)] : []),
			...(opts.maxWidth != null ? ["--max-width", String(opts.maxWidth)] : []),
			...(opts.maxHeight != null ? ["--max-height", String(opts.maxHeight)] : []),
		]),

	screenshotRegion: (opts: ScreenshotRegionOpts) =>
		callNative([
			"screenshot-region",
			"--allowed",
			(opts.allowedBundleIds ?? []).join(","),
			`--x=${opts.x}`,
			`--y=${opts.y}`,
			`--w=${opts.width}`,
			`--h=${opts.height}`,
			...(opts.displayId != null ? ["--display", String(opts.displayId)] : []),
			...(opts.excludeHost ? ["--exclude-host", opts.excludeHost] : []),
			...(opts.outWidth != null ? ["--out-width", String(opts.outWidth)] : []),
			...(opts.outHeight != null ? ["--out-height", String(opts.outHeight)] : []),
			...(opts.quality != null ? ["--quality", String(opts.quality)] : []),
		]),

	// --- Mouse ---
	click: (x: number, y: number, button?: string, count?: number, modifiers?: string) =>
		callNative([
			"click",
			`--x=${x}`,
			`--y=${y}`,
			...(button ? ["--button", button] : []),
			...(count != null ? ["--count", String(count)] : []),
			...(modifiers ? ["--modifiers", modifiers] : []),
		]),

	mouseMove: (x: number, y: number, animate?: boolean) =>
		callNative(["mouse-move", `--x=${x}`, `--y=${y}`, ...(animate ? ["--animate"] : [])]),

	mouseDown: () => callNative(["mouse-down"]),

	mouseUp: () => callNative(["mouse-up"]),

	scroll: (x: number, y: number, dx: number, dy: number) =>
		callNative(["scroll", `--x=${x}`, `--y=${y}`, `--dx=${dx}`, `--dy=${dy}`]),

	mouseLocation: () => callNative(["mouse-location"]),

	// --- Keyboard ---
	type: (text: string, viaClipboard?: boolean) =>
		callNative(["type", "--text", text, ...(viaClipboard ? ["--via-clipboard"] : [])]),

	key: (combo: string, repeat?: number) =>
		callNative(["key", "--combo", combo, ...(repeat != null ? ["--repeat", String(repeat)] : [])]),

	holdKey: (combo: string, duration: number) =>
		callNative(["hold-key", "--combo", combo, "--duration", String(duration)]),

	// --- Application management (nested subcommands) ---
	appsList: () => callNative(["apps", "list"]),

	appsFrontmost: () => callNative(["apps", "frontmost"]),

	appsUnderPoint: (x: number, y: number) => callNative(["apps", "under-point", `--x=${x}`, `--y=${y}`]),

	appsHide: (bundleIds: string[]) => callNative(["apps", "hide", "--bundle-ids", bundleIds.join(",")]),

	appsUnhide: (bundleIds: string[]) => callNative(["apps", "unhide", "--bundle-ids", bundleIds.join(",")]),

	appsOpen: (app: string) => callNative(["apps", "open", "--app", app]),

	appsResolve: (names: string[]) => callNative(["apps", "resolve", "--names", names.join(",")]),

	// --- Display (nested subcommands) ---
	displayList: () => callNative(["display", "list"]),

	displaySize: (id?: number) => callNative(["display", "size", ...(id != null ? ["--id", String(id)] : [])]),

	// --- System ---
	tccCheck: () => callNative(["tcc"]),

	clipboardRead: () => callNative(["clipboard", "read"]),

	clipboardWrite: (text: string) => callNative(["clipboard", "write", "--text", text]),

	// --- AX Hit-Test ---
	inspect: (x: number, y: number, press?: boolean) =>
		callNative(["inspect", `--x=${x}`, `--y=${y}`, ...(press ? ["--press"] : [])]),
} as const;
