/**
 * `--continue` must not resurrect a transcript the user cleared.
 *
 * New-session persistence is lazy: after `/new` the JSONL is not created until
 * there is something to write. The terminal breadcrumb still points at that
 * not-yet-materialized path, and the reader rejected a breadcrumb whose target
 * was missing. `continueRecent` then fell back to "most recent session in this
 * directory" — the transcript from BEFORE `/new`.
 *
 * So: start a session, clear it, quit before the model says anything, and
 * `--continue` hands the old conversation back. Upstream tracked this as
 * oh-my-pi `447eb51f2`.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { SessionManager } from "@jawcode-dev/coding-agent/session/session-manager";
import { Snowflake } from "@jawcode-dev/utils";

let tempDir: string;
let sessionDir: string;
let previousTerminalId: string | undefined;
let previousConfigDir: string | undefined;

beforeEach(() => {
	tempDir = path.join(os.tmpdir(), `jwc-continue-fresh-${Snowflake.next()}`);
	sessionDir = path.join(tempDir, "sessions");
	fs.mkdirSync(sessionDir, { recursive: true });

	// A stable per-terminal id, and an isolated config root so the breadcrumb
	// does not touch the developer's real ~/.jwc.
	previousTerminalId = Bun.env.TERM_SESSION_ID;
	previousConfigDir = Bun.env.JWC_CODING_AGENT_DIR;
	process.env.TERM_SESSION_ID = `jwc-test-${Snowflake.next()}`;
	process.env.JWC_CODING_AGENT_DIR = path.join(tempDir, "agent");
});

afterEach(() => {
	if (previousTerminalId === undefined) delete process.env.TERM_SESSION_ID;
	else process.env.TERM_SESSION_ID = previousTerminalId;
	if (previousConfigDir === undefined) delete process.env.JWC_CODING_AGENT_DIR;
	else process.env.JWC_CODING_AGENT_DIR = previousConfigDir;
	if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("continueRecent after a cleared session", () => {
	it("does not resurrect the pre-/new transcript when the fresh session never materialized", async () => {
		// A first session with real content on disk.
		const first = SessionManager.create(tempDir, sessionDir);
		first.appendMessage({
			role: "user",
			content: "secret from the old conversation",
			timestamp: Date.now(),
		} as never);
		// Persistence is lazy until an assistant message exists (`_persist`), which
		// is the very asymmetry this bug lives in.
		first.appendMessage({
			role: "assistant",
			content: [{ type: "text", text: "old reply" }],
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: { total: 0 } },
			timestamp: Date.now(),
		} as never);
		await first.flush();
		const firstFile = first.getSessionFile();
		expect(firstFile).toBeDefined();
		if (!firstFile) return;
		expect(fs.existsSync(firstFile)).toBe(true);

		// `/new`: a fresh session whose file is not written yet.
		const fresh = SessionManager.create(tempDir, sessionDir);
		const freshFile = fresh.getSessionFile();
		expect(freshFile).toBeDefined();
		if (!freshFile) return;
		expect(freshFile).not.toBe(firstFile);
		expect(fs.existsSync(freshFile)).toBe(false);

		// Quit, then `--continue`.
		const resumed = await SessionManager.continueRecent(tempDir, sessionDir);
		const resumedEntries = resumed.getEntries();
		const resurrected = resumedEntries.some(entry =>
			JSON.stringify(entry).includes("secret from the old conversation"),
		);

		expect(resurrected).toBe(false);
	});

	it("still continues the breadcrumbed session when it did materialize", async () => {
		// The guard must not turn --continue into "always start fresh".
		const first = SessionManager.create(tempDir, sessionDir);
		first.appendMessage({ role: "user", content: "keep this conversation", timestamp: Date.now() } as never);
		first.appendMessage({
			role: "assistant",
			content: [{ type: "text", text: "sure" }],
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: { total: 0 } },
			timestamp: Date.now(),
		} as never);
		await first.flush();

		const resumed = await SessionManager.continueRecent(tempDir, sessionDir);
		const continued = resumed.getEntries().some(entry => JSON.stringify(entry).includes("keep this conversation"));

		expect(continued).toBe(true);
		expect(resumed.getSessionFile()).toBe(first.getSessionFile());
	});

	it("falls back to the most recent session when this terminal has no breadcrumb", async () => {
		// A brand-new terminal has no breadcrumb at all, which is a different case
		// from a breadcrumb pointing at an unmaterialized file.
		const first = SessionManager.create(tempDir, sessionDir);
		first.appendMessage({ role: "user", content: "earlier work", timestamp: Date.now() } as never);
		first.appendMessage({
			role: "assistant",
			content: [{ type: "text", text: "noted" }],
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: { total: 0 } },
			timestamp: Date.now(),
		} as never);
		await first.flush();

		process.env.TERM_SESSION_ID = `jwc-test-other-${Snowflake.next()}`;

		const resumed = await SessionManager.continueRecent(tempDir, sessionDir);
		expect(resumed.getEntries().some(entry => JSON.stringify(entry).includes("earlier work"))).toBe(true);
	});
});
