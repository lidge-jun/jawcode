import { isNotificationConnectTokenAccepted } from "./config";
import {
	type NotificationEndpointRecord,
	readNotificationDiscoveryRecord,
	writeNotificationDiscoveryRecord,
} from "./discovery";
import {
	NOTIFICATION_PROTOCOL_VERSION,
	type NotificationActionNeededFrame,
	type NotificationActionResolvedFrame,
	type NotificationReplyRejectedFrame,
	type NotificationServerFrame,
} from "./protocol";
import {
	decideRemoteAnswer,
	type RemoteActionContext,
	type RemoteAnswerInput,
	type RemoteIdempotencyRecord,
} from "./remote-answer";

export interface NotificationSessionRegistryOptions {
	sessionId: string;
	connectToken: string;
	now?: () => number;
}

export interface NotificationActionDraft {
	actionId: string;
	prompt: string;
	options?: readonly string[];
	allowFreeText?: boolean;
}

export interface NotificationConnectSnapshot {
	sessionId: string;
	frames: NotificationServerFrame[];
}

export type NotificationConnectDecision = NotificationConnectSnapshot | { rejected: true; reason: "unauthorized" };

interface RegistryActionState {
	actionId: string;
	prompt: string;
	options?: readonly string[];
	allowFreeText?: boolean;
	answeredBy?: "local" | "telegram";
	idempotencyRecords: RemoteIdempotencyRecord[];
}

function toActionNeededFrame(action: RegistryActionState): NotificationActionNeededFrame {
	return {
		type: "action_needed",
		actionId: action.actionId,
		prompt: action.prompt,
		options: action.options ? [...action.options] : undefined,
	};
}

function toReplyRejectedFrame(actionId: string | undefined, reason: string): NotificationReplyRejectedFrame {
	return {
		type: "reply_rejected",
		actionId,
		reason,
		source: "telegram",
	};
}

function toResolvedFrame(actionId: string): NotificationActionResolvedFrame {
	return { type: "action_resolved", actionId };
}

export class NotificationSessionRegistry {
	#sessionId: string;
	#connectToken: string;
	#actions = new Map<string, RegistryActionState>();

	constructor(options: NotificationSessionRegistryOptions) {
		this.#sessionId = options.sessionId;
		this.#connectToken = options.connectToken;
	}

	connect(presentedToken: string | undefined): NotificationConnectDecision {
		if (!isNotificationConnectTokenAccepted(this.#connectToken, presentedToken)) {
			return { rejected: true, reason: "unauthorized" };
		}
		const frames: NotificationServerFrame[] = [
			{
				type: "hello",
				version: NOTIFICATION_PROTOCOL_VERSION,
				sessionId: this.#sessionId,
			},
			...Array.from(this.#actions.values())
				.filter(action => !action.answeredBy)
				.map(action => toActionNeededFrame(action)),
		];
		return { sessionId: this.#sessionId, frames };
	}

	enqueueAction(action: NotificationActionDraft): NotificationActionNeededFrame {
		const state: RegistryActionState = {
			actionId: action.actionId,
			prompt: action.prompt,
			options: action.options ? [...action.options] : undefined,
			allowFreeText: action.allowFreeText,
			idempotencyRecords: [],
		};
		this.#actions.set(action.actionId, state);
		return toActionNeededFrame(state);
	}

	resolveRemote(input: RemoteAnswerInput): NotificationServerFrame {
		const action = this.#actions.get(input.actionId);
		if (!action) return toReplyRejectedFrame(input.actionId, "stale_action");
		const decision = decideRemoteAnswer(input, this.#contextFor(action));
		if (decision.status === "accepted") {
			action.answeredBy = decision.contextPatch.answeredBy;
			this.#mergeIdempotencyRecord(action, decision.contextPatch.idempotencyRecord);
			return toResolvedFrame(input.actionId);
		}
		if (decision.idempotencyRecord) this.#mergeIdempotencyRecord(action, decision.idempotencyRecord);
		return toReplyRejectedFrame(input.actionId, decision.reason);
	}

	resolveLocal(actionId: string): NotificationServerFrame {
		const action = this.#actions.get(actionId);
		if (!action) return toReplyRejectedFrame(actionId, "stale_action");
		action.answeredBy = "local";
		return toResolvedFrame(actionId);
	}

	#contextFor(action: RegistryActionState): RemoteActionContext {
		return {
			sessionId: this.#sessionId,
			actionId: action.actionId,
			expectedToken: this.#connectToken,
			answeredBy: action.answeredBy,
			idempotencyRecords: action.idempotencyRecords,
			allowedValues: action.options,
			allowFreeText: action.allowFreeText,
		};
	}

	#mergeIdempotencyRecord(action: RegistryActionState, record: RemoteIdempotencyRecord): void {
		action.idempotencyRecords = action.idempotencyRecords.filter(existing => existing.key !== record.key);
		action.idempotencyRecords.push(record);
	}
}

export async function markStaleNotificationDiscoveryRecord(
	stateRoot: string,
	sessionId: string,
	now = Date.now(),
): Promise<NotificationEndpointRecord | null> {
	const record = await readNotificationDiscoveryRecord(stateRoot, sessionId);
	if (!record) return null;
	const staleRecord: NotificationEndpointRecord = {
		...record,
		stale: true,
		stoppedAt: now,
		updatedAt: now,
	};
	await writeNotificationDiscoveryRecord(stateRoot, staleRecord);
	return staleRecord;
}
