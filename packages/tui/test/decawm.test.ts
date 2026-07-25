import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { emergencyTerminalRestore, ProcessTerminal } from "@jawcode-dev/tui/terminal";

/**
 * 260703 WP2 — the TUI session runs with autowrap disabled (DECRST 7). The
 * renderer pre-wraps every line and writes explicit \r\n between rows, so
 * autowrap only ever hurts: any physically overwide write (stale width during
 * a resize race, ambiguous/emoji width the measurer undercounts) inserts a
 * wrapped row the diff renderer cannot see and permanently desyncs its
 * relative cursor model. With DECAWM off the same mistake clips at the right
 * edge — row-model-safe. Restore must be exhaustive: stop() and the
 * emergency blind path. Plan: devlog/_plan/260703_tui_resize_stability/20.
 */

const stdinIsTtyDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
const stdoutIsTtyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
const stdinSetRawModeDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "setRawMode");

function restoreProperty(target: object, key: string, descriptor: PropertyDescriptor | undefined): void {
	if (descriptor) {
		Object.defineProperty(target, key, descriptor);
		return;
	}
	delete (target as Record<string, unknown>)[key];
}

describe("DECAWM session guard (260703 WP2)", () => {
	let writes: string[];

	beforeEach(() => {
		writes = [];
		Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
		Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
		Object.defineProperty(process.stdin, "setRawMode", { value: vi.fn(), configurable: true });
		vi.spyOn(process, "kill").mockReturnValue(true);
		vi.spyOn(process.stdin, "resume").mockImplementation(() => process.stdin);
		vi.spyOn(process.stdin, "pause").mockImplementation(() => process.stdin);
		vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
			writes.push(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk));
			return true;
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		restoreProperty(process.stdin, "isTTY", stdinIsTtyDescriptor);
		restoreProperty(process.stdout, "isTTY", stdoutIsTtyDescriptor);
		restoreProperty(process.stdin, "setRawMode", stdinSetRawModeDescriptor);
	});

	it("start() disables autowrap for the session", () => {
		const terminal = new ProcessTerminal();
		terminal.start(
			() => {},
			() => {},
		);
		expect(writes.join("")).toContain("\x1b[?7l");
		terminal.stop();
	});

	it("start() disables autowrap before any printable byte reaches the terminal", () => {
		const terminal = new ProcessTerminal();
		terminal.start(
			() => {},
			() => {},
		);
		// Every row write after start() relies on DECAWM being off; a printable
		// character emitted before ?7l could still wrap and desync row 0.
		const joined = writes.join("");
		const disableAt = joined.indexOf("\x1b[?7l");
		expect(disableAt).toBeGreaterThanOrEqual(0);
		const printable = joined.slice(0, disableAt).match(/[\x20-\x7e]/g) ?? [];
		// Escape-sequence payload bytes (e.g. "[?2004h") are printable ASCII but
		// part of control sequences; strip full sequences first, then assert no
		// bare printable text remains before the autowrap disable.
		const beforeDisable = joined
			.slice(0, disableAt)
			.replace(/\x1b\[[0-9;?<>=]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b[78=>]|\x1b\[\?u/g, "");
		expect(beforeDisable).toBe("");
		expect(printable.length).toBeGreaterThan(0); // sanity: sequences existed
		terminal.stop();
	});

	it("emergency restore emits the blind sequence even when the tracked terminal is dead", () => {
		const terminal = new ProcessTerminal();
		terminal.start(
			() => {},
			() => {},
		);
		// Simulate a dead stdout marking the instance unavailable: every
		// #safeWrite no-ops from here on, so the tracked stop() restores
		// nothing — the crash path must still emit the raw blind restore.
		(process.stdout.write as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
			throw new Error("EIO");
		});
		terminal.write("boom"); // trips #markUnavailable via the throwing write
		writes.length = 0;
		emergencyTerminalRestore();
		expect(writes.join("")).toContain("\x1b[?7h");
	});

	it("stop() restores autowrap", () => {
		const terminal = new ProcessTerminal();
		terminal.start(
			() => {},
			() => {},
		);
		writes.length = 0;
		terminal.stop();
		expect(writes.join("")).toContain("\x1b[?7h");
	});

	it("emergency blind restore includes autowrap", () => {
		// Simulate a crash where the terminal instance was lost after start:
		// start + stop leaves terminalEverStarted set and activeTerminal null,
		// which routes emergencyTerminalRestore() to the blind-restore string.
		const terminal = new ProcessTerminal();
		terminal.start(
			() => {},
			() => {},
		);
		terminal.stop();
		writes.length = 0;
		emergencyTerminalRestore();
		expect(writes.join("")).toContain("\x1b[?7h");
	});
});
