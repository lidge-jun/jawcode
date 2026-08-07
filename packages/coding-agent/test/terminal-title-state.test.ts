import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "bun:test";
import {
	buildTerminalTitleWithState,
	disposeTerminalTitleState,
	resetTerminalTitleStateForTest,
	setExtensionTerminalTitle,
	setSessionTerminalTitle,
	setTerminalTitleState,
	setTerminalTitleStateEnabled,
} from "../src/utils/title-generator";

const BRAND = "🦈";

describe("buildTerminalTitleWithState", () => {
	it("renders the idle separator as the user's turn", () => {
		expect(buildTerminalTitleWithState("proj", "idle", 0, true)).toBe(`${BRAND} > proj`);
	});

	it("renders the attention separator when the agent is blocked on the user", () => {
		expect(buildTerminalTitleWithState("proj", "attention", 0, true)).toBe(`${BRAND} ! proj`);
	});

	it("advances spinner frames while working", () => {
		const first = buildTerminalTitleWithState("proj", "working", 0, true);
		const second = buildTerminalTitleWithState("proj", "working", 1, true);
		expect(first).not.toBe(second);
		expect(first.startsWith(`${BRAND} `)).toBe(true);
		expect(first.endsWith(" proj")).toBe(true);
	});

	it("wraps spinner frames instead of indexing out of range", () => {
		expect(buildTerminalTitleWithState("proj", "working", 0, true)).toBe(
			buildTerminalTitleWithState("proj", "working", 10, true),
		);
	});

	it("falls back to the pre-state layout when disabled", () => {
		expect(buildTerminalTitleWithState("proj", "working", 3, false)).toBe(`${BRAND}: proj`);
		expect(buildTerminalTitleWithState(undefined, "working", 3, false)).toBe(BRAND);
	});

	it("keeps the state visible when there is no label", () => {
		expect(buildTerminalTitleWithState(undefined, "idle", 0, true)).toBe(`${BRAND} >`);
	});
});

describe("terminal title runtime", () => {
	let writes: string[];
	let writeSpy: Mock<(chunk: unknown) => boolean> | undefined;
	let originalIsTtyDescriptor: PropertyDescriptor | undefined;

	beforeEach(() => {
		writes = [];
		// Capture the exact descriptor: `isTTY` may not be an own property at all, and
		// restoring only its value would leave one behind for other suites.
		originalIsTtyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
		// The OSC sink is TTY-guarded, so runtime behavior is unobservable without this.
		Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
		writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
			writes.push(String(chunk));
			return true;
		}) as unknown as Mock<(chunk: unknown) => boolean>;
		resetTerminalTitleStateForTest();
	});

	afterEach(() => {
		disposeTerminalTitleState();
		resetTerminalTitleStateForTest();
		writeSpy?.mockRestore();
		if (originalIsTtyDescriptor) {
			Object.defineProperty(process.stdout, "isTTY", originalIsTtyDescriptor);
		} else {
			delete (process.stdout as { isTTY?: boolean }).isTTY;
		}
	});

	it("emits an OSC title carrying the session label", () => {
		setSessionTerminalTitle("myproj", "/tmp/myproj");
		expect(writes.at(-1)).toBe(`\x1b]0;${BRAND} > myproj\x07`);
	});

	it("dedups repeated emissions of an unchanged title", () => {
		setSessionTerminalTitle("myproj", "/tmp/myproj");
		const afterFirst = writes.length;
		setTerminalTitleState("idle");
		setTerminalTitleState("idle");
		expect(writes.length).toBe(afterFirst);
	});

	// These few cases drive the real 80ms interval rather than a fake clock: the
	// defect being guarded against IS a real timer surviving teardown, and a fake
	// clock would prove only that a mock was cleared.
	it("animates the spinner while working and stops for good once disposed", async () => {
		setSessionTerminalTitle("myproj", "/tmp/myproj");
		setTerminalTitleState("working");
		await Bun.sleep(200);
		expect(writes.length).toBeGreaterThan(1);

		disposeTerminalTitleState();
		const afterDispose = writes.length;
		await Bun.sleep(200);
		// The teardown leak the audit flagged: a pending tick must not re-emit an OSC
		// title after the terminal has been handed back to the shell.
		expect(writes.length).toBe(afterDispose);
	});

	it("does not animate while idle", async () => {
		setSessionTerminalTitle("myproj", "/tmp/myproj");
		const afterIdle = writes.length;
		await Bun.sleep(200);
		expect(writes.length).toBe(afterIdle);
	});

	it("stops the spinner when the turn settles to idle", async () => {
		setSessionTerminalTitle("myproj", "/tmp/myproj");
		setTerminalTitleState("working");
		await Bun.sleep(120);
		setTerminalTitleState("idle");
		expect(writes.at(-1)).toBe(`\x1b]0;${BRAND} > myproj\x07`);
		const afterIdle = writes.length;
		await Bun.sleep(200);
		expect(writes.length).toBe(afterIdle);
	});

	it("stops the spinner when the setting is disabled mid-run", async () => {
		setSessionTerminalTitle("myproj", "/tmp/myproj");
		setTerminalTitleState("working");
		await Bun.sleep(120);
		setTerminalTitleStateEnabled(false);
		expect(writes.at(-1)).toBe(`\x1b]0;${BRAND}: myproj\x07`);
		const afterDisable = writes.length;
		await Bun.sleep(200);
		expect(writes.length).toBe(afterDisable);
	});

	it("resumes the spinner when the setting is re-enabled while working", async () => {
		setSessionTerminalTitle("myproj", "/tmp/myproj");
		setTerminalTitleState("working");
		setTerminalTitleStateEnabled(false);
		const afterDisable = writes.length;
		setTerminalTitleStateEnabled(true);
		await Bun.sleep(200);
		expect(writes.length).toBeGreaterThan(afterDisable);
	});

	it("lets an extension title own the terminal against state changes", () => {
		setSessionTerminalTitle("myproj", "/tmp/myproj");
		setExtensionTerminalTitle("ext owns this");
		expect(writes.at(-1)).toBe(`\x1b]0;ext owns this\x07`);
		setTerminalTitleState("attention");
		expect(writes.at(-1)).toBe(`\x1b]0;ext owns this\x07`);
	});

	it("clears an extension override when an authoritative session title arrives", () => {
		setExtensionTerminalTitle("ext owns this");
		setSessionTerminalTitle("switched", "/tmp/switched");
		expect(writes.at(-1)).toBe(`\x1b]0;${BRAND} > switched\x07`);
	});

	it("does not let an extension override survive a session replacement", () => {
		// Every session-replacing path (new/switch/branch/handoff) must reassert the
		// authoritative title. This proves the clearing contract those call sites rely
		// on: without it the old session's extension title follows the user forever,
		// because emit always prefers an override.
		setSessionTerminalTitle("old-session", "/tmp/old");
		setExtensionTerminalTitle("ext title from old session");
		setTerminalTitleState("working");
		expect(writes.at(-1)).toBe(`\x1b]0;ext title from old session\x07`);

		setSessionTerminalTitle("new-session", "/tmp/new");
		expect(writes.at(-1)).not.toContain("ext title from old session");
		expect(writes.at(-1)).toContain("new-session");
	});

	it("renders the pre-state layout when the setting is disabled", () => {
		setTerminalTitleStateEnabled(false);
		setSessionTerminalTitle("myproj", "/tmp/myproj");
		expect(writes.at(-1)).toBe(`\x1b]0;${BRAND}: myproj\x07`);
	});

	it("falls back to the cwd basename when the session is unnamed", () => {
		setSessionTerminalTitle(undefined, "/tmp/fallback-name");
		expect(writes.at(-1)).toBe(`\x1b]0;${BRAND} > fallback-name\x07`);
	});

	it("strips control characters so a title cannot inject escapes", () => {
		setSessionTerminalTitle("evil\x07\x1b]0;pwned", "/tmp/x");
		expect(writes.at(-1)).toBe(`\x1b]0;${BRAND} > evil]0;pwned\x07`);
	});
});
