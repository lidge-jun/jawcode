import { readNotificationDiscoveryRecord } from "./discovery";
import type { NotificationServerFrame } from "./protocol";

export interface ForwardReplyResult {
	ok: boolean;
	actionId?: string;
	reason?: string;
}

const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * Forward a remote (e.g. Telegram in-topic) reply to exactly one mapped session by acting as a
 * notification WS client: connect to that session's loopback endpoint, learn the pending `actionId`
 * from the replayed `action_needed`, send a `reply`, and confirm the session resolved it. Fail-closed
 * when the session has no endpoint or no pending ask; the token (from the discovery record) is never
 * logged. Injectable `webSocketImpl`/`readRecord` for tests.
 */
export async function forwardTelegramReplyToSession(opts: {
	stateRoot: string;
	sessionId: string;
	value: string;
	webSocketImpl?: typeof WebSocket;
	timeoutMs?: number;
	readRecord?: typeof readNotificationDiscoveryRecord;
}): Promise<ForwardReplyResult> {
	const readRecord = opts.readRecord ?? readNotificationDiscoveryRecord;
	const record = await readRecord(opts.stateRoot, opts.sessionId);
	if (!record) return { ok: false, reason: "no-endpoint" };

	const WebSocketImpl = opts.webSocketImpl ?? WebSocket;
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const url = `${record.url}?token=${encodeURIComponent(record.token)}`;

	return new Promise<ForwardReplyResult>(resolve => {
		let settled = false;
		let actionId: string | undefined;
		let socket: WebSocket | undefined;

		const finish = (result: ForwardReplyResult): void => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			try {
				socket?.close();
			} catch {
				// ignore close on an already-closing socket
			}
			resolve(result);
		};

		const timer = setTimeout(() => {
			finish({ ok: false, actionId, reason: actionId ? "no-resolution" : "no-pending-action" });
		}, timeoutMs);

		try {
			socket = new WebSocketImpl(url);
		} catch {
			finish({ ok: false, reason: "connect-failed" });
			return;
		}

		socket.addEventListener("error", () => finish({ ok: false, actionId, reason: "ws-error" }));
		socket.addEventListener("message", (event: MessageEvent) => {
			let frame: NotificationServerFrame;
			try {
				frame = JSON.parse(String(event.data)) as NotificationServerFrame;
			} catch {
				return;
			}
			if (frame.type === "action_needed" && actionId === undefined) {
				actionId = frame.actionId;
				socket?.send(JSON.stringify({ type: "reply", actionId, value: opts.value }));
				return;
			}
			if (frame.type === "action_resolved" && actionId !== undefined && frame.actionId === actionId) {
				finish({ ok: true, actionId });
				return;
			}
			if (frame.type === "reply_rejected" && actionId !== undefined && frame.actionId === actionId) {
				finish({ ok: false, actionId, reason: frame.reason });
			}
		});
	});
}
