import type { NotificationLifecycleCommandIntent } from "./lifecycle-command-parser";

/**
 * Result of dispatching a parsed Telegram lifecycle intent through the JWC
 * control runtime. Telegram-driven process execution (create/resume/close) is
 * deferred as a later C4 decision (chase 10.033), so mutating intents resolve
 * to `execution_deferred` rather than spawning, attaching, or killing a process.
 *
 * No variant carries a bot token or raw message text — outcomes are safe to
 * persist to a JSONL audit ledger.
 */
export type LifecycleOutcome =
	| { kind: "listed"; sessionCount: number }
	| { kind: "execution_deferred"; reason: "remote_lifecycle_execution_disabled" }
	| { kind: "rejected"; reason: LifecycleRejectionReason };

export type LifecycleRejectionReason = "unauthorized_chat" | "unknown_session";

/**
 * JSONL-safe audit record for a single lifecycle dispatch. Deliberately omits
 * the bot token and any message text; only the command kind, the chat id, the
 * (safe-regex) session id for resume, the outcome, a bounded reason, the
 * idempotency key, and whether the dispatch was a replay are recorded.
 */
export interface LifecycleAuditRecord {
	at: number;
	chatId: number;
	intent: NotificationLifecycleCommandIntent["kind"];
	sessionId?: string;
	outcome: LifecycleOutcome["kind"];
	reason?: string;
	idempotencyKey: string;
	replayed: boolean;
}

export interface BuildLifecycleAuditRecordInput {
	now: number;
	chatId: number;
	intent: NotificationLifecycleCommandIntent;
	idempotencyKey: string;
	outcome: LifecycleOutcome;
	replayed: boolean;
}

export function buildLifecycleAuditRecord(input: BuildLifecycleAuditRecordInput): LifecycleAuditRecord {
	const { now, chatId, intent, idempotencyKey, outcome, replayed } = input;
	const record: LifecycleAuditRecord = {
		at: now,
		chatId,
		intent: intent.kind,
		outcome: outcome.kind,
		idempotencyKey,
		replayed,
	};
	if (intent.kind === "resume") record.sessionId = intent.sessionId;
	if (outcome.kind === "rejected" || outcome.kind === "execution_deferred") {
		record.reason = outcome.reason;
	}
	return record;
}

const DEFAULT_MAX_LEDGER_ENTRIES = 256;

/**
 * Bounded in-memory idempotency ledger for lifecycle dispatches. A replayed
 * idempotency key returns the first recorded outcome without re-dispatch, which
 * prevents duplicate create/close/resume requests from acting twice. Eviction is
 * insertion-order (oldest first) so the ledger cannot grow without bound.
 */
export class LifecycleIdempotencyLedger {
	private readonly entries = new Map<string, LifecycleOutcome>();
	private readonly maxEntries: number;

	constructor(maxEntries: number = DEFAULT_MAX_LEDGER_ENTRIES) {
		this.maxEntries = Math.max(1, maxEntries);
	}

	get(key: string): LifecycleOutcome | undefined {
		return this.entries.get(key);
	}

	record(key: string, outcome: LifecycleOutcome): void {
		if (this.entries.has(key)) return;
		if (this.entries.size >= this.maxEntries) {
			const oldest = this.entries.keys().next().value;
			if (oldest !== undefined) this.entries.delete(oldest);
		}
		this.entries.set(key, outcome);
	}

	get size(): number {
		return this.entries.size;
	}
}
