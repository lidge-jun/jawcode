import { Settings } from "../config/settings";
import {
	getNotificationConfig,
	maskChatId,
	maskToken,
	type NotificationVerbosity,
	toNotificationStatusJson,
} from "../notifications";

export type NotifyAction = "status" | "setup";

export interface NotifyCommandArgs {
	action: NotifyAction;
	token?: string;
	chatId?: string;
	redact?: boolean;
	verbosity?: NotificationVerbosity;
	flags: {
		json?: boolean;
	};
}

function parseBooleanValue(value: string | undefined, name: string): boolean | undefined {
	if (value === undefined) return undefined;
	const normalized = value.trim().toLowerCase();
	if (["true", "1", "yes", "on"].includes(normalized)) return true;
	if (["false", "0", "no", "off"].includes(normalized)) return false;
	throw new Error(`Invalid ${name}: ${value}. Use true/false.`);
}

function validateVerbosity(value: string | undefined): NotificationVerbosity | undefined {
	if (value === undefined) return undefined;
	if (value === "lean" || value === "verbose") return value;
	throw new Error(`Invalid verbosity: ${value}. Use lean or verbose.`);
}

export interface ParsedNotifyFlags {
	json: boolean;
	token: string | undefined;
	chatId: string | undefined;
	redact: boolean | undefined;
	verbosity: NotificationVerbosity | undefined;
}

export function parseNotifyFlags(raw: {
	json?: boolean;
	token?: string;
	chatId?: string;
	redact?: string;
	verbosity?: string;
}): ParsedNotifyFlags {
	return {
		json: raw.json ?? false,
		token: raw.token,
		chatId: raw.chatId,
		redact: parseBooleanValue(raw.redact, "redact"),
		verbosity: validateVerbosity(raw.verbosity),
	};
}

function formatStatus(config: ReturnType<typeof getNotificationConfig>): string {
	const lines = [
		"Notifications",
		`  Enabled: ${config.enabled ? "yes" : "no"}`,
		`  Configured: ${config.configured ? "yes" : "no"}`,
		`  Bot token: ${maskToken(config.botToken) ?? "(not set)"}`,
		`  Chat id: ${maskChatId(config.chatId) ?? "(not set)"}`,
		`  Redact: ${config.redact ? "yes" : "no"}`,
		`  Verbosity: ${config.verbosity}`,
		`  Daemon idle timeout: ${config.idleTimeoutMs}ms`,
	];
	return `${lines.join("\n")}\n`;
}

export async function runNotifyCommand(cmd: NotifyCommandArgs): Promise<void> {
	const settings = await Settings.init();

	if (cmd.action === "setup") {
		if (!cmd.token || !cmd.chatId) {
			throw new Error("Usage: jwc notify setup --token <token> --chat-id <id>");
		}
		settings.set("notifications.enabled", true);
		settings.set("notifications.telegram.botToken", cmd.token);
		settings.set("notifications.telegram.chatId", cmd.chatId);
		if (cmd.redact !== undefined) settings.set("notifications.redact", cmd.redact);
		if (cmd.verbosity !== undefined) settings.set("notifications.verbosity", cmd.verbosity);
		await settings.flush();
		const config = getNotificationConfig(settings);
		if (cmd.flags.json) {
			console.log(JSON.stringify(toNotificationStatusJson(config), null, 2));
		} else {
			console.log(`Notifications configured for ${maskChatId(config.chatId) ?? "(set)"}`);
			console.log(`Bot token: ${maskToken(config.botToken) ?? "(set)"}`);
		}
		return;
	}

	const config = getNotificationConfig(settings);
	if (cmd.flags.json) {
		console.log(JSON.stringify(toNotificationStatusJson(config), null, 2));
		return;
	}
	console.log(formatStatus(config));
}
