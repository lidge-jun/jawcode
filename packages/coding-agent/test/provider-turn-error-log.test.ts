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
import { logProviderTurnError } from "../src/session/agent-session";

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
});
