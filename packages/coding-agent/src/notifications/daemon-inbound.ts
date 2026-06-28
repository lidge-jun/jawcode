import type { NotificationEndpointRecord } from "./discovery";
import type { RemoteActionContext } from "./remote-answer";
import type { InboundDispatchAction, InboundDispatchPlan } from "./telegram-inbound-router";

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
