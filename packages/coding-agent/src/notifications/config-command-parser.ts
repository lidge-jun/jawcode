import type { NotificationVerbosity } from "./config";

/**
 * In-thread notification config command parser (chase 10.032): `/verbose`,
 * `/lean`, `/verbosity [lean|verbose]`, `/redact [on|off|...]`. Mirrors the
 * lifecycle-command-parser pattern. Pure / side-effect-free and intent-only —
 * applying an intent to Settings is the caller's responsibility.
 */

export type NotificationConfigCommandIntent =
	| { kind: "set_verbosity"; verbosity: NotificationVerbosity }
	| { kind: "show_verbosity" }
	| { kind: "set_redact"; redact: boolean }
	| { kind: "show_redact" };

export type NotificationConfigCommandRejectionReason =
	| "empty_command"
	| "unknown_command"
	| "unexpected_arguments"
	| "invalid_verbosity"
	| "invalid_redact_value";

export type ParseNotificationConfigCommandResult =
	| { ok: true; intent: NotificationConfigCommandIntent }
	| { ok: false; reason: NotificationConfigCommandRejectionReason };

const TRUE_TOKENS = new Set(["on", "yes", "true", "1", "enable", "enabled"]);
const FALSE_TOKENS = new Set(["off", "no", "false", "0", "disable", "disabled"]);

function commandName(token: string): string | undefined {
	if (!token.startsWith("/") || token.length === 1 || token.includes("@")) return undefined;
	return token.slice(1).toLowerCase();
}

function parseRedactValue(token: string): boolean | undefined {
	const normalized = token.toLowerCase();
	if (TRUE_TOKENS.has(normalized)) return true;
	if (FALSE_TOKENS.has(normalized)) return false;
	return undefined;
}

export function parseNotificationConfigCommand(input: string): ParseNotificationConfigCommandResult {
	const trimmed = input.trim();
	if (trimmed.length === 0) return { ok: false, reason: "empty_command" };

	const [commandToken, ...args] = trimmed.split(/\s+/);
	const command = commandName(commandToken ?? "");
	if (!command) return { ok: false, reason: "unknown_command" };

	switch (command) {
		case "verbose":
			if (args.length > 0) return { ok: false, reason: "unexpected_arguments" };
			return { ok: true, intent: { kind: "set_verbosity", verbosity: "verbose" } };
		case "lean":
			if (args.length > 0) return { ok: false, reason: "unexpected_arguments" };
			return { ok: true, intent: { kind: "set_verbosity", verbosity: "lean" } };
		case "verbosity": {
			if (args.length === 0) return { ok: true, intent: { kind: "show_verbosity" } };
			if (args.length > 1) return { ok: false, reason: "unexpected_arguments" };
			const value = (args[0] ?? "").toLowerCase();
			if (value !== "lean" && value !== "verbose") {
				return { ok: false, reason: "invalid_verbosity" };
			}
			return { ok: true, intent: { kind: "set_verbosity", verbosity: value } };
		}
		case "redact": {
			if (args.length === 0) return { ok: true, intent: { kind: "show_redact" } };
			if (args.length > 1) return { ok: false, reason: "unexpected_arguments" };
			const redact = parseRedactValue(args[0] ?? "");
			if (redact === undefined) return { ok: false, reason: "invalid_redact_value" };
			return { ok: true, intent: { kind: "set_redact", redact } };
		}
		default:
			return { ok: false, reason: "unknown_command" };
	}
}
