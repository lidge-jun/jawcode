import { native } from "../native.js";
import type { SessionState } from "../session.js";
import { BROWSER_BUNDLE_IDS } from "./bundleIds.js";
import { ERRORS } from "./errors.js";

export type ActionCategory = "mouse" | "mouse_full" | "keyboard" | "mouse_position";

// System UI processes that are always on-screen (Dock, menu bar, Finder).
// Clicks that land on these should pass through — they're not user app targets.
const SYSTEM_EXEMPT = new Set([
	"com.apple.finder",
	"com.apple.dock",
	"com.apple.systemuiserver",
	"com.apple.controlcenter",
	"com.apple.notificationcenterui",
	"com.apple.WindowManager",
]);

function isSystemExempt(bundleId: string): boolean {
	return SYSTEM_EXEMPT.has(bundleId);
}

/**
 * Pre-action tier enforcement.
 * Runs before EVERY mouse/keyboard action.
 * Returns error string if blocked, null if allowed.
 */
export async function enforcePreAction(session: SessionState, actionCategory: ActionCategory): Promise<string | null> {
	if (actionCategory === "mouse_position") return null;

	let frontmost: { bundleId: string; name: string } | null;
	try {
		frontmost = await native.appsFrontmost();
	} catch {
		return null; // Can't determine frontmost — allow
	}
	if (!frontmost) return null;

	if (isSystemExempt(frontmost.bundleId)) return null;

	// Not in allowlist
	if (!session.allowedApps.has(frontmost.bundleId)) {
		return ERRORS.NOT_IN_ALLOWLIST(frontmost.name);
	}

	const app = session.allowedApps.get(frontmost.bundleId)!;

	// Read tier — block ALL interaction
	if (app.tier === "read") {
		const isBrowser = BROWSER_BUNDLE_IDS.has(frontmost.bundleId);
		return ERRORS.READ_TIER_CLICK(app.displayName, isBrowser);
	}

	// Click tier — block keyboard and mouse_full
	if (app.tier === "click") {
		if (actionCategory === "keyboard") {
			return ERRORS.CLICK_TIER_KEYBOARD(app.displayName);
		}
		if (actionCategory === "mouse_full") {
			return ERRORS.CLICK_TIER_MOUSE_FULL(app.displayName);
		}
	}

	return null;
}

/**
 * Point-under-click validation.
 * Checks the ACTUAL app at target coordinates (not just frontmost).
 * Returns error string if blocked, null if allowed.
 */
export async function enforcePointUnderClick(
	session: SessionState,
	x: number,
	y: number,
	actionCategory: "mouse" | "mouse_full",
): Promise<string | null> {
	let app: { bundleId: string; name: string } | null;
	try {
		app = await native.appsUnderPoint(x, y);
	} catch {
		return null;
	}

	if (!app) return null;
	if (isSystemExempt(app.bundleId)) return null;

	if (!session.allowedApps.has(app.bundleId)) {
		return `Click would land on "${app.name}", which is not in the allowed applications.`;
	}

	const granted = session.allowedApps.get(app.bundleId)!;

	if (granted.tier === "read") {
		const isBrowser = BROWSER_BUNDLE_IDS.has(app.bundleId);
		return ERRORS.READ_TIER_CLICK(granted.displayName, isBrowser);
	}

	if (granted.tier === "click" && actionCategory === "mouse_full") {
		return ERRORS.CLICK_TIER_MOUSE_FULL(granted.displayName);
	}

	return null;
}
