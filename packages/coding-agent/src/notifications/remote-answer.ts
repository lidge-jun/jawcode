import { createHash } from "node:crypto";
import { isNotificationConnectTokenAccepted } from "./config";

const CALLBACK_PAYLOAD_PREFIX = "jwc:v1:";
const MAX_CALLBACK_PAYLOAD_BYTES = 256;

export type RemoteAnswerTransport = "telegram";
export type RemoteAnswerKind = "button" | "free_text";
export type RemoteAnswerSource = "local" | "telegram";

export interface RemoteAnswerInput {
	sessionId: string;
	actionId: string;
	idempotencyKey: string;
	transport: RemoteAnswerTransport;
	kind: RemoteAnswerKind;
	value: string;
	presentedToken?: string;
}

export interface RemoteIdempotencyRecord {
	key: string;
	valueHash: string;
	status: "accepted" | "rejected";
	reason?: RemoteAnswerRejectionReason;
}

export interface RemoteActionContext {
	sessionId: string;
	actionId: string;
	expectedToken: string;
	answeredBy?: RemoteAnswerSource;
	idempotencyRecords?: readonly RemoteIdempotencyRecord[];
	allowedValues?: readonly string[];
	allowFreeText?: boolean;
}

export interface NormalizedRemoteAnswer {
	sessionId: string;
	actionId: string;
	idempotencyKey: string;
	source: "telegram";
	kind: RemoteAnswerKind;
	value: string;
}

export interface RemoteActionContextPatch {
	answeredBy: "telegram";
	idempotencyRecord: {
		key: string;
		valueHash: string;
		status: "accepted";
	};
}

export type RemoteAnswerRejectionReason =
	| "unauthorized"
	| "session_mismatch"
	| "stale_action"
	| "idempotency_conflict"
	| "already_answered"
	| "invalid_button_value"
	| "free_text_not_allowed"
	| "empty_free_text";

export type RemoteAnswerDecision =
	| { status: "accepted"; answer: NormalizedRemoteAnswer; contextPatch: RemoteActionContextPatch }
	| {
			status: "rejected";
			reason: RemoteAnswerRejectionReason;
			idempotencyRecord?: {
				key: string;
				valueHash: string;
				status: "rejected";
				reason: RemoteAnswerRejectionReason;
			};
	  };

export interface TelegramCallbackPayloadParts {
	sessionId: string;
	actionId: string;
	value: string;
	nonce: string;
}

export type ParseTelegramCallbackPayloadResult =
	| { ok: true; input: Omit<RemoteAnswerInput, "presentedToken"> }
	| { ok: false; code: "invalid_payload" };

function hashValue(value: string): string {
	return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function normalizeValue(input: RemoteAnswerInput): string {
	const value = input.kind === "button" ? stripTelegramOptionPrefix(input.value) : input.value.trim();
	return value.trim();
}

export function stripTelegramOptionPrefix(label: string): string {
	return label.replace(/^\s*\d+[.)]\s+/, "").trim();
}

export function normalizeRemoteAnswerValue(input: RemoteAnswerInput): string {
	return normalizeValue(input);
}

export function buildTelegramCallbackPayload(parts: TelegramCallbackPayloadParts): string {
	const raw = `${CALLBACK_PAYLOAD_PREFIX}${JSON.stringify({
		sessionId: parts.sessionId,
		actionId: parts.actionId,
		value: parts.value,
		nonce: parts.nonce,
	})}`;
	if (new TextEncoder().encode(raw).byteLength > MAX_CALLBACK_PAYLOAD_BYTES) {
		throw new Error("callback_payload_too_large");
	}
	return raw;
}

export function parseTelegramCallbackPayload(payload: string): ParseTelegramCallbackPayloadResult {
	if (new TextEncoder().encode(payload).byteLength > MAX_CALLBACK_PAYLOAD_BYTES) {
		return { ok: false, code: "invalid_payload" };
	}
	if (!payload.startsWith(CALLBACK_PAYLOAD_PREFIX)) return { ok: false, code: "invalid_payload" };
	let parsed: unknown;
	try {
		parsed = JSON.parse(payload.slice(CALLBACK_PAYLOAD_PREFIX.length));
	} catch {
		return { ok: false, code: "invalid_payload" };
	}
	const record = parsed as Partial<TelegramCallbackPayloadParts>;
	if (
		!isNonEmptyString(record.sessionId) ||
		!isNonEmptyString(record.actionId) ||
		!isNonEmptyString(record.value) ||
		!isNonEmptyString(record.nonce)
	) {
		return { ok: false, code: "invalid_payload" };
	}
	return {
		ok: true,
		input: {
			sessionId: record.sessionId,
			actionId: record.actionId,
			idempotencyKey: record.nonce,
			transport: "telegram",
			kind: "button",
			value: record.value,
		},
	};
}

export function isRemoteAnswerInput(value: unknown): value is Omit<RemoteAnswerInput, "presentedToken"> {
	const input = value as Partial<RemoteAnswerInput>;
	return (
		typeof input === "object" &&
		input !== null &&
		isNonEmptyString(input.sessionId) &&
		isNonEmptyString(input.actionId) &&
		isNonEmptyString(input.idempotencyKey) &&
		input.transport === "telegram" &&
		(input.kind === "button" || input.kind === "free_text") &&
		isNonEmptyString(input.value)
	);
}

export function parseRemoteAnswerPayload(payload: unknown): ParseTelegramCallbackPayloadResult {
	if (typeof payload === "string") return parseTelegramCallbackPayload(payload);
	if (!isRemoteAnswerInput(payload)) return { ok: false, code: "invalid_payload" };
	return { ok: true, input: payload };
}

export function decideRemoteAnswer(input: RemoteAnswerInput, context: RemoteActionContext): RemoteAnswerDecision {
	const normalizedValue = normalizeValue(input);
	const valueHash = hashValue(normalizedValue);
	const previous = context.idempotencyRecords?.find(record => record.key === input.idempotencyKey);
	if (previous) {
		if (previous.valueHash !== valueHash) return { status: "rejected", reason: "idempotency_conflict" };
		if (previous.status === "accepted") {
			return {
				status: "accepted",
				answer: {
					sessionId: input.sessionId,
					actionId: input.actionId,
					idempotencyKey: input.idempotencyKey,
					source: "telegram",
					kind: input.kind,
					value: normalizedValue,
				},
				contextPatch: {
					answeredBy: "telegram",
					idempotencyRecord: { key: input.idempotencyKey, valueHash, status: "accepted" },
				},
			};
		}
		return {
			status: "rejected",
			reason: previous.reason ?? "already_answered",
			idempotencyRecord: {
				key: input.idempotencyKey,
				valueHash,
				status: "rejected",
				reason: previous.reason ?? "already_answered",
			},
		};
	}

	if (!isNotificationConnectTokenAccepted(context.expectedToken, input.presentedToken)) {
		return { status: "rejected", reason: "unauthorized" };
	}
	if (input.sessionId !== context.sessionId) return { status: "rejected", reason: "session_mismatch" };
	if (input.actionId !== context.actionId) return { status: "rejected", reason: "stale_action" };
	if (context.answeredBy) return { status: "rejected", reason: "already_answered" };
	if (input.kind === "button" && context.allowedValues && !context.allowedValues.includes(normalizedValue)) {
		return { status: "rejected", reason: "invalid_button_value" };
	}
	if (input.kind === "free_text" && !context.allowFreeText)
		return { status: "rejected", reason: "free_text_not_allowed" };
	if (input.kind === "free_text" && normalizedValue.length === 0)
		return { status: "rejected", reason: "empty_free_text" };

	return {
		status: "accepted",
		answer: {
			sessionId: input.sessionId,
			actionId: input.actionId,
			idempotencyKey: input.idempotencyKey,
			source: "telegram",
			kind: input.kind,
			value: normalizedValue,
		},
		contextPatch: {
			answeredBy: "telegram",
			idempotencyRecord: { key: input.idempotencyKey, valueHash, status: "accepted" },
		},
	};
}
