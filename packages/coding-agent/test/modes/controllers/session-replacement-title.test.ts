/**
 * Regression: a title set by an extension must never survive a session
 * replacement.
 *
 * The terminal title runtime keeps an `extensionOverride` slot that deliberately
 * outranks run-state updates, and ONLY `setSessionTerminalTitle()` clears it. So
 * every command that swaps the underlying session has to reassert the
 * authoritative title; if one forgets, the previous session's extension title
 * follows the user indefinitely.
 *
 * These tests drive the real controller commands and assert on the bytes written
 * to the terminal, so deleting a `setSessionTerminalTitle()` call from any covered
 * path turns them red.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "bun:test";
import { CommandController } from "@jawcode-dev/coding-agent/modes/controllers/command-controller";
import { getThemeByName, setThemeInstance } from "@jawcode-dev/coding-agent/modes/theme/theme";
import type { InteractiveModeContext } from "@jawcode-dev/coding-agent/modes/types";
import {
	resetTerminalTitleStateForTest,
	setExtensionTerminalTitle,
} from "@jawcode-dev/coding-agent/utils/title-generator";

function createContainer() {
	return {
		children: [] as unknown[],
		addChild(child: unknown) {
			this.children.push(child);
		},
		clear() {
			this.children = [];
		},
	};
}

const STALE_EXTENSION_TITLE = "ext title from the OLD session";

describe("session replacement clears an extension terminal title", () => {
	let writes: string[];
	let originalIsTtyDescriptor: PropertyDescriptor | undefined;

	beforeAll(async () => {
		const theme = await getThemeByName("red-claw");
		if (!theme) throw new Error("Expected theme");
		setThemeInstance(theme);
	});

	beforeEach(() => {
		writes = [];
		originalIsTtyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
		Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
		vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
			writes.push(String(chunk));
			return true;
		});
		resetTerminalTitleStateForTest();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		resetTerminalTitleStateForTest();
		if (originalIsTtyDescriptor) {
			Object.defineProperty(process.stdout, "isTTY", originalIsTtyDescriptor);
		} else {
			delete (process.stdout as { isTTY?: boolean }).isTTY;
		}
	});

	function titleWrites(): string[] {
		return writes.filter(write => write.startsWith("\x1b]0;"));
	}

	it("clears the override after a successful /handoff", async () => {
		const ctx = {
			sessionManager: {
				getEntries: () => [{ type: "message" }, { type: "message" }],
				getSessionName: () => "handoff-session",
				getCwd: () => "/tmp/handoff",
			},
			session: {
				handoff: vi.fn(async () => ({ document: "## Goal\nContinue" })),
				abortHandoff: vi.fn(),
			},
			loadingAnimation: undefined,
			statusContainer: createContainer(),
			chatContainer: createContainer(),
			ui: { requestRender: vi.fn() },
			editor: { onEscape: vi.fn() },
			rebuildChatFromMessages: vi.fn(),
			statusLine: { invalidate: vi.fn() },
			updateEditorTopBorder: vi.fn(),
			updateEditorBorderColor: vi.fn(),
			reloadTodos: vi.fn(async () => undefined),
			showStatus: vi.fn(),
			showWarning: vi.fn(),
			showError: vi.fn(),
		} as unknown as InteractiveModeContext;

		setExtensionTerminalTitle(STALE_EXTENSION_TITLE);
		await new CommandController(ctx).handleHandoffCommand();

		expect(titleWrites().at(-1)).toContain("handoff-session");
		expect(titleWrites().at(-1)).not.toContain(STALE_EXTENSION_TITLE);
	});

	it("clears the override after a successful /fork", async () => {
		const ctx = {
			sessionManager: {
				getEntries: () => [{ type: "message" }, { type: "message" }],
				getSessionName: () => "forked-session",
				getCwd: () => "/tmp/forked",
			},
			session: {
				sessionId: "session-old",
				fork: vi.fn(async () => true),
			},
			loadingAnimation: undefined,
			statusContainer: createContainer(),
			chatContainer: createContainer(),
			ui: { requestRender: vi.fn() },
			statusLine: { invalidate: vi.fn() },
			updateEditorTopBorder: vi.fn(),
			showStatus: vi.fn(),
			showError: vi.fn(),
		} as unknown as InteractiveModeContext;

		setExtensionTerminalTitle(STALE_EXTENSION_TITLE);
		await new CommandController(ctx).handleForkCommand();

		expect(titleWrites().at(-1)).toContain("forked-session");
		expect(titleWrites().at(-1)).not.toContain(STALE_EXTENSION_TITLE);
	});

	it("keeps the override when /fork fails, since no session was replaced", async () => {
		const ctx = {
			sessionManager: {
				getEntries: () => [{ type: "message" }, { type: "message" }],
				getSessionName: () => "forked-session",
				getCwd: () => "/tmp/forked",
			},
			session: {
				sessionId: "session-old",
				fork: vi.fn(async () => false),
			},
			loadingAnimation: undefined,
			statusContainer: createContainer(),
			chatContainer: createContainer(),
			ui: { requestRender: vi.fn() },
			statusLine: { invalidate: vi.fn() },
			updateEditorTopBorder: vi.fn(),
			showStatus: vi.fn(),
			showError: vi.fn(),
		} as unknown as InteractiveModeContext;

		setExtensionTerminalTitle(STALE_EXTENSION_TITLE);
		const before = titleWrites().length;
		await new CommandController(ctx).handleForkCommand();

		expect(titleWrites().length).toBe(before);
	});
});
