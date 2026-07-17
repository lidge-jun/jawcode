export type TelegramControlCommandName = "reasoning" | "usage" | "context" | "compact";

export type TelegramControlCommand =
	| { name: "reasoning"; action: "cycle" | "status" | "set"; level?: string }
	| { name: "usage" }
	| { name: "context" }
	| { name: "compact"; instructions?: string };

export type TelegramControlCommandParseResult =
	| { kind: "none" }
	| { kind: "ignored"; commandName: TelegramControlCommandName }
	| { kind: "command"; command: TelegramControlCommand }
	| { kind: "invalid"; commandName: TelegramControlCommandName; usage: string };

export type TelegramRichCommandParseResult =
	| { kind: "none" }
	| { kind: "ignored" }
	| { kind: "show" }
	| { kind: "set"; enabled: boolean }
	| { kind: "invalid"; usage: string };

const CONTROL_COMMANDS = new Set<TelegramControlCommandName>(["reasoning", "usage", "context", "compact"]);
const REASONING_LEVELS = new Set(["inherit", "off", "minimal", "low", "medium", "high", "xhigh", "max"]);

function splitBotSuffix(rawCommand: string): { name: string; suffix?: string } {
	const [name = "", suffix] = rawCommand.toLowerCase().split("@", 2);
	return suffix ? { name, suffix } : { name };
}

function suffixMatches(suffix: string | undefined, botUsername: string | undefined): boolean {
	return suffix === undefined || (botUsername !== undefined && suffix === botUsername.toLowerCase());
}

export function telegramControlCommandUsage(commandName: TelegramControlCommandName): string {
	switch (commandName) {
		case "reasoning":
			return "Usage: /reasoning [cycle|inherit|off|minimal|low|medium|high|xhigh|max]";
		case "usage":
			return "Usage: /usage";
		case "context":
			return "Usage: /context";
		case "compact":
			return "Usage: /compact [instructions]";
	}
}

/** Parse deterministic Telegram session controls; recognized roots fail closed. */
export function parseTelegramControlCommand(text: string, botUsername?: string): TelegramControlCommandParseResult {
	const trimmed = text.trim();
	if (!trimmed.startsWith("/")) return { kind: "none" };
	const [rawRoot = "", ...args] = trimmed.slice(1).split(/\s+/);
	const { name, suffix } = splitBotSuffix(rawRoot);
	if (!CONTROL_COMMANDS.has(name as TelegramControlCommandName)) return { kind: "none" };
	const commandName = name as TelegramControlCommandName;
	if (!suffixMatches(suffix, botUsername)) return { kind: "ignored", commandName };
	const usage = telegramControlCommandUsage(commandName);

	switch (commandName) {
		case "usage":
		case "context":
			return args.length === 0
				? { kind: "command", command: { name: commandName } }
				: { kind: "invalid", commandName, usage };
		case "compact": {
			const instructions = trimmed.slice(rawRoot.length + 1).trim();
			return { kind: "command", command: instructions ? { name: "compact", instructions } : { name: "compact" } };
		}
		case "reasoning": {
			if (args.length === 0) return { kind: "command", command: { name: "reasoning", action: "status" } };
			if (args.length !== 1) return { kind: "invalid", commandName, usage };
			const value = (args[0] ?? "").toLowerCase();
			if (value === "cycle") return { kind: "command", command: { name: "reasoning", action: "cycle" } };
			if (REASONING_LEVELS.has(value)) {
				return { kind: "command", command: { name: "reasoning", action: "set", level: value } };
			}
			return { kind: "invalid", commandName, usage };
		}
	}
}

export function parseTelegramRichCommand(text: string, botUsername?: string): TelegramRichCommandParseResult {
	const trimmed = text.trim();
	if (!trimmed.startsWith("/")) return { kind: "none" };
	const [rawRoot = "", ...args] = trimmed.slice(1).split(/\s+/);
	const { name, suffix } = splitBotSuffix(rawRoot);
	if (name !== "rich") return { kind: "none" };
	if (!suffixMatches(suffix, botUsername)) return { kind: "ignored" };
	if (args.length === 0) return { kind: "show" };
	if (args.length !== 1) return { kind: "invalid", usage: "Usage: /rich [on|off]" };
	const value = (args[0] ?? "").toLowerCase();
	if (["on", "true", "1"].includes(value)) return { kind: "set", enabled: true };
	if (["off", "false", "0"].includes(value)) return { kind: "set", enabled: false };
	return { kind: "invalid", usage: "Usage: /rich [on|off]" };
}
