const SAFE_SESSION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export type NotificationLifecycleCommandIntent =
	| { kind: "list" }
	| { kind: "new" }
	| { kind: "close_current" }
	| { kind: "resume"; sessionId: string };

export type NotificationLifecycleCommandRejectionReason =
	| "empty_command"
	| "unknown_command"
	| "unexpected_arguments"
	| "missing_session_id"
	| "unsafe_session_id";

export type ParseNotificationLifecycleCommandResult =
	| { ok: true; intent: NotificationLifecycleCommandIntent }
	| { ok: false; reason: NotificationLifecycleCommandRejectionReason };

function commandName(token: string): string | undefined {
	if (!token.startsWith("/") || token.length === 1 || token.includes("@")) return undefined;
	return token.slice(1).toLowerCase();
}

export function parseNotificationLifecycleCommand(input: string): ParseNotificationLifecycleCommandResult {
	const trimmed = input.trim();
	if (trimmed.length === 0) return { ok: false, reason: "empty_command" };

	const [commandToken, ...args] = trimmed.split(/\s+/);
	const command = commandName(commandToken ?? "");
	if (!command) return { ok: false, reason: "unknown_command" };

	switch (command) {
		case "sessions":
			if (args.length > 0) return { ok: false, reason: "unexpected_arguments" };
			return { ok: true, intent: { kind: "list" } };
		case "new":
			if (args.length > 0) return { ok: false, reason: "unexpected_arguments" };
			return { ok: true, intent: { kind: "new" } };
		case "close":
			if (args.length > 0) return { ok: false, reason: "unexpected_arguments" };
			return { ok: true, intent: { kind: "close_current" } };
		case "resume":
			if (args.length === 0) return { ok: false, reason: "missing_session_id" };
			if (args.length > 1) return { ok: false, reason: "unexpected_arguments" };
			if (!SAFE_SESSION_ID_RE.test(args[0] ?? "")) return { ok: false, reason: "unsafe_session_id" };
			return { ok: true, intent: { kind: "resume", sessionId: args[0] } };
		default:
			return { ok: false, reason: "unknown_command" };
	}
}
