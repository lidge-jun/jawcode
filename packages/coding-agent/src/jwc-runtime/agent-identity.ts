import { settings } from "../config/settings";

/**
 * Single source of truth for the agent display name used by TUI labels and
 * injected identity text (085.6). `identity.name` (user setting) wins; the
 * hard fallback is the Jaw brand name.
 */
export function resolveAgentDisplayName(): string {
	try {
		const name = settings.get("identity.name");
		if (typeof name === "string" && name.trim().length > 0) return name.trim();
	} catch {
		// Settings not initialized (SDK/embedding path) — fall back to brand default.
	}
	return "Jaw";
}
