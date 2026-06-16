// Exact error message templates from conf3.md live extraction

const APPLESCRIPT_SUFFIX =
	" Do not attempt to work around this restriction — never use AppleScript, System Events, shell commands, or any other method to send clicks or keystrokes to this app.";

export const ERRORS = {
	NOT_IN_ALLOWLIST: (appName: string) =>
		`"${appName}" is not in the allowed applications and is currently in front. Take a new screenshot — it may have appeared since your last one.`,

	READ_TIER_CLICK: (appName: string, isBrowser: boolean) =>
		`Click at these coordinates would land on "${appName}", which is granted at tier "read" (screenshots only, no interaction).${isBrowser ? " Use the Claude-in-Chrome MCP for browser interaction." : ""}${APPLESCRIPT_SUFFIX}`,

	CLICK_TIER_KEYBOARD: (appName: string) =>
		`"${appName}" is granted at tier "click" — typing and key presses require tier "full". For shell commands, use the Bash tool.${APPLESCRIPT_SUFFIX}`,

	CLICK_TIER_MOUSE_FULL: (appName: string) =>
		`"${appName}" is granted at tier "click" — right-click, middle-click, and clicks with modifier keys require tier "full". Right-click opens a context menu with Paste/Cut, and modifier chords fire as keystrokes before the click. Plain left_click is allowed here.${APPLESCRIPT_SUFFIX}`,

	SYSTEM_KEY_COMBO: (combo: string) =>
		`"${combo}" is a system-level shortcut. Request the \`systemKeyCombos\` grant via request_access to use it.`,

	NO_ALLOWLIST: () => `No apps in allowlist. Call request_access first.`,

	CLIPBOARD_READ_REQUIRED: () => `Requires the \`clipboardRead\` grant.`,

	CLIPBOARD_WRITE_REQUIRED: () => `Requires the \`clipboardWrite\` grant.`,

	MOUSE_ALREADY_HELD: () => `Mouse button is already held. Call left_mouse_up first.`,

	MEDIA_APP_BLOCKED: (appName: string) =>
		`"${appName}" is a media application and cannot be granted computer use access.`,
} as const;
