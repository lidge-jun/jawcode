import { describe, expect, it } from "bun:test";
import {
	buildLifecycleAuditRecord,
	executeLifecycleIntent,
	type LifecycleControlContext,
	LifecycleIdempotencyLedger,
	type LifecycleSessionSummary,
} from "../src/notifications";
import type { NotificationLifecycleCommandIntent } from "../src/notifications/lifecycle-command-parser";

const SESSIONS: LifecycleSessionSummary[] = [
	{ sessionId: "alpha", title: "refactor api", updatedAt: 1000 },
	{ sessionId: "beta", title: "fix tests", updatedAt: 2000 },
];

function ctx(overrides: Partial<LifecycleControlContext> = {}): LifecycleControlContext {
	return {
		ownerChatId: 42,
		chatId: 42,
		idempotencyKey: "update-1",
		listSessions: () => SESSIONS,
		ownsSession: id => SESSIONS.some(s => s.sessionId === id),
		...overrides,
	};
}

const fixedNow = () => 1_700_000_000_000;

describe("executeLifecycleIntent — authorization (fail closed)", () => {
	it("rejects any chat that is not the paired owner", () => {
		const ledger = new LifecycleIdempotencyLedger();
		const res = executeLifecycleIntent({ kind: "list" }, ctx({ chatId: 999 }), ledger, fixedNow);
		expect(res.outcome).toEqual({ kind: "rejected", reason: "unauthorized_chat" });
		expect(res.sessions).toBeUndefined();
		expect(res.audit.outcome).toBe("rejected");
		expect(res.audit.reason).toBe("unauthorized_chat");
	});

	it("rejects resume of a session the paired chat does not own", () => {
		const ledger = new LifecycleIdempotencyLedger();
		const intent: NotificationLifecycleCommandIntent = { kind: "resume", sessionId: "ghost" };
		const res = executeLifecycleIntent(intent, ctx(), ledger, fixedNow);
		expect(res.outcome).toEqual({ kind: "rejected", reason: "unknown_session" });
		expect(res.audit.sessionId).toBe("ghost");
	});
});

describe("executeLifecycleIntent — read-only listing (10.033-B)", () => {
	it("returns privacy-minimized summaries with no secrets/paths", () => {
		const ledger = new LifecycleIdempotencyLedger();
		const res = executeLifecycleIntent({ kind: "list" }, ctx(), ledger, fixedNow);
		expect(res.outcome).toEqual({ kind: "listed", sessionCount: 2 });
		expect(res.sessions).toEqual(SESSIONS);
		// Summaries expose only id/title/updatedAt — no token, path, or prompt bodies.
		for (const s of res.sessions ?? []) {
			expect(Object.keys(s).sort()).toEqual(["sessionId", "title", "updatedAt"]);
		}
	});
});

describe("executeLifecycleIntent — execution deferred (10.033)", () => {
	for (const intent of [
		{ kind: "new" } as const,
		{ kind: "close_current" } as const,
		{ kind: "resume", sessionId: "alpha" } as const,
	]) {
		it(`defers ${intent.kind} but authorizes + audits it`, () => {
			const ledger = new LifecycleIdempotencyLedger();
			const res = executeLifecycleIntent(intent, ctx(), ledger, fixedNow);
			expect(res.outcome).toEqual({
				kind: "execution_deferred",
				reason: "remote_lifecycle_execution_disabled",
			});
			expect(res.audit.outcome).toBe("execution_deferred");
			expect(res.audit.replayed).toBe(false);
			expect(ledger.size).toBe(1);
		});
	}
});

describe("executeLifecycleIntent — idempotency ledger (10.033-C)", () => {
	it("replays the first recorded outcome without re-dispatch", () => {
		const ledger = new LifecycleIdempotencyLedger();
		let owned = true;
		const c = ctx({ ownsSession: () => owned });
		const intent: NotificationLifecycleCommandIntent = { kind: "resume", sessionId: "alpha" };

		const first = executeLifecycleIntent(intent, c, ledger, fixedNow);
		expect(first.outcome.kind).toBe("execution_deferred");
		expect(first.audit.replayed).toBe(false);

		// Even if ownership later flips, the same idempotency key returns the first outcome.
		owned = false;
		const second = executeLifecycleIntent(intent, c, ledger, fixedNow);
		expect(second.outcome).toEqual(first.outcome);
		expect(second.audit.replayed).toBe(true);
		expect(ledger.size).toBe(1);
	});

	it("evicts oldest entries beyond the bound", () => {
		const ledger = new LifecycleIdempotencyLedger(2);
		ledger.record("a", { kind: "execution_deferred", reason: "remote_lifecycle_execution_disabled" });
		ledger.record("b", { kind: "listed", sessionCount: 0 });
		ledger.record("c", { kind: "rejected", reason: "unauthorized_chat" });
		expect(ledger.size).toBe(2);
		expect(ledger.get("a")).toBeUndefined();
		expect(ledger.get("c")).toBeDefined();
	});
});

describe("buildLifecycleAuditRecord — no secrets", () => {
	it("never includes a token or message text", () => {
		const record = buildLifecycleAuditRecord({
			now: 5,
			chatId: 42,
			intent: { kind: "resume", sessionId: "alpha" },
			idempotencyKey: "k",
			outcome: { kind: "execution_deferred", reason: "remote_lifecycle_execution_disabled" },
			replayed: false,
		});
		const json = JSON.stringify(record);
		expect(json).not.toContain("token");
		expect(record.sessionId).toBe("alpha");
		expect(Object.keys(record).sort()).toEqual([
			"at",
			"chatId",
			"idempotencyKey",
			"intent",
			"outcome",
			"reason",
			"replayed",
			"sessionId",
		]);
	});
});
