/**
 * A turn that dies on a provider error must leave an actionable trace in the
 * MAIN log, not only in the session transcript.
 *
 * Before this, the error fields lived on the assistant message and were never
 * logged, so a session failing repeatedly on provider stream errors looked
 * silent to anyone reading the log.
 */
import { afterEach, describe, expect, it, vi } from "bun:test";
import type { AssistantMessage } from "@jawcode-dev/ai";
import { logger } from "@jawcode-dev/utils";
import { logProviderTurnError, redactProviderErrorMessage } from "../src/session/agent-session";

function makeMessage(overrides: Partial<AssistantMessage>): AssistantMessage {
	return {
		role: "assistant",
		content: [],
		usage: { inputTokens: 0, outputTokens: 0 },
		timestamp: Date.now(),
		...overrides,
	} as unknown as AssistantMessage;
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("logProviderTurnError", () => {
	it("emits one warn carrying the provider error identifiers", () => {
		const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});

		logProviderTurnError(
			makeMessage({
				stopReason: "error",
				provider: "anthropic",
				model: "claude-x",
				errorMessage: "stream closed",
				errorStatus: 503,
				// JWC's AssistantErrorKind is a narrow union; this is its only member.
				errorKind: "provider_safety_stop",
			}),
		);

		expect(warn).toHaveBeenCalledTimes(1);
		const [message, fields] = warn.mock.calls[0] ?? [];
		expect(message).toContain("provider error");
		// The identifiers are the point: without them the log says a turn failed
		// but not why, which is what made recurring failures undiagnosable.
		expect(fields).toMatchObject({
			provider: "anthropic",
			model: "claude-x",
			errorMessage: "stream closed",
			errorStatus: 503,
			errorKind: "provider_safety_stop",
		});
	});

	it("stays silent for a normal stop", () => {
		const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
		logProviderTurnError(makeMessage({ stopReason: "stop", provider: "anthropic" }));
		expect(warn).not.toHaveBeenCalled();
	});

	it("stays silent for an abort, which is a user action rather than a failure", () => {
		const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
		logProviderTurnError(makeMessage({ stopReason: "aborted", provider: "anthropic" }));
		expect(warn).not.toHaveBeenCalled();
	});

	it("redacts the raw provider message before it reaches the log", () => {
		const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});

		logProviderTurnError(
			makeMessage({
				stopReason: "error",
				provider: "anthropic",
				model: "claude-x",
				errorMessage: '401 for user dev@example.com: {"authorization":"Bearer sk-live-AAAABBBBCCCCDDDD"}',
			}),
		);

		const [, fields] = warn.mock.calls[0] ?? [];
		const logged = (fields as { errorMessage?: string }).errorMessage ?? "";
		expect(logged).not.toContain("sk-live-AAAABBBBCCCCDDDD");
		expect(logged).not.toContain("dev@example.com");
		// The status context has to survive, otherwise redaction destroys the
		// diagnostic value the log line exists for.
		expect(logged).toContain("401");
	});
});

/**
 * The raw provider string is provider- and attacker-influenced and routinely
 * echoes the failing request. The log is plaintext and gets pasted into bug
 * reports, so anything credential- or identity-shaped must not survive it.
 */
describe("redactProviderErrorMessage", () => {
	it("leaves an absent message absent rather than turning it into an empty string", () => {
		expect(redactProviderErrorMessage(undefined)).toBeUndefined();
	});

	it("passes an ordinary provider error through untouched", () => {
		expect(redactProviderErrorMessage("upstream connect error: stream closed")).toBe(
			"upstream connect error: stream closed",
		);
	});

	it("redacts Authorization header credentials", () => {
		const redacted = redactProviderErrorMessage("Authorization: Bearer sk-live-AAAABBBBCCCCDDDD rejected") ?? "";
		expect(redacted).not.toContain("sk-live-AAAABBBBCCCCDDDD");
		expect(redacted).toContain("rejected");
	});

	it("redacts key-bearing URL query parameters while keeping the endpoint readable", () => {
		const redacted =
			redactProviderErrorMessage("GET https://api.example.com/v1/models?api_key=SECRETVALUE123&limit=20 failed") ??
			"";
		expect(redacted).not.toContain("SECRETVALUE123");
		expect(redacted).toContain("https://api.example.com/v1/models");
		// A non-secret param carries useful request shape and should remain.
		expect(redacted).toContain("limit=20");
	});

	it("redacts JSON credential fields", () => {
		const redacted = redactProviderErrorMessage('{"api_key": "AAAABBBBCCCCDDDD", "model": "claude-x"}') ?? "";
		expect(redacted).not.toContain("AAAABBBBCCCCDDDD");
		expect(redacted).toContain("claude-x");
	});

	it("redacts bare provider key literals", () => {
		expect(redactProviderErrorMessage("token sk-ABCDEFGH12345678 is invalid") ?? "").not.toContain(
			"sk-ABCDEFGH12345678",
		);
		expect(redactProviderErrorMessage("ghp_ABCDEFGH12345678 expired") ?? "").not.toContain("ghp_ABCDEFGH12345678");
		expect(redactProviderErrorMessage("key AIzaABCDEFGH12345678 denied") ?? "").not.toContain("AIzaABCDEFGH12345678");
	});

	it("redacts account email addresses", () => {
		const redacted = redactProviderErrorMessage("no credit for account jun@example.co.kr") ?? "";
		expect(redacted).not.toContain("jun@example.co.kr");
		expect(redacted).toContain("no credit for account");
	});

	it("bounds an oversized payload so one error cannot flood the log", () => {
		const huge = `head ${"x".repeat(5000)}`;
		const redacted = redactProviderErrorMessage(huge) ?? "";
		expect(redacted.length).toBeLessThan(huge.length);
		expect(redacted).toContain("truncated");
		expect(redacted.startsWith("head ")).toBe(true);
	});
});
