import { afterEach, describe, expect, it } from "bun:test";
import * as path from "node:path";
import {
	ImageProtocol,
	isUnderTerminalMultiplexer,
	setTerminalImageProtocol,
	shouldProbeSixelCapability,
	TERMINAL,
	TUI,
} from "@jawcode-dev/tui";
import { VirtualTerminal } from "./virtual-terminal";

type MutableTerminalInfo = {
	imageProtocol: ImageProtocol | null;
};

const terminalInfo = TERMINAL as unknown as MutableTerminalInfo;
const originalProtocol = TERMINAL.imageProtocol;
const originalWtSession = Bun.env.WT_SESSION;
const stdinIsTtyDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
const stdoutIsTtyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

function restoreIsTty(
	stream: NodeJS.ReadStream | NodeJS.WriteStream,
	descriptor: PropertyDescriptor | undefined,
): void {
	if (descriptor) {
		Object.defineProperty(stream, "isTTY", descriptor);
		return;
	}
	delete (stream as unknown as { isTTY?: boolean }).isTTY;
}

describe("TUI SIXEL capability probe", () => {
	afterEach(() => {
		setTerminalImageProtocol(originalProtocol);
		terminalInfo.imageProtocol = originalProtocol;
		if (originalWtSession === undefined) delete Bun.env.WT_SESSION;
		else Bun.env.WT_SESSION = originalWtSession;
		restoreIsTty(process.stdin, stdinIsTtyDescriptor);
		restoreIsTty(process.stdout, stdoutIsTtyDescriptor);
	});

	it("enables SIXEL only after positive terminal capability response", () => {
		if (process.platform !== "win32") return;
		setTerminalImageProtocol(null);
		terminalInfo.imageProtocol = null;
		Bun.env.WT_SESSION = "test-wt-session";
		Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
		Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });

		const terminal = new VirtualTerminal(80, 24);
		const tui = new TUI(terminal);
		tui.start();
		terminal.sendInput("\x1b[?1;2;4c");

		expect(TERMINAL.imageProtocol).toBe(ImageProtocol.Sixel);
		tui.stop();
	});

	it("enables SIXEL when DA and graphics replies are coalesced in one chunk", () => {
		if (process.platform !== "win32") return;
		setTerminalImageProtocol(null);
		terminalInfo.imageProtocol = null;
		Bun.env.WT_SESSION = "test-wt-session";
		Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
		Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });

		const terminal = new VirtualTerminal(80, 24);
		const tui = new TUI(terminal);
		tui.start();
		terminal.sendInput("\x1b[?1;2;4c\x1b[?2;0;800;480S");

		expect(TERMINAL.imageProtocol).toBe(ImageProtocol.Sixel);
		tui.stop();
	});

	it("enables SIXEL when DA reply arrives split across chunks", () => {
		if (process.platform !== "win32") return;
		setTerminalImageProtocol(null);
		terminalInfo.imageProtocol = null;
		Bun.env.WT_SESSION = "test-wt-session";
		Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
		Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });

		const terminal = new VirtualTerminal(80, 24);
		const tui = new TUI(terminal);
		tui.start();
		terminal.sendInput("\x1b[?1;2;");
		terminal.sendInput("4c");

		expect(TERMINAL.imageProtocol).toBe(ImageProtocol.Sixel);
		tui.stop();
	});

	it("keeps SIXEL disabled when capability responses are negative", () => {
		if (process.platform !== "win32") return;
		setTerminalImageProtocol(null);
		terminalInfo.imageProtocol = null;
		Bun.env.WT_SESSION = "test-wt-session";
		Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
		Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });

		const terminal = new VirtualTerminal(80, 24);
		const tui = new TUI(terminal);
		tui.start();
		terminal.sendInput("\x1b[?1;2c");
		terminal.sendInput("\x1b[?2;3;0S");

		expect(TERMINAL.imageProtocol).toBeNull();
		tui.stop();
	});
});

describe("terminal multiplexer graphics policy", () => {
	it("recognizes tmux, screen, zellij, and JWC-launched tmux owner scopes", () => {
		expect(isUnderTerminalMultiplexer({ TMUX: "/tmp/tmux/default,1,0" })).toBe(true);
		expect(isUnderTerminalMultiplexer({ TERM: "screen-256color" })).toBe(true);
		expect(isUnderTerminalMultiplexer({ ZELLIJ: "1" })).toBe(true);
		expect(isUnderTerminalMultiplexer({ JWC_TMUX_LAUNCHED: "1" })).toBe(true);
		expect(isUnderTerminalMultiplexer({ TERM: "xterm-kitty" })).toBe(false);
	});

	it("suppresses automatic sixel probing under multiplexers and honors explicit protocol settings", () => {
		expect(shouldProbeSixelCapability({ WT_SESSION: "1" }, "win32")).toBe(true);
		expect(shouldProbeSixelCapability({ WT_SESSION: "1", TMUX: "owner" }, "win32")).toBe(false);
		expect(shouldProbeSixelCapability({ WT_SESSION: "1", PI_FORCE_IMAGE_PROTOCOL: "sixel" }, "win32")).toBe(false);
		expect(shouldProbeSixelCapability({ WT_SESSION: "1", PI_FORCE_IMAGE_PROTOCOL: "off" }, "win32")).toBe(false);
	});

	it("drops an auto-detected Kitty protocol when the process starts inside tmux", async () => {
		const env: NodeJS.ProcessEnv = { ...process.env, KITTY_WINDOW_ID: "test-kitty", TMUX: "/tmp/tmux/default,1,0" };
		delete env.PI_FORCE_IMAGE_PROTOCOL;
		const child = Bun.spawn(
			[
				process.execPath,
				"-e",
				'import { TERMINAL } from "./packages/tui/src/terminal-capabilities.ts"; process.stdout.write(String(TERMINAL.imageProtocol));',
			],
			{ cwd: path.resolve(import.meta.dir, "../../.."), env, stdout: "pipe", stderr: "pipe" },
		);
		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		]);
		expect(stderr).toBe("");
		expect(exitCode).toBe(0);
		expect(stdout).toBe("null");
	});
});
