import type { NotificationEndpointRecord } from "./discovery";
import type { RemoteActionContext } from "./remote-answer";
import type { TelegramUpdate } from "./telegram-api";
import { extractTelegramCallbackQuery } from "./telegram-callback-ingest";
import {
	type InboundDispatchAction,
	type InboundDispatchPlan,
	type InboundRouterContext,
	routeTelegramInboundUpdate,
} from "./telegram-inbound-router";
import type { ThreadTopicRegistry } from "./threaded-surface";
import { fingerprintSecret } from "./transport-state";

/**
 * Daemon-side inbound bridge + executor (chase 10.032 live path).
 *
 * The managed Telegram daemon runs out-of-process from the agent sessions, so it cannot read a session's
 * in-memory pending ask. The session publishes a {@link NotificationEndpointRecord.pendingAction} snapshot
 * into its discovery record; `buildRemoteActionContextFromRecord` turns that into the synchronous
 * `RemoteActionContext` the phase-49 router needs (to decode compact button callbacks against the ask
 * `options`). This context is PRELIMINARY — the session re-validates every forwarded answer via
 * `decideRemoteAnswer` and is the final authority on the local/remote race and idempotency.
 *
 * `executeInboundDispatchPlan` runs a router `InboundDispatchPlan` against injected real effects
 * (`answerTelegramCallbackQuery` to clear the user's spinner; `forwardTelegramReplyToSession` to deliver an
 * answer/reply to exactly one mapped session). Every action is isolated: a single failing effect is
 * swallowed and tallied, never aborting the rest of the plan. No token, chat id, or session secret is ever
 * logged or embedded in the result.
 */

/**
 * Build a preliminary `RemoteActionContext` from a session's discovery record. Returns `undefined` when the
 * record is stale or advertises no active ask — the daemon then has no daemon-side context and the router
 * falls back to forwarding (text) or rejecting the callback spinner (button), all fail-closed.
 */
export function buildRemoteActionContextFromRecord(
	record: NotificationEndpointRecord,
): RemoteActionContext | undefined {
	if (record.stale) return undefined;
	const pending = record.pendingAction;
	if (!pending) return undefined;
	return {
		sessionId: record.sessionId,
		actionId: pending.actionId,
		expectedToken: record.token,
		answeredBy: undefined,
		idempotencyRecords: [],
		allowedValues: pending.options ? [...pending.options] : undefined,
		allowFreeText: pending.allowFreeText,
	};
}

export interface InboundDispatchEffects {
	/** Clear a callback's loading spinner (`ok` = answer accepted). `text` is an optional short notice. */
	answerCallback: (input: { callbackQueryId: string; ok: boolean; text?: string }) => Promise<void>;
	/** Forward an answer/reply value to exactly one mapped session; the session resolves authoritatively. */
	forwardToSession: (input: { sessionId: string; value: string }) => Promise<{ ok: boolean; reason?: string }>;
}

export interface ExecutedInboundAction {
	kind: InboundDispatchAction["kind"];
	ok: boolean;
	detail?: string;
}

export interface ExecuteInboundResult {
	executed: ExecutedInboundAction[];
	/** callbacks acknowledged (spinner cleared) without throwing. */
	acked: number;
	/** answers/replies the mapped session accepted (forward returned ok). */
	forwarded: number;
	/** explicit router drops (no effect performed). */
	dropped: number;
	/** actions that threw OR forwards the session did not accept. */
	failed: number;
}

/**
 * Execute a router dispatch plan against real effects. Pure orchestration: never throws, isolates each
 * action, and returns an accurate tally plus a per-action record.
 */
export async function executeInboundDispatchPlan(
	plan: InboundDispatchPlan,
	effects: InboundDispatchEffects,
): Promise<ExecuteInboundResult> {
	const result: ExecuteInboundResult = { executed: [], acked: 0, forwarded: 0, dropped: 0, failed: 0 };
	for (const action of plan) {
		try {
			switch (action.kind) {
				case "answer_callback": {
					await effects.answerCallback({
						callbackQueryId: action.callbackQueryId,
						ok: action.outcome === "accepted",
						text: action.reason,
					});
					result.acked += 1;
					result.executed.push({ kind: action.kind, ok: true });
					break;
				}
				case "deliver_answer": {
					const forward = await effects.forwardToSession({ sessionId: action.sessionId, value: action.value });
					if (forward.ok) result.forwarded += 1;
					else result.failed += 1;
					result.executed.push({ kind: action.kind, ok: forward.ok, detail: forward.reason });
					break;
				}
				case "forward_reply": {
					const forward = await effects.forwardToSession({ sessionId: action.sessionId, value: action.text });
					if (forward.ok) result.forwarded += 1;
					else result.failed += 1;
					result.executed.push({ kind: action.kind, ok: forward.ok, detail: forward.reason });
					break;
				}
				case "drop": {
					result.dropped += 1;
					result.executed.push({ kind: action.kind, ok: true, detail: action.reason });
					break;
				}
			}
		} catch (error) {
			result.failed += 1;
			result.executed.push({ kind: action.kind, ok: false, detail: (error as Error).message });
		}
	}
	return result;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/**
 * Read-only resolution of which mapped session an inbound update targets, mirroring the router's
 * chat/topic resolution WITHOUT any dedupe side effect. Returns `undefined` for a foreign/missing chat,
 * a missing topic, or an unmapped thread. Used only to pick the session whose connect token + context the
 * daemon should present to the router for that update.
 */
export function resolveTargetSession(
	update: TelegramUpdate,
	registry: ThreadTopicRegistry,
	expectedChatIdFingerprint: string,
): string | undefined {
	const callback = extractTelegramCallbackQuery(update);
	if (callback) {
		if (callback.chatId === undefined) return undefined;
		if (fingerprintSecret(String(callback.chatId)) !== expectedChatIdFingerprint) return undefined;
		if (callback.messageThreadId === undefined) return undefined;
		return registry.findByThread(expectedChatIdFingerprint, callback.messageThreadId)?.sessionId;
	}
	const message = asRecord(update.message);
	if (!message) return undefined;
	const chatId = asRecord(message.chat)?.id;
	if (chatId === undefined) return undefined;
	if (fingerprintSecret(String(chatId)) !== expectedChatIdFingerprint) return undefined;
	const threadId = message.message_thread_id;
	if (typeof threadId !== "number") return undefined;
	return registry.findByThread(expectedChatIdFingerprint, threadId)?.sessionId;
}

export interface ProcessInboundUpdatesOptions {
	updates: readonly TelegramUpdate[];
	registry: ThreadTopicRegistry;
	expectedChatIdFingerprint: string;
	/** Load a session's discovery record (its token + published pending-action snapshot). */
	loadRecord: (sessionId: string) => Promise<NotificationEndpointRecord | null>;
	isDuplicateUpdate: (updateId: number) => boolean;
	recordUpdateId?: (updateId: number) => void;
	effects: InboundDispatchEffects;
}

export interface ProcessInboundUpdatesResult {
	processed: number;
	results: ExecuteInboundResult[];
}

interface SessionPreload {
	token?: string;
	context?: RemoteActionContext;
}

/**
 * Route and execute a batch of polled Telegram updates. Pre-loads each mapped session's discovery record
 * once per call (resolving the router's synchronous `resolveActionContext` seam), then routes every update
 * with a per-update `presentedToken` set to its target session's connect token. The daemon is pre-authorized
 * (it read that token from the local discovery file and matched the chat); the session re-validates every
 * forwarded answer as the final authority. Never throws.
 */
export async function processInboundUpdates(opts: ProcessInboundUpdatesOptions): Promise<ProcessInboundUpdatesResult> {
	const preloads = new Map<string, SessionPreload>();
	const loadFor = async (sessionId: string): Promise<SessionPreload> => {
		const cached = preloads.get(sessionId);
		if (cached) return cached;
		let preload: SessionPreload = {};
		try {
			const record = await opts.loadRecord(sessionId);
			if (record) preload = { token: record.token, context: buildRemoteActionContextFromRecord(record) };
		} catch {
			preload = {};
		}
		preloads.set(sessionId, preload);
		return preload;
	};

	const results: ExecuteInboundResult[] = [];
	for (const update of opts.updates) {
		const sessionId = resolveTargetSession(update, opts.registry, opts.expectedChatIdFingerprint);
		const preload = sessionId ? await loadFor(sessionId) : {};
		const ctx: InboundRouterContext = {
			expectedChatIdFingerprint: opts.expectedChatIdFingerprint,
			presentedToken: preload.token,
			registry: opts.registry,
			isDuplicateUpdate: opts.isDuplicateUpdate,
			recordUpdateId: opts.recordUpdateId,
			resolveActionContext: sid => preloads.get(sid)?.context,
		};
		const plan = routeTelegramInboundUpdate(update, ctx);
		results.push(await executeInboundDispatchPlan(plan, opts.effects));
	}
	return { processed: opts.updates.length, results };
}
