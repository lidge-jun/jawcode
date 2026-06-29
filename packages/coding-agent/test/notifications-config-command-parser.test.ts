import { describe, expect, it } from "bun:test";
import { parseNotificationConfigCommand } from "../src/notifications/config-command-parser";

describe("parseNotificationConfigCommand", () => {
	it("maps /verbose and /lean to set_verbosity", () => {
		expect(parseNotificationConfigCommand("/verbose")).toEqual({
			ok: true,
			intent: { kind: "set_verbosity", verbosity: "verbose" },
		});
		expect(parseNotificationConfigCommand("/lean")).toEqual({
			ok: true,
			intent: { kind: "set_verbosity", verbosity: "lean" },
		});
	});

	it("handles /verbosity show and set (case-insensitive)", () => {
		expect(parseNotificationConfigCommand("/verbosity")).toEqual({
			ok: true,
			intent: { kind: "show_verbosity" },
		});
		expect(parseNotificationConfigCommand("/verbosity verbose")).toEqual({
			ok: true,
			intent: { kind: "set_verbosity", verbosity: "verbose" },
		});
		expect(parseNotificationConfigCommand("/VERBOSITY LEAN")).toEqual({
			ok: true,
			intent: { kind: "set_verbosity", verbosity: "lean" },
		});
	});

	it("rejects bad verbosity arg and extra args", () => {
		expect(parseNotificationConfigCommand("/verbosity bogus")).toEqual({
			ok: false,
			reason: "invalid_verbosity",
		});
		expect(parseNotificationConfigCommand("/verbose x")).toEqual({
			ok: false,
			reason: "unexpected_arguments",
		});
	});

	it("handles /redact show and truthy/falsey set tokens", () => {
		expect(parseNotificationConfigCommand("/redact")).toEqual({
			ok: true,
			intent: { kind: "show_redact" },
		});
		for (const tok of ["on", "yes", "true", "1", "enable"]) {
			expect(parseNotificationConfigCommand(`/redact ${tok}`)).toEqual({
				ok: true,
				intent: { kind: "set_redact", redact: true },
			});
		}
		for (const tok of ["off", "no", "false", "0", "disable"]) {
			expect(parseNotificationConfigCommand(`/redact ${tok}`)).toEqual({
				ok: true,
				intent: { kind: "set_redact", redact: false },
			});
		}
	});

	it("rejects bad redact value and extra args", () => {
		expect(parseNotificationConfigCommand("/redact maybe")).toEqual({
			ok: false,
			reason: "invalid_redact_value",
		});
		expect(parseNotificationConfigCommand("/redact a b")).toEqual({
			ok: false,
			reason: "unexpected_arguments",
		});
	});

	it("rejects empty, non-slash, @mention, and unknown commands", () => {
		expect(parseNotificationConfigCommand("   ")).toEqual({ ok: false, reason: "empty_command" });
		expect(parseNotificationConfigCommand("verbose")).toEqual({ ok: false, reason: "unknown_command" });
		expect(parseNotificationConfigCommand("/redact@bot on")).toEqual({
			ok: false,
			reason: "unknown_command",
		});
		expect(parseNotificationConfigCommand("/bogus")).toEqual({ ok: false, reason: "unknown_command" });
	});
});
