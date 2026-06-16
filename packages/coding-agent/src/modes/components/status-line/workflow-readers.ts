/**
 * Status-line-only workflow state readers (99.04.01 C1).
 *
 * Render hot path: keep this module free of the engine module graph — it
 * imports only the lenient pabcd reader and node builtins. Both readers are
 * best-effort: any error renders as "no segment" (null), never a throw.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { readPabcdStateWithFallback } from "../../../jwc-runtime/orchestrate-state";

/** Shared objective summary rule (99.08 확정 #3): single helper, max varies per surface. */
export function truncateObjective(text: string, max: number): string {
	const collapsed = text.replace(/\s+/g, " ").trim();
	if (collapsed.length <= max) return collapsed;
	return `${collapsed.slice(0, Math.max(1, max - 1))}…`;
}

export interface PabcdSegmentState {
	stage: string;
	active: boolean;
	stateSessionId?: string;
	auditStatus?: "pending" | "pass" | "fail";
	verificationStatus?: "pending" | "done" | "needs_fix";
	aRound?: number;
}

/** Read the pabcd envelope for segment display (lenient, fail-open null). */
export async function readPabcdSegmentState(cwd: string, sessionId?: string): Promise<PabcdSegmentState | null> {
	try {
		const result = await readPabcdStateWithFallback(cwd, sessionId);
		if (!result?.ok) return null;
		const envelope = result.value;
		const stage = (envelope.current_phase ?? "").toLowerCase();
		if (!envelope.active || !stage || stage === "complete") return null;
		return {
			stage,
			active: true,
			stateSessionId: envelope.session_id,
			auditStatus: envelope.ctx?.audit_status,
			verificationStatus: envelope.ctx?.verification_status,
			aRound: envelope.ctx?.a_round,
		};
	} catch {
		return null;
	}
}

export interface GoalLedgerStats {
	checkpointCount: number;
	lastEvidenceBlank: boolean;
}

interface LedgerCacheEntry {
	mtimeMs: number;
	size: number;
	stats: GoalLedgerStats;
}

const TAIL_SCAN_LIMIT = 200;
const ledgerCache = new Map<string, LedgerCacheEntry>();

/**
 * Tail-scan `.jwc/goal/ledger.jsonl` for checkpoint stats. mtime+size
 * cached so unchanged files skip the re-parse (1s-TTL poll rail calls this).
 */
export function readGoalLedgerStats(cwd: string): GoalLedgerStats | null {
	const ledgerPath = path.join(cwd, ".jwc", "goal", "ledger.jsonl");
	try {
		const stat = fs.statSync(ledgerPath);
		const cached = ledgerCache.get(ledgerPath);
		if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.stats;

		const lines = fs.readFileSync(ledgerPath, "utf8").split("\n").filter(Boolean).slice(-TAIL_SCAN_LIMIT);
		let checkpointCount = 0;
		let lastEvidence: string | null = null;
		for (const line of lines) {
			try {
				const event = JSON.parse(line) as { event?: string; evidence?: unknown };
				if (event.event !== "goal_checkpointed") continue;
				checkpointCount += 1;
				lastEvidence = typeof event.evidence === "string" ? event.evidence : JSON.stringify(event.evidence ?? "");
			} catch {
				// skip corrupt ledger lines — stats stay best-effort
			}
		}
		const stats: GoalLedgerStats = {
			checkpointCount,
			lastEvidenceBlank:
				checkpointCount > 0 && (!lastEvidence || lastEvidence.trim().length === 0 || lastEvidence === '""'),
		};
		ledgerCache.set(ledgerPath, { mtimeMs: stat.mtimeMs, size: stat.size, stats });
		return stats;
	} catch {
		return null;
	}
}
