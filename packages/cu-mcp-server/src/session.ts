import { randomUUID } from "node:crypto";

export interface GrantedApp {
	bundleId: string;
	displayName: string;
	tier: "full" | "click" | "read";
	grantedAt: number;
}

export interface GrantFlags {
	clipboardRead: boolean;
	clipboardWrite: boolean;
	systemKeyCombos: boolean;
}

export interface ScreenshotMeta {
	width: number;
	height: number;
	displayWidth: number;
	displayHeight: number;
	originX: number;
	originY: number;
}

export interface SessionState {
	allowedApps: Map<string, GrantedApp>;
	grantFlags: GrantFlags;
	selectedDisplayId: number | "auto";
	lastScreenshot: ScreenshotMeta | null;
	coordinateMode: "pixels" | "normalized_0_100";
	mouseButtonHeld: boolean;
	hiddenDuringTurn: Set<string>;
	clipboardStash: string | undefined;
	lockAcquired: boolean;
	sessionId: string;
}

export function createSessionState(): SessionState {
	return {
		allowedApps: new Map(),
		grantFlags: {
			clipboardRead: false,
			clipboardWrite: false,
			systemKeyCombos: false,
		},
		selectedDisplayId: "auto",
		lastScreenshot: null,
		coordinateMode: "pixels",
		mouseButtonHeld: false,
		hiddenDuringTurn: new Set(),
		clipboardStash: undefined,
		lockAcquired: false,
		sessionId: randomUUID(),
	};
}
