import { describe, expect, it } from "bun:test";
import {
	buildRemoteAskView,
	REDACTED_PLACEHOLDER,
	redactStreamText,
} from "../src/notifications/notification-redaction";

describe("redactStreamText", () => {
	it("returns text unchanged when redaction is off", () => {
		expect(redactStreamText("secret token sk-123", { redact: false })).toBe("secret token sk-123");
	});

	it("returns the placeholder for non-empty text when redaction is on", () => {
		expect(redactStreamText("secret token sk-123", { redact: true })).toBe(REDACTED_PLACEHOLDER);
	});

	it("returns empty string for empty/whitespace text when redaction is on", () => {
		expect(redactStreamText("   ", { redact: true })).toBe("");
		expect(redactStreamText("", { redact: true })).toBe("");
	});
});

describe("buildRemoteAskView", () => {
	const question = "Deploy to production now?";
	const options = ["Yes", "No", "Hold"];

	it("keeps question and options verbatim even when redaction is on (gate 4)", () => {
		const view = buildRemoteAskView({ question, options, policy: { redact: true } });
		expect(view.question).toBe(question);
		expect(view.options).toEqual(options);
	});

	it("redacts the lead-in when redaction is on but leaves question/options intact", () => {
		const view = buildRemoteAskView({
			question,
			options,
			leadIn: "I found credentials sk-live-abc in the file",
			policy: { redact: true },
		});
		expect(view.leadIn).toBe(REDACTED_PLACEHOLDER);
		expect(view.question).toBe(question);
		expect(view.options).toEqual(options);
	});

	it("passes the lead-in through verbatim when redaction is off", () => {
		const view = buildRemoteAskView({
			question,
			options,
			leadIn: "About to deploy the latest build.",
			policy: { redact: false },
		});
		expect(view.leadIn).toBe("About to deploy the latest build.");
	});

	it("omits an empty/whitespace lead-in and drops empty options", () => {
		const view = buildRemoteAskView({
			question,
			options: ["Yes", "  ", "No"],
			leadIn: "   ",
			policy: { redact: false },
		});
		expect(view.leadIn).toBeUndefined();
		expect(view.options).toEqual(["Yes", "No"]);
	});
});
