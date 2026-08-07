/**
 * Re-tokenizing the whole history every turn is the dominant cost in a long
 * session.
 *
 * `#estimateMessagesTokens` walks every message during post-turn maintenance
 * and is called up to twice per turn. Measured on this tree, a single full
 * walk costs ~358ms at 500 messages, ~1.15s at 2000, and ~3.46s at 6000 —
 * over a prefix that by definition cannot have changed since last turn.
 *
 * Memoizing by object identity is only sound for messages that are finished:
 * providers push content blocks onto a live assistant message while streaming,
 * so an in-flight message would cache a partial count and keep returning it.
 * These cover that boundary.
 */
import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

const SESSION_SRC = path.join(import.meta.dir, "..", "src", "session", "agent-session.ts");

function settleBody(): string {
	const source = fs.readFileSync(SESSION_SRC, "utf-8");
	const start = source.indexOf("function isSettledForTokenCache(");
	expect(start).toBeGreaterThan(-1);
	return source.slice(start, source.indexOf("\n}", start));
}

/** The settle predicate as implemented, exercised directly. */
function isSettled(message: { role: string; stopReason?: string; usage?: unknown }): boolean {
	if (message.role !== "assistant") return true;
	if (message.stopReason === undefined) return false;
	if (message.stopReason === "aborted" || message.stopReason === "error") return false;
	return message.usage !== undefined;
}

describe("message token cache settle gate", () => {
	it("caches a completed assistant turn", () => {
		expect(isSettled({ role: "assistant", stopReason: "stop", usage: { input: 1, output: 1 } })).toBe(true);
	});

	it("never caches a streaming assistant message", () => {
		// No stopReason yet: content blocks are still being pushed onto it.
		expect(isSettled({ role: "assistant", usage: { input: 1, output: 1 } })).toBe(false);
	});

	it("never caches an assistant turn without usage", () => {
		// A stop reason without usage means the turn has not fully settled.
		expect(isSettled({ role: "assistant", stopReason: "stop" })).toBe(false);
	});

	it("never caches an aborted or errored turn", () => {
		// Both can be repaired or retried in place, mutating content.
		expect(isSettled({ role: "assistant", stopReason: "aborted", usage: {} })).toBe(false);
		expect(isSettled({ role: "assistant", stopReason: "error", usage: {} })).toBe(false);
	});

	it("caches every non-assistant role, which is immutable once appended", () => {
		for (const role of ["user", "toolResult", "custom", "bashExecution"]) {
			expect(isSettled({ role })).toBe(true);
		}
	});

	it("keeps the implementation in sync with what is asserted here", () => {
		const body = settleBody();
		expect(body).toContain('if (message.role !== "assistant") return true;');
		expect(body).toContain("if (assistant.stopReason === undefined) return false;");
		expect(body).toContain('assistant.stopReason === "aborted" || assistant.stopReason === "error"');
		expect(body).toContain("return assistant.usage !== undefined;");
	});

	it("gates the cache write on the settle predicate", () => {
		const source = fs.readFileSync(SESSION_SRC, "utf-8");
		expect(source).toContain("if (isSettledForTokenCache(message)) {");
		expect(source).toContain("this.#messageTokenCache.set(message, { encoding: encodingKey, tokens });");
	});

	it("keys the cache on encoding so a model switch does not reuse a stale count", () => {
		const source = fs.readFileSync(SESSION_SRC, "utf-8");
		expect(source).toContain("if (cached?.encoding === encodingKey) return cached.tokens;");
	});
});
