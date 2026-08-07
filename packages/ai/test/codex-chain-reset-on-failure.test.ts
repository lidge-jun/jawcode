/**
 * A failed Codex turn must not leave a poisoned chain baseline behind.
 *
 * Stateful chaining rides `state.lastResponseId`: when it is set, the next
 * request sends only the delta and references the previous response. If a
 * request fails for a reason the server attributes to the *baseline* — a
 * blocked prompt, an expired previous response — and the id survives, every
 * subsequent request replays the same broken reference and the session wedges.
 *
 * Upstream widened a chain-reset guard for this (oh-my-pi `c55196eb3`). JWC
 * cannot hit it: the failure path clears the append state unconditionally, so
 * the next request already falls back to full context. That is a property
 * worth pinning rather than re-deriving — it is easy to "optimize" a reset
 * away when its purpose is invisible.
 */
import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

const PROVIDER_SOURCE = path.join(import.meta.dir, "..", "src", "providers", "openai-codex-responses.ts");

function source(): string {
	return fs.readFileSync(PROVIDER_SOURCE, "utf-8");
}

function bodyOf(signature: string): string {
	const src = source();
	const start = src.indexOf(signature);
	expect(start).toBeGreaterThan(-1);
	return src.slice(start, src.indexOf("\n}", start));
}

describe("codex chain reset on failure", () => {
	it("clears the chain baseline when a turn fails", () => {
		const failure = bodyOf("async function handleCodexStreamFailure(");
		expect(failure).toContain("resetCodexWebSocketAppendState(");
		expect(failure).toContain("resetCodexSessionMetadata(");
	});

	it("drops lastResponseId as part of that reset", () => {
		// This is the field the next request chains from. Clearing turnState alone
		// would not be enough.
		const reset = bodyOf("function resetCodexWebSocketAppendState(");
		expect(reset).toContain("state.lastResponseId = undefined;");
		expect(reset).toContain("state.canAppend = false;");
	});

	it("only chains when a baseline id survives", () => {
		// The delta request is conditional on lastResponseId, so clearing it is
		// what makes the next request send full context.
		expect(source()).toContain("if (appendInput && appendInput.length > 0 && state?.lastResponseId) {");
	});

	it("resets regardless of transport", () => {
		// websocketState is built from the session key, not from the transport
		// choice, so an SSE turn carries it too and takes the same reset.
		expect(source()).toContain(
			"sessionKey && providerSessionState ? getCodexWebSocketSessionState(sessionKey, providerSessionState) : undefined",
		);
	});
});
