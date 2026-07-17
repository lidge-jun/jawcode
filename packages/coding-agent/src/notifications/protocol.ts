export const NOTIFICATION_PROTOCOL_VERSION = 1;

/** Capability declared by clients that can render and answer interactive ask controls. */
export const ASK_CONTROLS_CAPABILITY = "ask_controls_v1";

/**
 * Operational generation of the managed Telegram daemon. This is intentionally distinct from the
 * protocol-v1 frame envelope and the persisted owner-state schema version: additive capability
 * changes still require a daemon reload even when both of those compatibility versions stay stable.
 */
export const NOTIFICATION_DAEMON_GENERATION = 2;

export type NotificationServerFrame =
	| NotificationActionNeededFrame
	| NotificationActionResolvedFrame
	| NotificationReplyRejectedFrame
	| NotificationSessionClosedFrame
	| NotificationTurnStreamFrame
	| NotificationServerHelloFrame
	| NotificationPongFrame;

export type NotificationClientFrame = NotificationReplyFrame | NotificationClientHelloFrame | NotificationPingFrame;

export interface NotificationActionNeededFrame {
	type: "action_needed";
	actionId: string;
	prompt: string;
	options?: string[];
}

export interface NotificationActionResolvedFrame {
	type: "action_resolved";
	actionId: string;
}

export interface NotificationReplyRejectedFrame {
	type: "reply_rejected";
	actionId?: string;
	reason: string;
	source?: "local" | "telegram";
}

export interface NotificationSessionClosedFrame {
	type: "session_closed";
	sessionId: string;
}

export interface NotificationTurnStreamFrame {
	type: "turn_stream";
	sessionId: string;
	phase: "live" | "finalized";
	text: string;
	messageRef?: string;
	finalAnswer?: boolean;
}

export interface NotificationServerHelloFrame {
	type: "hello";
	version: number;
	sessionId: string;
}

export interface NotificationPongFrame {
	type: "pong";
	nonce?: string;
}

export interface NotificationReplyFrame {
	type: "reply";
	actionId: string;
	value: string;
	source?: "local" | "telegram";
}

export interface NotificationClientHelloFrame {
	type: "hello";
	version: number;
	capabilities?: string[];
}

export interface NotificationPingFrame {
	type: "ping";
	nonce?: string;
}

export function isSupportedNotificationProtocolVersion(version: number): boolean {
	return Number.isInteger(version) && version === NOTIFICATION_PROTOCOL_VERSION;
}
