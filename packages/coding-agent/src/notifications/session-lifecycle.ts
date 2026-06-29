import * as path from "node:path";
import type { Settings } from "../config/settings";
import { getNotificationConfig, isNotificationEnabled } from "./config";
import { NotificationLoopbackServer } from "./server";

export interface MaybeStartNotificationServerOptions {
	settings: Settings;
	sessionId: string;
	/** Workspace/project root; the discovery file is written under `<cwd>/.jwc/state/notifications`. */
	cwd: string;
	/** Subagent depth; only top-level sessions (0) start a server. */
	taskDepth?: number;
	registerCleanup: (name: string, cleanup: () => Promise<void> | void) => void;
	/** Injectable for tests. */
	startServer?: typeof NotificationLoopbackServer.start;
	now?: () => number;
}

const NOTIFICATION_CLEANUP_KEY = "notifications";

/**
 * Start the loopback notification server for a live session when notifications are enabled.
 *
 * Returns the running server, or `null` when skipped (subagent session, notifications disabled,
 * or a start failure). A start failure is logged and swallowed — it must never break session
 * creation. On success a `stop()` cleanup is registered so the server is torn down on dispose.
 */
export async function maybeStartNotificationServer(
	options: MaybeStartNotificationServerOptions,
): Promise<NotificationLoopbackServer | null> {
	if ((options.taskDepth ?? 0) !== 0) return null; // top-level sessions only

	const config = getNotificationConfig(options.settings);
	if (!isNotificationEnabled(config)) return null;

	const stateRoot = path.join(options.cwd, ".jwc", "state");
	const start = options.startServer ?? NotificationLoopbackServer.start;
	try {
		const server = await start({ sessionId: options.sessionId, stateRoot, now: options.now });
		options.registerCleanup(NOTIFICATION_CLEANUP_KEY, () => server.stop());
		return server;
	} catch (error) {
		console.error("[notifications] loopback server start failed", (error as Error).message);
		return null;
	}
}
