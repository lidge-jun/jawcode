/**
 * Native IPABCD orchestrate runtime (050 band, 054 B4).
 *
 * Stage entry/transition/gate core for `orchestrate i|p|a|b|c|d|complete`.
 * The runtime owns the state machine only — plan drafting (D050-19), parallel
 * audits (D050-20), and build execution stay with the main session, guided by
 * the stage prompts emitted here. Verdicts from read-only subagents are
 * recorded via `orchestrate verdict --worker-output <path>`.
 */
import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import orchestrateA from "../prompts/jaw/orchestrate-a.md" with { type: "text" };
import auditArchitect from "../prompts/jaw/orchestrate-audit-architect.md" with { type: "text" };
import auditPlanner from "../prompts/jaw/orchestrate-audit-planner.md" with { type: "text" };
import orchestrateB from "../prompts/jaw/orchestrate-b.md" with { type: "text" };
import orchestrateC from "../prompts/jaw/orchestrate-c.md" with { type: "text" };
import orchestrateD from "../prompts/jaw/orchestrate-d.md" with { type: "text" };
import orchestrateI from "../prompts/jaw/orchestrate-i.md" with { type: "text" };
import orchestrateP from "../prompts/jaw/orchestrate-p.md" with { type: "text" };
import { WORKFLOW_STATE_VERSION } from "../skill-state/workflow-state-version";
import {
	readActorRegistry,
	retireNamespaceActors,
	retireStageActors,
	writeActorRegistryAtomic,
} from "./actor-registry";
import { checkpointGoal, readGoalPlan } from "./goal-engine";
import { resolveCliWorkflowSessionId } from "./goal-mode-request";
import { retireJawInterviewStateForWorkflowExit } from "./jaw-interview-runtime";
import {
	canTransitionPabcd,
	PABCD_MAX_A_ROUNDS,
	PABCD_STAGES,
	type PabcdAuditLens,
	type PabcdAuditVerdict,
	type PabcdCtx,
	type PabcdEnvelope,
	type PabcdStage,
	pabcdStatePath,
	parseCriticVerdict,
	parseWorkerVerdict,
	readPabcdState,
	writeNativeWorkflowEnvelopeAtomic,
} from "./orchestrate-state";
import { buildAuditLensSkillPointer, buildStageSkillPointer } from "./stage-skill-map";

export interface OrchestrateCommandResult {
	stdout?: string;
	stderr?: string;
	status: number;
}

const STAGE_PROMPTS: Readonly<Record<Exclude<PabcdStage, "complete">, string>> = {
	i: orchestrateI,
	p: orchestrateP,
	a: orchestrateA,
	b: orchestrateB,
	c: orchestrateC,
	d: orchestrateD,
};

/**
 * Stage-a spawn prompts with the PASS|FAIL output contract fixed (D050-23).
 * Fetch via `orchestrate audit-prompt planner|architect` so spawned auditors
 * never fall back to the legacy-vocabulary embedded planning prompts.
 */
export const ORCHESTRATE_AUDIT_PROMPTS: Readonly<Record<"planner" | "architect", string>> = {
	planner: auditPlanner,
	architect: auditArchitect,
};

interface ParsedArgs {
	positional: string[];
	sessionId?: string;
	deliberate: boolean;
	json: boolean;
	userApproved: boolean;
	auditMode?: "solo" | "dual";
	auditLens?: PabcdAuditLens;
	specRef?: string;
	shared?: boolean;
	dryRun?: boolean;
	planRef?: string;
	workerOutput?: string;
	revisionId?: string;
	reviewOverrideRef?: string;
	complete: boolean;
}

function parseArgs(argv: string[]): ParsedArgs | { error: string } {
	const parsed: ParsedArgs = { positional: [], deliberate: false, json: false, userApproved: false, complete: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--deliberate":
				parsed.deliberate = true;
				break;
			case "--json":
				parsed.json = true;
				break;
			case "--user-approved":
				parsed.userApproved = true;
				break;
			case "--complete":
				parsed.complete = true;
				break;
			case "--shared":
				parsed.shared = true;
				break;
			case "--dry-run":
				parsed.dryRun = true;
				break;
			case "--session-id":
			case "--audit-mode":
			case "--audit-lens":
			case "--spec-ref":
			case "--plan-ref":
			case "--worker-output":
			case "--revision-id":
			case "--review-override-ref": {
				const value = argv[++i];
				if (value === undefined) return { error: `missing value for ${arg}` };
				if (arg === "--session-id") parsed.sessionId = value;
				else if (arg === "--audit-mode") {
					if (value !== "solo" && value !== "dual")
						return { error: `--audit-mode must be solo|dual, got: ${value}` };
					parsed.auditMode = value;
				} else if (arg === "--audit-lens") {
					if (value !== "planner" && value !== "architect")
						return { error: `--audit-lens must be planner|architect, got: ${value}` };
					parsed.auditLens = value;
				} else if (arg === "--spec-ref") parsed.specRef = value;
				else if (arg === "--plan-ref") parsed.planRef = value;
				else if (arg === "--worker-output") parsed.workerOutput = value;
				else if (arg === "--revision-id") parsed.revisionId = value;
				else parsed.reviewOverrideRef = value;
				break;
			}
			default:
				if (arg.startsWith("--")) return { error: `unknown flag: ${arg}` };
				parsed.positional.push(arg);
		}
	}
	return parsed;
}

function isStage(value: string): value is PabcdStage {
	return (PABCD_STAGES as readonly string[]).includes(value);
}

async function readCurrent(
	cwd: string,
	sessionId: string | undefined,
): Promise<{ envelope: PabcdEnvelope | null } | { error: string }> {
	const result = await readPabcdState(cwd, sessionId);
	if (result === null) return { envelope: null };
	if (!result.ok) return { error: `corrupt pabcd state at ${pabcdStatePath(cwd, sessionId)}: ${result.error}` };
	const value = result.value;
	if (sessionId && value.session_id !== undefined && value.session_id !== sessionId) {
		return { envelope: null };
	}
	if (sessionId && value.session_id === undefined) {
		return { envelope: null };
	}
	const stage = typeof value.current_phase === "string" && isStage(value.current_phase) ? value.current_phase : null;
	if (stage === null) return { error: `pabcd state has unknown stage: ${String(value.current_phase)}` };
	return {
		envelope: {
			skill: "pabcd",
			version: typeof value.version === "number" ? value.version : WORKFLOW_STATE_VERSION,
			updated_at: value.updated_at ?? new Date().toISOString(),
			current_phase: stage,
			active: value.active ?? true,
			...(value.session_id !== undefined ? { session_id: value.session_id } : {}),
			...(value.spec_ref !== undefined ? { spec_ref: value.spec_ref } : {}),
			...(value.plan_ref !== undefined ? { plan_ref: value.plan_ref } : {}),
			ctx: (value.ctx as PabcdCtx | undefined) ?? {},
		},
	};
}

function statusText(envelope: PabcdEnvelope | null, json: boolean): string {
	if (json) {
		return `${JSON.stringify(
			envelope
				? {
						active: envelope.active,
						stage: envelope.current_phase,
						spec_ref: envelope.spec_ref ?? null,
						plan_ref: envelope.plan_ref ?? null,
						ctx: envelope.ctx ?? {},
					}
				: { active: false, stage: null },
		)}\n`;
	}
	if (!envelope) {
		return "pabcd: idle (no active orchestration)\nStart with: jwc orchestrate i (interview) or jwc orchestrate p (plan directly)\n";
	}
	const ctx = envelope.ctx ?? {};
	const stage = envelope.current_phase;
	// cli-jaw status-parity (99.00.03 P1-1): one field per line, gates always
	// shown with pending defaults, next action derived from the gate state.
	const nextAction =
		stage === "p" && ctx.p_review_passed !== true && !ctx.p_review_override?.synthesis_ref
			? "record Critic OKAY, revise after ITERATE/REJECT, or record a waiver synthesis with --review-override-ref"
			: stage === "a" && ctx.audit_status !== "pass"
				? "record lens audit verdicts with --audit-lens/--revision-id, synthesize FAILs, or pass --user-approved"
				: stage === "b" && ctx.verification_status !== "done"
					? "record the verification verdict (orchestrate verdict --worker-output <file>) or pass --user-approved"
					: stage === "complete"
						? "start a new cycle: jwc orchestrate i (or p)"
						: `advance with: jwc orchestrate ${nextStageFor(stage)}`;
	const lines = [
		`Stage:        ${stage}${envelope.active === false ? " (inactive)" : ""}`,
		`Scope:        ${envelope.session_id ? `session ${envelope.session_id}` : "shared"}`,
		`Audit:        ${ctx.audit_status ?? "pending"}${ctx.a_audit_mode ? ` (${ctx.a_audit_mode}${ctx.a_round ? `, round ${ctx.a_round}` : ""}${ctx.a_revision_id ? `, ${ctx.a_revision_id}` : ""})` : ""}`,
		`Plan review:  ${ctx.p_review_passed ? "okay" : ctx.p_review_override?.synthesis_ref ? "waived" : "pending"}`,
		`Verification: ${ctx.verification_status ?? "pending"}`,
		`Approved:     ${ctx.user_approved ? "yes" : "no"}`,
		`Spec:         ${envelope.spec_ref ?? "-"}`,
		`Plan:         ${envelope.plan_ref ?? "-"}`,
		`Next:         ${nextAction}`,
	];
	return `pabcd status\n${lines.join("\n")}\n`;
}

function nextStageFor(stage: string): string {
	const order = ["i", "p", "a", "b", "c", "d"];
	const idx = order.indexOf(stage);
	return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : "d";
}

function currentARevisionId(ctx: PabcdCtx, args: ParsedArgs): string {
	return args.revisionId ?? ctx.a_revision_id ?? `a-r${ctx.a_round ?? 0}`;
}

function computeAggregateAuditStatus(ctx: PabcdCtx): PabcdAuditVerdict {
	const revision = ctx.a_revision_id;
	if (!revision) return "pending";
	if (ctx.a_synthesis_required) return "fail";

	const architect = ctx.a_lens_verdicts?.architect;
	const planner = ctx.a_lens_verdicts?.planner;
	const architectPassed = architect?.status === "pass" && architect.revision_id === revision;
	if ((ctx.a_audit_mode ?? "dual") === "solo") return architectPassed ? "pass" : "pending";

	const plannerPassed = planner?.status === "pass" && planner.revision_id === revision;
	return architectPassed && plannerPassed ? "pass" : "pending";
}

function nextCtxFor(target: PabcdStage, current: PabcdCtx, args: ParsedArgs): PabcdCtx {
	const ctx: PabcdCtx = { ...current };
	// user_approved is a per-transition override, never persisted (cli-jaw parity).
	delete ctx.user_approved;
	if (target !== "complete") {
		ctx.actor_namespace_id ??= `pabcd-${randomUUID()}`;
	}
	if (args.deliberate) ctx.deliberate = true;
	if (target === "p") {
		ctx.p_round = 0;
		ctx.p_review_passed = false;
		delete ctx.p_review_override;
	} else if (target === "a") {
		ctx.a_round = 0;
		ctx.a_revision_id = "a-r0";
		ctx.a_synthesis_required = false;
		ctx.a_lens_verdicts = {};
		ctx.audit_status = "pending";
		// D050-21: solo|dual decided at stage-a entry; --deliberate forces dual.
		ctx.a_audit_mode = ctx.deliberate ? "dual" : (args.auditMode ?? ctx.a_audit_mode ?? "dual");
	} else if (target === "b") {
		ctx.verification_status = "pending";
	}
	return ctx;
}

async function recordVerdict(cwd: string, args: ParsedArgs): Promise<OrchestrateCommandResult> {
	if (!args.workerOutput) {
		return { stderr: "orchestrate verdict requires --worker-output <path>\n", status: 2 };
	}
	let text: string;
	try {
		text = await fs.readFile(args.workerOutput, "utf-8");
	} catch (error) {
		return { stderr: `cannot read worker output: ${(error as Error).message}\n`, status: 2 };
	}
	const current = await readCurrent(cwd, args.sessionId);
	if ("error" in current) return { stderr: `${current.error}\n`, status: 2 };
	if (!current.envelope) return { stderr: "no active pabcd state — nothing to record a verdict against\n", status: 1 };
	const envelope = current.envelope;
	const ctx: PabcdCtx = { ...(envelope.ctx ?? {}) };
	const stage = envelope.current_phase;

	// Stage p uses the critic vocabulary (D050-23): OKAY|ITERATE|REJECT.
	if (stage === "p") {
		const criticVerdict = parseCriticVerdict(text);
		if (criticVerdict === null) {
			return { stderr: "no critic verdict token found (stage p expects OKAY|ITERATE|REJECT)\n", status: 1 };
		}
		if (criticVerdict === "okay") {
			ctx.p_review_passed = true;
			delete ctx.p_review_override;
		} else {
			ctx.p_review_passed = false;
			ctx.p_round = (ctx.p_round ?? 0) + 1;
			if (args.reviewOverrideRef) {
				ctx.p_review_override = {
					stage: "p",
					reason: `Critic ${criticVerdict.toUpperCase()} waived by main-session synthesis`,
					synthesis_ref: args.reviewOverrideRef,
					recorded_at: new Date().toISOString(),
				};
			} else {
				delete ctx.p_review_override;
			}
		}
		const written = await persist(cwd, { ...envelope, ctx }, args, "verdict", stage, stage);
		if ("error" in written) return { stderr: `${written.error}\n`, status: 2 };
		return { stdout: `verdict=${criticVerdict} recorded for stage p (p_round=${ctx.p_round ?? 0})\n`, status: 0 };
	}

	const verdict = parseWorkerVerdict(text);
	if (verdict === null) {
		return { stderr: "no verdict token found in worker output (expected PASS|FAIL|DONE|NEEDS_FIX)\n", status: 1 };
	}
	if (stage === "a" && (verdict === "pass" || verdict === "fail")) {
		if (!args.auditLens) {
			return { stderr: "stage a verdict requires --audit-lens planner|architect\n", status: 1 };
		}
		const previousRevisionId = ctx.a_revision_id;
		const revisionId = currentARevisionId(ctx, args);
		if (ctx.a_synthesis_required && revisionId !== previousRevisionId && !args.reviewOverrideRef) {
			return {
				stderr:
					"stage a revision changes after FAIL require --review-override-ref <synthesis-ref> before delta re-audit\n",
				status: 1,
			};
		}
		if (args.reviewOverrideRef || revisionId !== previousRevisionId) {
			ctx.a_synthesis_required = false;
			ctx.a_lens_verdicts = {};
		}
		ctx.a_revision_id = revisionId;
		ctx.a_lens_verdicts = {
			...(ctx.a_lens_verdicts ?? {}),
			[args.auditLens]: {
				status: verdict,
				revision_id: revisionId,
				worker_output_ref: args.workerOutput,
				recorded_at: new Date().toISOString(),
			},
		};
		if (verdict === "fail") {
			if (!ctx.a_synthesis_required) ctx.a_round = (ctx.a_round ?? 0) + 1;
			ctx.a_synthesis_required = true;
			ctx.audit_status = "fail";
			if ((ctx.a_round ?? 0) >= PABCD_MAX_A_ROUNDS) {
				const written = await persist(cwd, { ...envelope, ctx }, args, "verdict", stage, stage);
				if ("error" in written) return { stderr: `${written.error}\n`, status: 2 };
				return {
					stdout: `verdict=fail a_round=${ctx.a_round ?? 0} — round cap reached (≤${PABCD_MAX_A_ROUNDS}): escalate to the user (D050-20)\n`,
					status: 0,
				};
			}
		} else {
			ctx.audit_status = computeAggregateAuditStatus(ctx);
		}
	} else if (stage === "b" && (verdict === "done" || verdict === "needs_fix")) {
		ctx.verification_status = verdict;
	} else {
		return {
			stderr: `verdict ${verdict.toUpperCase()} does not apply to stage '${stage}' (a expects PASS|FAIL, b expects DONE|NEEDS_FIX)\n`,
			status: 1,
		};
	}
	const written = await persist(cwd, { ...envelope, ctx }, args, "verdict", stage, stage);
	if ("error" in written) return { stderr: `${written.error}\n`, status: 2 };
	return { stdout: `verdict=${verdict} recorded for stage ${stage}\n`, status: 0 };
}

async function retireActorsForTransition(
	cwd: string,
	args: ParsedArgs,
	envelope: PabcdEnvelope,
	fromPhase: string | undefined,
	toPhase: string,
): Promise<void> {
	const namespaceId = envelope.ctx?.actor_namespace_id;
	const sessionId = args.sessionId ?? envelope.session_id;
	if (!namespaceId || !sessionId) return;
	const registry = await readActorRegistry(cwd, sessionId);
	if (toPhase === "complete") {
		await writeActorRegistryAtomic(cwd, sessionId, retireNamespaceActors(registry, namespaceId));
		return;
	}
	if (!fromPhase || fromPhase === toPhase || !isStage(fromPhase) || fromPhase === "complete") return;
	await writeActorRegistryAtomic(cwd, sessionId, retireStageActors(registry, namespaceId, fromPhase));
}

async function persist(
	cwd: string,
	envelope: PabcdEnvelope,
	args: ParsedArgs,
	command: string,
	fromPhase: string | undefined,
	toPhase: string,
): Promise<{ path: string } | { error: string }> {
	const sessionId = args.sessionId ?? envelope.session_id;
	try {
		await retireActorsForTransition(cwd, args, envelope, fromPhase, toPhase);
		const filePath = await writeNativeWorkflowEnvelopeAtomic(
			cwd,
			{
				...envelope,
				updated_at: new Date().toISOString(),
				...(sessionId ? { session_id: sessionId } : {}),
			},
			{ command, sessionId, fromPhase, toPhase },
		);
		return { path: filePath };
	} catch (error) {
		return { error: (error as Error).message };
	}
}

export async function runNativeOrchestrateCommand(argv: string[], cwd: string): Promise<OrchestrateCommandResult> {
	const parsed = parseArgs(argv);
	if ("error" in parsed) return { stderr: `${parsed.error}\n`, status: 2 };
	const sub = parsed.positional[0]?.toLowerCase();

	if (sub === "reset") {
		if (!parsed.sessionId) parsed.sessionId = resolveCliWorkflowSessionId();
		return await resetPabcdState(cwd, parsed);
	}
	if (parsed.shared) {
		parsed.sessionId = undefined;
	} else if (!parsed.sessionId) {
		parsed.sessionId = resolveCliWorkflowSessionId();
	}

	if (sub === undefined || sub === "status") {
		const current = await readCurrent(cwd, parsed.sessionId);
		if ("error" in current) return { stderr: `${current.error}\n`, status: 2 };
		return { stdout: statusText(current.envelope, parsed.json), status: 0 };
	}

	if (sub === "verdict") return await recordVerdict(cwd, parsed);

	if (sub === "audit-prompt") {
		const lens = parsed.positional[1]?.toLowerCase();
		if (lens !== "planner" && lens !== "architect") {
			return { stderr: "orchestrate audit-prompt requires a lens: planner | architect\n", status: 2 };
		}
		const lensPointer = buildAuditLensSkillPointer(lens);
		const auditPrompt = lensPointer
			? `${ORCHESTRATE_AUDIT_PROMPTS[lens]}\n\n${lensPointer}`
			: ORCHESTRATE_AUDIT_PROMPTS[lens];
		return { stdout: auditPrompt, status: 0 };
	}

	if (!isStage(sub)) {
		return {
			stderr: `unknown stage '${sub}' (expected ${PABCD_STAGES.join("|")}, status, verdict, audit-prompt, reset)\n`,
			status: 2,
		};
	}
	const current = await readCurrent(cwd, parsed.sessionId);
	if ("error" in current) return { stderr: `${current.error}\n`, status: 2 };
	const from = current.envelope?.active ? current.envelope.current_phase : null;
	const target: PabcdStage = sub === "d" && (parsed.complete || from === "d") ? "complete" : sub;
	const baseCtx: PabcdCtx = current.envelope?.ctx ?? {};
	const gateCtx: PabcdCtx = parsed.userApproved ? { ...baseCtx, user_approved: true } : baseCtx;

	const transition = canTransitionPabcd(from, target, gateCtx);
	if (!transition.ok) return { stderr: `${transition.reason}\n`, status: 1 };

	const envelope: PabcdEnvelope = {
		skill: "pabcd",
		version: WORKFLOW_STATE_VERSION,
		updated_at: new Date().toISOString(),
		current_phase: target,
		active: target !== "complete",
		...(parsed.specRef !== undefined
			? { spec_ref: parsed.specRef }
			: current.envelope?.spec_ref !== undefined
				? { spec_ref: current.envelope.spec_ref }
				: {}),
		...(parsed.planRef !== undefined
			? { plan_ref: parsed.planRef }
			: current.envelope?.plan_ref !== undefined
				? { plan_ref: current.envelope.plan_ref }
				: {}),
		ctx: nextCtxFor(target, baseCtx, parsed),
	};

	const written = await persist(cwd, envelope, parsed, `orchestrate ${target}`, from ?? undefined, target);
	if ("error" in written) return { stderr: `${written.error}\n`, status: 2 };

	// 99.08-B — the pipeline reports, the ledger receives: one checkpoint per
	// stage transition (verdict recordings excluded by construction — this is
	// the transition path only). Best-effort: a ledger problem must never
	// fail the transition. Direct internal call, no shell-out.
	await recordGoalCheckpointForTransition(cwd, from ?? "idle", target, envelope);
	if (target === "p") {
		await retireJawInterviewStateForWorkflowExit({
			cwd,
			sessionId: parsed.sessionId,
			reason: "orchestrate-p",
		});
	}

	if (parsed.json) {
		return { stdout: `${JSON.stringify({ ok: true, from, to: target, state_path: written.path })}\n`, status: 0 };
	}
	const stagePointer = target === "complete" ? null : buildStageSkillPointer(target);
	const basePrompt = target === "complete" ? "pabcd: orchestration complete — state closed.\n" : STAGE_PROMPTS[target];
	const prompt = stagePointer ? `${basePrompt}\n\n${stagePointer}` : basePrompt;
	return { stdout: `✅ pabcd → ${target}\n\n${prompt}`, status: 0 };
}

/** 99.08-B: append a goal-ledger checkpoint for a pabcd stage transition (no-op without an active goal). */
async function recordGoalCheckpointForTransition(
	cwd: string,
	from: string,
	to: string,
	envelope: { ctx?: { audit_status?: string; verification_status?: string }; plan_ref?: string },
): Promise<void> {
	try {
		const plan = await readGoalPlan(cwd);
		if (!plan) return;
		const goal = plan.goals.find(item => item.status === "active");
		if (!goal) return;
		const gateNotes: string[] = [];
		if (envelope.ctx?.audit_status) gateNotes.push(`audit=${envelope.ctx.audit_status}`);
		if (envelope.ctx?.verification_status) gateNotes.push(`verification=${envelope.ctx.verification_status}`);
		const summary = `pabcd ${from}\u2192${to}${gateNotes.length > 0 ? ` (${gateNotes.join(", ")})` : ""}`;
		const evidence = [summary, pabcdStatePath(cwd), envelope.plan_ref].filter(Boolean).join("; ");
		await checkpointGoal({ cwd, goalId: goal.id, status: "active", evidence });
	} catch {
		// fusion is additive — transitions never fail on ledger errors
	}
}

/**
 * `jwc orchestrate reset` — cli-jaw parity: return to IDLE from ANY state by
 * deleting the pabcd state file (context cleared). Non-interactive by design
 * (99.07.00 §4-2): prints a summary and proceeds — no confirmation prompt.
 * Deletes only `pabcd-state.json`; it may also retire same-scope stale
 * `jaw-interview` activity so returning to idle does not leave interview guards/HUD stuck.
 */
async function resetPabcdState(
	cwd: string,
	parsed: { sessionId?: string; shared?: boolean; dryRun?: boolean; json?: boolean },
): Promise<OrchestrateCommandResult> {
	const targets: Array<{ label: string; path: string }> = [];
	if (parsed.sessionId)
		targets.push({ label: `session ${parsed.sessionId}`, path: pabcdStatePath(cwd, parsed.sessionId) });
	if (!parsed.sessionId || parsed.shared) targets.push({ label: "shared", path: pabcdStatePath(cwd) });

	const lines: string[] = [];
	const removed: string[] = [];
	for (const target of targets) {
		const current = await readPabcdState(cwd, target.label === "shared" ? undefined : parsed.sessionId);
		let summary = "absent";
		try {
			const raw = await fs.readFile(target.path, "utf8");
			const envelope = JSON.parse(raw) as { current_phase?: string; spec_ref?: string; active?: boolean };
			summary = `stage=${envelope.current_phase ?? "?"}${envelope.spec_ref ? ` spec_ref=${envelope.spec_ref}` : ""}${envelope.active === false ? " (inactive)" : ""}`;
		} catch {
			// absent or unreadable — treat as idle no-op for this target
			void current;
		}
		if (summary === "absent") {
			lines.push(`${target.label}: no pabcd state (already idle)`);
			continue;
		}
		if (parsed.dryRun) {
			lines.push(`${target.label}: would reset (${summary}) — ${target.path}`);
			continue;
		}
		try {
			const namespaceId =
				current?.ok && typeof current.value.ctx?.actor_namespace_id === "string"
					? current.value.ctx.actor_namespace_id
					: undefined;
			if (namespaceId && parsed.sessionId) {
				const registry = await readActorRegistry(cwd, parsed.sessionId);
				await writeActorRegistryAtomic(cwd, parsed.sessionId, retireNamespaceActors(registry, namespaceId));
			}
			await fs.unlink(target.path);
			await retireJawInterviewStateForWorkflowExit({
				cwd,
				sessionId: target.label === "shared" ? undefined : parsed.sessionId,
				reason: "orchestrate-reset",
				includeActiveInterview: true,
			});
			removed.push(target.path);
			lines.push(`${target.label}: reset (${summary})`);
		} catch (error) {
			return { stderr: `orchestrate reset failed for ${target.path}: ${String(error)}\n`, status: 1 };
		}
	}

	if (parsed.json) {
		return { stdout: `${JSON.stringify({ ok: true, dry_run: parsed.dryRun ?? false, removed })}\n`, status: 0 };
	}
	const verb = parsed.dryRun ? "(dry-run) " : "";
	return {
		stdout: `${verb}\u2705 pabcd \u2192 idle\n${lines.join("\n")}\nRe-enter anytime: jwc orchestrate i (interview) or jwc orchestrate p (plan directly).\n`,
		status: 0,
	};
}
