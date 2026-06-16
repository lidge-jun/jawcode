import { BROWSER_BUNDLE_IDS, MEDIA_BUNDLE_IDS, TERMINAL_BUNDLE_IDS, TRADING_BUNDLE_IDS } from "./bundleIds.js";

export type AppCategory = "browser" | "terminal" | "trading" | "media" | "other";
export type AppTier = "full" | "click" | "read";

export function getAppCategory(bundleId: string): AppCategory {
	if (BROWSER_BUNDLE_IDS.has(bundleId)) return "browser";
	if (TERMINAL_BUNDLE_IDS.has(bundleId)) return "terminal";
	if (TRADING_BUNDLE_IDS.has(bundleId)) return "trading";
	if (MEDIA_BUNDLE_IDS.has(bundleId)) return "media";
	return "other";
}

/**
 * Personal-use override: when CU_TIER_OVERRIDE=full, every app — including
 * browsers, terminals, trading, and media — is granted "full" tier, bypassing
 * the deterministic safety tiers. Single-user trusted machines only (e.g. jwc).
 * Default (env unset) keeps the safe tiers so multi-provider hosts stay
 * safe-by-construction. System key-combo blocking (isSystemKeyCombo) is
 * independent of this and still requires the separate systemKeyCombos grant.
 */
export function isFullTierOverride(): boolean {
	return process.env.CU_TIER_OVERRIDE === "full";
}

/**
 * Map category → tier.
 * AUDIT FIX: media category must NOT fall through to "full".
 * Media apps are blocked at the request_access level, but if somehow
 * reached here, they get "read" (most restrictive non-deny tier).
 */
export function categoryToTier(category: AppCategory): AppTier | null {
	if (isFullTierOverride()) return "full"; // personal-use: everything full, incl. media
	if (category === "browser" || category === "trading") return "read";
	if (category === "terminal") return "click";
	if (category === "media") return null; // BLOCKED — deny at request_access
	return "full";
}

export function getAppTier(bundleId: string): AppTier | null {
	return categoryToTier(getAppCategory(bundleId));
}

// System key combos — blocked unless systemKeyCombos grant is active.
// Stored in NORMALIZED form (aliases resolved + sorted) to avoid sort mismatch.
const BLOCKED_SYSTEM_COMBOS_MAC = new Set([
	"meta+q", // Cmd+Q (quit)
	"meta+q+shift", // Cmd+Shift+Q (logout)
	"alt+escape+meta", // Cmd+Option+Esc (force quit)
	"meta+tab", // Cmd+Tab (app switch)
	"meta+space", // Cmd+Space (spotlight)
	"ctrl+meta+q", // Ctrl+Cmd+Q (lock screen)
]);

function normalizeChord(chord: string): string {
	return chord
		.toLowerCase()
		.split("+")
		.map(s => s.trim())
		.map(s => {
			if (s === "command" || s === "cmd" || s === "super") return "meta";
			if (s === "option" || s === "opt") return "alt";
			if (s === "control") return "ctrl";
			if (s === "esc") return "escape";
			if (s === "enter") return "return";
			return s;
		})
		.sort()
		.join("+");
}

export function isSystemKeyCombo(chord: string): boolean {
	return BLOCKED_SYSTEM_COMBOS_MAC.has(normalizeChord(chord));
}
