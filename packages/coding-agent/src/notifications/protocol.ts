export const NOTIFICATION_PROTOCOL_VERSION = 1;

export type NotificationServerFrame =
	| NotificationActionNeededFrame
	| NotificationActionResolvedFrame
	| NotificationReplyRejectedFrame
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
}

export interface NotificationClientHelloFrame {
	type: "hello";
	version: number;
}

export interface NotificationPingFrame {
	type: "ping";
	nonce?: string;
}

export function isSupportedNotificationProtocolVersion(version: number): boolean {
	return Number.isInteger(version) && version === NOTIFICATION_PROTOCOL_VERSION;
}
