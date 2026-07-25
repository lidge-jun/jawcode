import { type SettingPath, settings } from "../../config/settings";

export type TerminalBellEvent = "complete" | "approval" | "ask";

type TerminalBellOutput = Pick<NodeJS.WriteStream, "write">;

const BEL = "\x07";

function getBellSetting(key: SettingPath): boolean {
	try {
		return Boolean(settings.get(key));
	} catch {
		// Some component-level tests exercise UI helpers before Settings.init().
		// Terminal bells are best-effort local notifications only.
		return false;
	}
}

function enabledForEvent(event: TerminalBellEvent): boolean {
	if (!getBellSetting("notifications.terminalBell")) return false;
	switch (event) {
		case "complete":
			return getBellSetting("notifications.bellOnComplete");
		case "approval":
			return getBellSetting("notifications.bellOnApproval");
		case "ask":
			return getBellSetting("notifications.bellOnAsk");
	}
}

export function ringTerminalBell(event: TerminalBellEvent, output: TerminalBellOutput = process.stdout): void {
	if (!enabledForEvent(event)) return;
	try {
		output.write(BEL);
	} catch {
		// Best-effort local notification only.
	}
}

export function classifyHookSelectorBellEvent(title: string): TerminalBellEvent {
	const normalized = title.toLowerCase();
	if (normalized.includes("approval") || normalized.includes("approve") || normalized.includes("plan ready")) {
		return "approval";
	}
	return "ask";
}
