import {
	buildLifecycleAuditRecord,
	type LifecycleAuditRecord,
	type LifecycleIdempotencyLedger,
	type LifecycleOutcome,
} from "./lifecycle-audit";
import type { NotificationLifecycleCommandIntent } from "./lifecycle-command-parser";

/**
 * Privacy-minimized, read-only summary of a session, returned for the `list`
 * intent (chase 10.033-B). Carries no secrets, no filesystem paths, no prompt
 * bodies — only a safe session id, a short human title, and a timestamp.
 */
export interface LifecycleSessionSummary {
	sessionId: string;
	title: string;
	updatedAt: number;
}

/**
 * Authorization + data context for a single lifecycle dispatch. The runtime is
 * fail-closed: only the paired `ownerChatId` may drive lifecycle, and
 * resume/close additionally require session ownership.
 */
export interface LifecycleControlContext {
	/** The single paired owner chat permitted to drive lifecycle. */
	ownerChatId: number;
	/** Chat the command actually arrived from. */
	chatId: number;
	/** Caller-supplied idempotency key (e.g. Telegram update/callback id). */
	idempotencyKey: string;
	/** Read-only provider of privacy-minimized session summaries (for `list`). */
	listSessions: () => readonly LifecycleSessionSummary[];
	/** Ownership predicate for resume/close target sessions. */
	ownsSession: (sessionId: string) => boolean;
}

export interface LifecycleDispatchResult {
	outcome: LifecycleOutcome;
	audit: LifecycleAuditRecord;
	/** Present only for an accepted `list`; the read-only summaries to render. */
	sessions?: readonly LifecycleSessionSummary[];
}

const EXECUTION_DEFERRED: LifecycleOutcome = {
	kind: "execution_deferred",
	reason: "remote_lifecycle_execution_disabled",
};

/**
 * Authorize and dispatch a parsed lifecycle intent. Telegram-driven process
 * execution stays deferred (chase 10.033): `new`/`resume`/`close_current` are
 * authorized, idempotency-tracked, and audited, but resolve to
 * `execution_deferred` and never spawn, attach to, or kill a process. `list`
 * returns privacy-minimized read-only summaries. Every dispatch yields a
 * token/text-free audit record; a replayed idempotency key returns the first
 * recorded outcome without re-dispatch.
 */
export function executeLifecycleIntent(
	intent: NotificationLifecycleCommandIntent,
	ctx: LifecycleControlContext,
	ledger: LifecycleIdempotencyLedger,
	now: () => number = Date.now,
): LifecycleDispatchResult {
	const at = now();

	const prior = ledger.get(ctx.idempotencyKey);
	if (prior) {
		return {
			outcome: prior,
			audit: buildLifecycleAuditRecord({
				now: at,
				chatId: ctx.chatId,
				intent,
				idempotencyKey: ctx.idempotencyKey,
				outcome: prior,
				replayed: true,
			}),
			sessions: prior.kind === "listed" ? ctx.listSessions() : undefined,
		};
	}

	const outcome = authorizeAndDispatch(intent, ctx);
	ledger.record(ctx.idempotencyKey, outcome);
	return {
		outcome,
		audit: buildLifecycleAuditRecord({
			now: at,
			chatId: ctx.chatId,
			intent,
			idempotencyKey: ctx.idempotencyKey,
			outcome,
			replayed: false,
		}),
		sessions: outcome.kind === "listed" ? ctx.listSessions() : undefined,
	};
}

function authorizeAndDispatch(
	intent: NotificationLifecycleCommandIntent,
	ctx: LifecycleControlContext,
): LifecycleOutcome {
	// Paired-chat-only; any other chat fails closed before any dispatch.
	if (ctx.chatId !== ctx.ownerChatId) {
		return { kind: "rejected", reason: "unauthorized_chat" };
	}

	switch (intent.kind) {
		case "list":
			return { kind: "listed", sessionCount: ctx.listSessions().length };
		case "new":
		case "close_current":
			// `new` accepts no cwd/prompt/profile from Telegram (parser-enforced) and
			// `close_current` targets only the owner's mapped session; both deferred.
			return EXECUTION_DEFERRED;
		case "resume":
			// Fail closed when the target session is not owned by the paired chat.
			if (!ctx.ownsSession(intent.sessionId)) {
				return { kind: "rejected", reason: "unknown_session" };
			}
			return EXECUTION_DEFERRED;
		default: {
			const _exhaustive: never = intent;
			return { kind: "rejected", reason: "unknown_session" };
		}
	}
}
