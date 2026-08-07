/**
 * Title generation must resolve credentials under the same session key as
 * every other request in the session.
 *
 * Credential selection is session-sticky: `AuthStorage` keys its pinned
 * credential on the session id, which is what keeps a multi-account setup on
 * one account and its prompt cache warm. The title request passed
 * `sessionManager.getSessionId()` directly, but `AgentSession.sessionId`
 * resolves `#providerSessionId ?? sessionManager.getSessionId()` — so whenever
 * a provider session id was set, the title request looked like a *different*
 * session and defeated the stickiness.
 *
 * Upstream tracked this as oh-my-pi `e3b117678`.
 */
import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

const SESSION_SRC = path.join(import.meta.dir, "..", "src", "session", "agent-session.ts");

function generateTitleBody(): string {
	const source = fs.readFileSync(SESSION_SRC, "utf-8");
	const start = source.indexOf("async generateTitle(firstMessage: string)");
	expect(start).toBeGreaterThan(-1);
	return source.slice(start, source.indexOf("\n\t}", start));
}

describe("title generation session identity", () => {
	it("resolves credentials through the provider-aware session id", () => {
		const body = generateTitleBody();
		expect(body).toContain("const sessionId = this.sessionId;");
	});

	it("keeps the staleness guard comparing the session-file id it captured", () => {
		// The guard detects a session switch during the await. It must compare
		// like with like — reusing the provider-aware id here would compare a
		// provider session id against a session-file id and never match.
		const body = generateTitleBody();
		expect(body).toContain("const sessionFileId = this.sessionManager.getSessionId();");
		expect(body).toContain("sessionFileId !== this.sessionManager.getSessionId()");
	});

	it("cancels an in-flight title request when the session disposes", () => {
		// oh-my-pi 3cb925887, already satisfied here: dispose() bumps the
		// generation counter and aborts the controller whose signal the request
		// carries. Pinned so it cannot regress silently.
		const source = fs.readFileSync(SESSION_SRC, "utf-8");
		const dispose = source.slice(source.indexOf("async dispose(): Promise<void> {"));
		expect(dispose.slice(0, dispose.indexOf("\n\t}"))).toContain("this.#cancelTitleGeneration();");

		const cancel = source.slice(source.indexOf("#cancelTitleGeneration(): void {"));
		const cancelBody = cancel.slice(0, cancel.indexOf("\n\t}"));
		expect(cancelBody).toContain("this.#titleGeneration++;");
		expect(cancelBody).toContain("this.#titleGenerationAbortController.abort();");
	});

	it("passes the abort signal into the title request", () => {
		const body = generateTitleBody();
		expect(body).toContain("const signal = this.#titleGenerationAbortController.signal;");
		expect(body).toContain("signal.aborted");
	});
});
