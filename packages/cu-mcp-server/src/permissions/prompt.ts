import type { SessionState } from "../session.js";

/**
 * Permission prompt for terminal-based approval.
 * In headless/CLI mode, auto-approves.
 * In a future terminal UI mode, would show interactive prompt.
 */
export async function promptPermissions(
	_session: SessionState,
	_apps: Array<{ bundleId: string; displayName: string; tier: string }>,
	_additionalGrants: { clipboardRead?: boolean; clipboardWrite?: boolean; systemKeyCombos?: boolean },
): Promise<boolean> {
	// Auto-approve in CLI mode (no terminal UI yet)
	// Phase 3.7 of the plan describes a full terminal UI with [Allow]/[Deny]
	return true;
}
