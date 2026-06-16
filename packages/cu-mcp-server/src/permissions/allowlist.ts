import type { SessionState } from "../session.js";

/**
 * Build the comma-separated allowed bundle IDs string for native screenshot.
 * Includes all granted apps (any tier can see screenshots).
 */
export function getAllowedBundleIds(session: SessionState): string {
	return [...session.allowedApps.keys()].join(",");
}

/**
 * Generate hidden-app notification string (Anthropic format).
 * Lists apps that were visible but not in the allowlist.
 */
export function hiddenAppsNotification(hidden: string[]): string | null {
	if (hidden.length === 0) return null;
	return `[System: ${hidden.length} application(s) were hidden because they are not in the allowed list: ${hidden.join(", ")}. Call request_access to add them.]`;
}

/**
 * Generate display-switch notification.
 */
export function displaySwitchNotification(prevDisplayId: number | null, currentDisplayId: number): string | null {
	if (prevDisplayId === null || prevDisplayId === currentDisplayId) return null;
	return `[System: Screenshot taken on display ${currentDisplayId} (switched from display ${prevDisplayId}).]`;
}
