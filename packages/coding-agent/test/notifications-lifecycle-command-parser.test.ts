import { describe, expect, it } from "bun:test";
import { parseNotificationLifecycleCommand } from "../src/notifications/lifecycle-command-parser";

describe("notification lifecycle command parser", () => {
	it("parses the supported lifecycle command intents", () => {
		expect(parseNotificationLifecycleCommand("/sessions")).toEqual({ ok: true, intent: { kind: "list" } });
		expect(parseNotificationLifecycleCommand("/new")).toEqual({ ok: true, intent: { kind: "new" } });
		expect(parseNotificationLifecycleCommand("/close")).toEqual({ ok: true, intent: { kind: "close_current" } });
		expect(parseNotificationLifecycleCommand("/resume safe-session_1")).toEqual({
			ok: true,
			intent: { kind: "resume", sessionId: "safe-session_1" },
		});
	});

	it("trims whitespace and accepts case-insensitive command names", () => {
		expect(parseNotificationLifecycleCommand("  /SESSIONS  ")).toEqual({ ok: true, intent: { kind: "list" } });
		expect(parseNotificationLifecycleCommand("\n/Resume Session.01\t")).toEqual({
			ok: true,
			intent: { kind: "resume", sessionId: "Session.01" },
		});
	});

	it("rejects empty, missing-slash, bare-slash, bot-suffix, and unknown commands", () => {
		expect(parseNotificationLifecycleCommand("")).toEqual({ ok: false, reason: "empty_command" });
		expect(parseNotificationLifecycleCommand("sessions")).toEqual({ ok: false, reason: "unknown_command" });
		expect(parseNotificationLifecycleCommand("/")).toEqual({ ok: false, reason: "unknown_command" });
		expect(parseNotificationLifecycleCommand("/sessions@JawBot")).toEqual({
			ok: false,
			reason: "unknown_command",
		});
		expect(parseNotificationLifecycleCommand("/delete")).toEqual({ ok: false, reason: "unknown_command" });
	});

	it("rejects unexpected arguments on non-argument commands", () => {
		expect(parseNotificationLifecycleCommand("/sessions all")).toEqual({
			ok: false,
			reason: "unexpected_arguments",
		});
		expect(parseNotificationLifecycleCommand("/new /tmp/project")).toEqual({
			ok: false,
			reason: "unexpected_arguments",
		});
		expect(parseNotificationLifecycleCommand("/close session-1")).toEqual({
			ok: false,
			reason: "unexpected_arguments",
		});
	});

	it("rejects missing or extra resume arguments", () => {
		expect(parseNotificationLifecycleCommand("/resume")).toEqual({ ok: false, reason: "missing_session_id" });
		expect(parseNotificationLifecycleCommand("/resume one two")).toEqual({
			ok: false,
			reason: "unexpected_arguments",
		});
	});

	it("rejects unsafe resume session ids", () => {
		const unsafeIds = [
			"repo:session",
			"../session",
			"session/id",
			".hidden",
			"session;rm",
			"session$HOME",
			"session|cat",
			`a${"b".repeat(128)}`,
		];

		for (const id of unsafeIds) {
			expect(parseNotificationLifecycleCommand(`/resume ${id}`)).toEqual({
				ok: false,
				reason: "unsafe_session_id",
			});
		}
	});

	it("does not encode prompt, cwd, env, or model fields in parser results", () => {
		const parsed = parseNotificationLifecycleCommand("/resume session-1");
		const json = JSON.stringify(parsed);

		expect(json).not.toContain("prompt");
		expect(json).not.toContain("cwd");
		expect(json).not.toContain("env");
		expect(json).not.toContain("model");
	});
});
