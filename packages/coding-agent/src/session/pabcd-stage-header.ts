/**
 * Per-turn PABCD stage header (99.03 M2) — the persistence layer of the
 * workflow surface. Mirrors cli-jaw's `getPrefix()`: a 1–2 line stage banner
 * regenerated every turn so the stage context survives compaction.
 *
 * Pure function over the lenient pabcd envelope so it can be unit-tested
 * without an AgentSession; the session wires it via `#buildPabcdStageMessage`.
 */
import type { NativePabcdEnvelopeParsed } from "../jwc-runtime/orchestrate-state";
import { truncateObjective } from "../modes/components/status-line/workflow-readers";

/** 99.08-A: goal context for header co-display (objective only — full text stays in goal-mode-context). */
export interface PabcdHeaderGoal {
	objective: string;
}

const GOAL_SUMMARY_MAX = 40;

const STAGE_LABELS: Record<string, string> = {
	I: "INTERVIEW",
	P: "PLANNING",
	A: "PLAN AUDIT",
	B: "BUILD",
	C: "CHECK",
	D: "DONE",
};

const NEXT_HINTS: Record<string, string> = {
	I: "Complete requirements gathering, then run `jwc orchestrate p` when they are sufficient.",
	P: "Present the plan draft and wait for approval. When approved, run `jwc orchestrate a`.",
	A: "Run the audit subagents. On PASS + user approval, run `jwc orchestrate b`.",
	B: "Implement the plan. On verification DONE, run `jwc orchestrate c`.",
	C: "Run the gates. All green → run `jwc orchestrate d` yourself.",
	D: "Summarize the cycle, then run `jwc orchestrate d`.",
};

const HOTL_HINTS: Record<string, string> = {
	I: "HOTL: Complete requirements, then run `jwc orchestrate p` immediately — do not wait for user.",
	P: 'HOTL: Finalize the plan and run `jwc orchestrate a` immediately. Record checkpoint with `jwc goal update --evidence "plan finalized"`. Do NOT wait for user approval.',
	A: "HOTL: Run audit subagents. On PASS, run `jwc orchestrate b` immediately with checkpoint. Do NOT wait for user approval.",
	B: "HOTL: Implement the plan. On verification DONE, run `jwc orchestrate c` immediately with checkpoint. Do NOT wait for user approval.",
	C: "HOTL: Run the gates. All green → run `jwc orchestrate d` yourself.",
	D: "HOTL: Summarize, then run `jwc orchestrate d`. If goal has remaining work, re-enter `jwc orchestrate p` for the next cycle.",
};

/**
 * Build the stage-header content for an active envelope, or null when no
 * header should be injected (inactive, complete, or unknown stage).
 */
export function buildPabcdStageContent(
	envelope: NativePabcdEnvelopeParsed,
	goal?: PabcdHeaderGoal | null,
): string | null {
	if (!envelope.active) return null;
	const stage = (envelope.current_phase ?? "").toUpperCase();
	if (!stage || stage === "COMPLETE") return null;
	const label = STAGE_LABELS[stage];
	if (!label) return null;

	const ctx = envelope.ctx ?? {};
	const gateChips: string[] = [];
	if (stage === "A") {
		const audit = ctx.audit_status ?? "pending";
		if (audit !== "pass") gateChips.push(`audit=${audit}`);
	}
	if (stage === "B") {
		const verification = ctx.verification_status ?? "pending";
		if (verification !== "done") gateChips.push(`verification=${verification}`);
	}
	const gates = gateChips.length > 0 ? ` · ${gateChips.join(" · ")}` : "";

	const hasGoal = !!goal?.objective?.trim();
	const goalPrefix = hasGoal ? `GOAL: ${truncateObjective(goal!.objective, GOAL_SUMMARY_MAX)} · ` : "";
	const hints = hasGoal ? HOTL_HINTS : NEXT_HINTS;

	return `[${goalPrefix}PABCD — ${stage}: ${label}${gates}]\n${hints[stage] ?? ""}`.trimEnd();
}
