import { FILESYSTEM_SENTINELS, SHELL_SENTINELS, SYSTEM_SETTINGS_SENTINELS } from "../safety/bundleIds.js";

export type SentinelWarning = "shell" | "filesystem" | "system_settings";

/**
 * Check if a bundle ID triggers a sentinel warning.
 * Sentinel warnings are shown to the user during permission prompts
 * to highlight potentially dangerous app access.
 */
export function getSentinelWarnings(bundleId: string): SentinelWarning[] {
	const warnings: SentinelWarning[] = [];
	if (SHELL_SENTINELS.has(bundleId)) warnings.push("shell");
	if (FILESYSTEM_SENTINELS.has(bundleId)) warnings.push("filesystem");
	if (SYSTEM_SETTINGS_SENTINELS.has(bundleId)) warnings.push("system_settings");
	return warnings;
}

/**
 * Format sentinel warning for display.
 */
export function formatSentinelWarning(warning: SentinelWarning): string {
	switch (warning) {
		case "shell":
			return "⚠ This app provides shell access (equivalent to full system control)";
		case "filesystem":
			return "⚠ This app provides filesystem access";
		case "system_settings":
			return "⚠ This app can modify system settings";
	}
}
