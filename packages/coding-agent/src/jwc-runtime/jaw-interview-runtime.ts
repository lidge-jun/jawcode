import { createHash, randomBytes } from "node:crypto";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { syncSkillActiveState } from "../skill-state/active-state";
import { buildJawInterviewHudSummary } from "../skill-state/workflow-hud";
import { WORKFLOW_STATE_VERSION } from "../skill-state/workflow-state-contract";
import { runNativePlanWriterCommand } from "./plan-writer";
import { runNativeStateCommand } from "./state-runtime";
import {
	appendJsonl,
	readActiveEntries,
	readExistingStateForMutation,
	rebuildActiveSnapshot,
	removeActiveEntry,
	writeArtifact,
	writeWorkflowEnvelopeAtomic,
} from "./state-writer";

/**
 * Native implementation of `jwc interview`.
 *
 * The CLI itself does not run the Socratic interview; that lives inside the `/skill:jaw-interview`
 * skill executed by the agent. This handler validates the documented argument-hint surface
 * (`[--quick|--standard|--deep] <idea>`), seeds `.jwc/state/jaw-interview-state.json`, and
 * updates the shared HUD rail via `syncSkillActiveState` so the active interview is visible to
 * the TUI.
 */

export interface JawInterviewCommandResult {
	status: number;
	stdout?: string;
	stderr?: string;
}

const PATH_COMPONENT_RE = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,63}$/;

const DEFAULT_AMBIGUITY_THRESHOLD = 0.05;

const RESOLUTION_THRESHOLDS = {
	quick: 0.6,
	standard: 0.5,
	deep: 0.35,
} as const;

type JawInterviewResolution = keyof typeof RESOLUTION_THRESHOLDS;

class JawInterviewCommandError extends Error {
	constructor(
		public readonly exitStatus: number,
		message: string,
	) {
		super(message);
		this.name = "JawInterviewCommandError";
	}
}

const VALUE_FLAGS = new Set([
	"--session-id",
	"--threshold",
	"--threshold-source",
	"--stage",
	"--slug",
	"--spec",
	"--handoff",
]);

function flagValue(args: readonly string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	if (index < 0) return undefined;
	return args[index + 1];
}

function hasFlag(args: readonly string[], flag: string): boolean {
	return args.includes(flag);
}

function assertSafePathComponent(value: string, label: string): void {
	if (!PATH_COMPONENT_RE.test(value) || value.includes("..")) {
		throw new JawInterviewCommandError(2, `invalid path component for --${label}: ${value}`);
	}
}

function encodeSessionSegment(value: string): string {
	return encodeURIComponent(value).replaceAll(".", "%2E");
}

function defaultSpecSlug(now: Date = new Date()): string {
	const yyyy = now.getUTCFullYear().toString().padStart(4, "0");
	const mm = (now.getUTCMonth() + 1).toString().padStart(2, "0");
	const dd = now.getUTCDate().toString().padStart(2, "0");
	const hh = now.getUTCHours().toString().padStart(2, "0");
	const min = now.getUTCMinutes().toString().padStart(2, "0");
	return `${yyyy}-${mm}-${dd}-${hh}${min}-${randomBytes(2).toString("hex")}`;
}

function stateDirFor(cwd: string, sessionId: string | undefined): string {
	return sessionId
		? path.join(cwd, ".jwc", "state", "sessions", encodeSessionSegment(sessionId))
		: path.join(cwd, ".jwc", "state");
}

/** Session scoping parity with orchestrate (8331c03b): flag wins, env fallback. */
function resolveSessionIdWithEnv(flagSessionId: string | undefined): string | undefined {
	if (flagSessionId) return flagSessionId;
	const envSession = (process.env.JWC_SESSION_ID ?? process.env.GJC_SESSION_ID ?? "").trim();
	return envSession || undefined;
}

function jawInterviewStatePath(cwd: string, sessionId: string | undefined): string {
	return path.join(stateDirFor(cwd, sessionId), "jaw-interview-state.json");
}

async function resolveSpecContent(rawSpec: string, cwd: string): Promise<string> {
	const candidate = path.isAbsolute(rawSpec) ? rawSpec : path.resolve(cwd, rawSpec);
	try {
		const stat = await fs.stat(candidate);
		if (stat.isFile()) return await fs.readFile(candidate, "utf-8");
	} catch (error) {
		const err = error as NodeJS.ErrnoException;
		if (err.code !== "ENOENT" && err.code !== "ENOTDIR") {
			throw new JawInterviewCommandError(2, `failed to read --spec ${candidate}: ${err.message}`);
		}
	}
	return rawSpec;
}

interface ResolvedJawInterviewArgs {
	resolution: JawInterviewResolution;
	threshold: number;
	thresholdSource: string;
	sessionId?: string;
	idea: string;
	language?: JawInterviewLanguagePreference;
	json: boolean;
}

interface JawInterviewLanguagePreference {
	code: "en" | "ko";
	label: "English" | "Korean";
	source: "explicit-user-request" | "initial-idea";
	instruction: string;
}

export interface ResolvedJawInterviewSpecWriteArgs {
	stage: "final";
	slug: string;
	spec: string;
	sessionId?: string;
	json: boolean;
	deliberate: boolean;
	handoff?: "plan" | "ralplan";
	force: boolean;
}

export interface PersistedJawInterviewSpec {
	slug: string;
	path: string;
	stage: "final";
	sha256: string;
	createdAt: string;
	statePath: string;
}

interface JawInterviewSpecWriteSummary {
	skill: "jaw-interview";
	stage: "final";
	slug: string;
	path: string;
	sha256: string;
	spec_path: string;
	sha: string;
	created_at: string;
	state_path: string;
	handoff?: {
		to: "plan";
		mode: "deliberate";
		state_path?: string;
		run_id?: string;
	};
}

async function readSettingsAmbiguityThreshold(
	settingsPath: string,
): Promise<{ threshold: number; source: string } | undefined> {
	let raw: string;
	try {
		raw = await fs.readFile(settingsPath, "utf-8");
	} catch (error) {
		const err = error as NodeJS.ErrnoException;
		if (err.code === "ENOENT") return undefined;
		return undefined;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return undefined;
	}
	const candidate = readAmbiguityThresholdCandidate(parsed);
	if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate <= 0 || candidate > 1) {
		return undefined;
	}
	return { threshold: candidate, source: settingsPath };
}

/** New `jwc.interview.*` key first, legacy `gjc.deepInterview.*` read-fallback (042 D041-D). */
function readAmbiguityThresholdCandidate(parsed: unknown): unknown {
	const root = parsed as {
		jwc?: { interview?: { ambiguityThreshold?: unknown } };
		gjc?: { deepInterview?: { ambiguityThreshold?: unknown } };
	};
	return root?.jwc?.interview?.ambiguityThreshold ?? root?.gjc?.deepInterview?.ambiguityThreshold;
}

function modernSettingsPath(): string {
	const configDir = process.env.GJC_CODING_AGENT_DIR?.trim() || process.env.PI_CODING_AGENT_DIR?.trim();
	if (configDir) return path.join(configDir, "config.yml");
	const configRoot = process.env.GJC_CONFIG_DIR?.trim() || process.env.PI_CONFIG_DIR?.trim();
	if (configRoot) return path.join(configRoot, "agent", "config.yml");
	return path.join(os.homedir(), ".jwc", "agent", "config.yml");
}

async function readModernSettingsAmbiguityThreshold(): Promise<{ threshold: number; source: string } | undefined> {
	const modernConfigPath = modernSettingsPath();
	let parsed: unknown;
	try {
		parsed = (await import("bun")).YAML.parse(await fs.readFile(modernConfigPath, "utf-8"));
	} catch {
		return undefined;
	}
	const candidate = readAmbiguityThresholdCandidate(parsed);
	if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate <= 0 || candidate > 1)
		return undefined;
	return { threshold: candidate, source: modernConfigPath };
}

async function resolveConfiguredAmbiguityThreshold(
	cwd: string,
): Promise<{ threshold: number; source: string } | undefined> {
	const modernValue = await readModernSettingsAmbiguityThreshold();
	if (modernValue) return modernValue;
	const projectSettings = path.join(cwd, ".jwc", "settings.json");
	const projectValue = await readSettingsAmbiguityThreshold(projectSettings);
	if (projectValue) return projectValue;
	const configDir = process.env.GJC_CONFIG_DIR?.trim() || path.join(os.homedir(), ".jwc");
	const userSettings = path.join(configDir, "settings.json");
	return await readSettingsAmbiguityThreshold(userSettings);
}

function englishLanguagePreference(): JawInterviewLanguagePreference {
	return {
		code: "en",
		label: "English",
		source: "explicit-user-request",
		instruction:
			"Ask every user-facing jaw-interview question in English because the user explicitly requested English.",
	};
}

function resolveJawInterviewLanguagePreference(idea: string): JawInterviewLanguagePreference | undefined {
	if (/\b(?:answer|ask|respond|reply|write|use|speak)\s+(?:only\s+)?in\s+English\b/i.test(idea)) {
		return englishLanguagePreference();
	}
	if (/(?:영어로|영문으로|영어\s*(?:질문|답변|응답)|English\s+only)/i.test(idea)) {
		return englishLanguagePreference();
	}
	if (/\p{Script=Hangul}/u.test(idea)) {
		return {
			code: "ko",
			label: "Korean",
			source: "initial-idea",
			instruction:
				"Ask every user-facing jaw-interview question in Korean unless the user explicitly requests another language.",
		};
	}
	return undefined;
}

function isJawInterviewSpecWriteInvocation(args: readonly string[]): boolean {
	return hasFlag(args, "--write");
}

async function resolveSpecWriteArgs(args: readonly string[], cwd: string): Promise<ResolvedJawInterviewSpecWriteArgs> {
	const stage = flagValue(args, "--stage")?.trim() || "final";
	if (stage !== "final") {
		throw new JawInterviewCommandError(2, 'unknown --stage for jaw-interview --write: expected "final"');
	}

	const slug = flagValue(args, "--slug")?.trim() || defaultSpecSlug();
	assertSafePathComponent(slug, "slug");

	const rawSpec = flagValue(args, "--spec");
	if (rawSpec === undefined || rawSpec === "") {
		throw new JawInterviewCommandError(2, "--spec is required for jaw-interview --write");
	}

	const sessionId = resolveSessionIdWithEnv(flagValue(args, "--session-id")?.trim() || undefined);
	if (sessionId) assertSafePathComponent(sessionId, "session-id");

	const rawHandoff = flagValue(args, "--handoff")?.trim() || undefined;
	if (rawHandoff && rawHandoff !== "plan" && rawHandoff !== "ralplan") {
		throw new JawInterviewCommandError(2, 'unknown --handoff target: expected "plan"');
	}

	const allowedFlags = new Set([
		"--write",
		"--stage",
		"--slug",
		"--spec",
		"--session-id",
		"--handoff",
		"--deliberate",
		"--json",
		"--force",
	]);
	let skipNext = false;
	for (const arg of args) {
		if (skipNext) {
			skipNext = false;
			continue;
		}
		if (["--stage", "--slug", "--spec", "--session-id", "--handoff"].includes(arg)) {
			skipNext = true;
			continue;
		}
		if (arg.startsWith("-") && !allowedFlags.has(arg)) {
			throw new JawInterviewCommandError(2, `unknown flag for jwc interview --write: ${arg}`);
		}
	}

	return {
		stage: "final",
		slug,
		spec: await resolveSpecContent(rawSpec, cwd),
		sessionId,
		json: hasFlag(args, "--json"),
		deliberate: hasFlag(args, "--deliberate"),
		force: hasFlag(args, "--force"),
		handoff: rawHandoff as "plan" | "ralplan" | undefined,
	};
}

async function resolveJawInterviewArgs(args: readonly string[], cwd: string): Promise<ResolvedJawInterviewArgs> {
	const sessionId = resolveSessionIdWithEnv(flagValue(args, "--session-id")?.trim() || undefined);
	if (sessionId) assertSafePathComponent(sessionId, "session-id");

	const explicitResolutions = (["quick", "standard", "deep"] as const).filter(name => hasFlag(args, `--${name}`));
	if (explicitResolutions.length > 1) {
		throw new JawInterviewCommandError(2, "pass at most one of --quick, --standard, --deep");
	}
	const resolution: JawInterviewResolution | undefined = explicitResolutions[0];

	// Precedence: --threshold > settings.json (project then user) > resolution flag default > 0.05.
	let threshold: number = DEFAULT_AMBIGUITY_THRESHOLD;
	let thresholdSource = "default";
	const thresholdOverride = flagValue(args, "--threshold");
	if (thresholdOverride !== undefined) {
		const parsed = Number(thresholdOverride);
		if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
			throw new JawInterviewCommandError(
				2,
				`invalid --threshold: ${thresholdOverride}. Expected 0 < threshold <= 1.`,
			);
		}
		threshold = parsed;
		thresholdSource = flagValue(args, "--threshold-source")?.trim() || "flag:--threshold";
	} else {
		const configured = await resolveConfiguredAmbiguityThreshold(cwd);
		if (configured) {
			threshold = configured.threshold;
			thresholdSource = configured.source;
		} else if (resolution) {
			threshold = RESOLUTION_THRESHOLDS[resolution];
			thresholdSource = `flag:--${resolution}`;
		}
	}

	const ideaParts: string[] = [];
	let skipNext = false;
	for (const arg of args) {
		if (skipNext) {
			skipNext = false;
			continue;
		}
		if (VALUE_FLAGS.has(arg)) {
			skipNext = true;
			continue;
		}
		if (arg === "--quick" || arg === "--standard" || arg === "--deep" || arg === "--json") continue;
		if (arg.startsWith("-")) {
			throw new JawInterviewCommandError(2, `unknown flag for jwc interview: ${arg}`);
		}
		ideaParts.push(arg);
	}
	const idea = ideaParts.join(" ").trim();
	const effectiveResolution: JawInterviewResolution = resolution ?? "standard";
	return {
		resolution: effectiveResolution,
		threshold,
		thresholdSource,
		sessionId,
		idea,
		language: resolveJawInterviewLanguagePreference(idea),
		json: hasFlag(args, "--json"),
	};
}

export async function persistJawInterviewSpec(
	cwd: string,
	resolved: ResolvedJawInterviewSpecWriteArgs,
): Promise<PersistedJawInterviewSpec> {
	const statePath = jawInterviewStatePath(cwd, resolved.sessionId);
	const existingRead = await readExistingStateForMutation(statePath);
	if (existingRead.kind === "corrupt" && !resolved.force) {
		throw new JawInterviewCommandError(
			2,
			`existing jaw-interview state is corrupt or tampered (${existingRead.error}); use --force to overwrite ${statePath}`,
		);
	}
	const existing = existingRead.kind === "valid" ? existingRead.value : {};

	const specPath = path.join(cwd, ".jwc", "specs", `jaw-interview-${resolved.slug}.md`);
	const content = resolved.spec.endsWith("\n") ? resolved.spec : `${resolved.spec}\n`;
	await writeArtifact(specPath, content, {
		cwd,
		audit: { category: "artifact", verb: "write", owner: "jwc-runtime", skill: "jaw-interview" },
	});

	const sha256 = createHash("sha256").update(content).digest("hex");
	const createdAt = new Date().toISOString();
	await appendJsonl(
		path.join(cwd, ".jwc", "specs", "jaw-interview-index.jsonl"),
		{ slug: resolved.slug, stage: resolved.stage, path: specPath, created_at: createdAt, sha256 },
		{ cwd, audit: { category: "ledger", verb: "append", owner: "jwc-runtime", skill: "jaw-interview" } },
	);

	const payload: Record<string, unknown> = {
		...existing,
		active: true,
		current_phase: "handoff",
		skill: "jaw-interview",
		version: WORKFLOW_STATE_VERSION,
		spec_slug: resolved.slug,
		spec_path: specPath,
		spec_sha256: sha256,
		spec_stage: resolved.stage,
		spec_persisted_at: createdAt,
		updated_at: createdAt,
	};
	if (resolved.sessionId) payload.session_id = resolved.sessionId;
	await writeWorkflowEnvelopeAtomic(statePath, payload, {
		cwd,
		receipt: {
			cwd,
			skill: "jaw-interview",
			owner: "jwc-runtime",
			command: "jwc interview persist-spec-state",
			sessionId: resolved.sessionId,
			nowIso: createdAt,
		},
		audit: {
			category: "state",
			verb: "write",
			owner: "jwc-runtime",
			skill: "jaw-interview",
			forced: resolved.force,
		},
	});
	await syncJawInterviewHud({
		cwd,
		sessionId: resolved.sessionId,
		phase: "handoff",
		specStatus: "persisted",
	});

	return {
		slug: resolved.slug,
		path: specPath,
		stage: resolved.stage,
		sha256,
		createdAt,
		statePath,
	};
}

export type JawInterviewWorkflowExitReason = "orchestrate-p" | "orchestrate-reset";

async function retireJawInterviewActiveState(input: {
	cwd: string;
	sessionId?: string;
	phase: string;
	updatedAt: string;
}): Promise<void> {
	if (input.sessionId) {
		const sessionScope = { sessionId: input.sessionId };
		const audit = { category: "state" as const, verb: "retire-active-entry", owner: "jwc-runtime" as const };
		await removeActiveEntry(input.cwd, sessionScope, "jaw-interview", { cwd: input.cwd, audit });
		await rebuildActiveSnapshot(input.cwd, sessionScope, { cwd: input.cwd, audit });
		const rootEntries = await readActiveEntries(input.cwd);
		const rootJawInterview = rootEntries.find(entry => entry.skill === "jaw-interview");
		if (rootJawInterview?.session_id === input.sessionId) {
			await removeActiveEntry(input.cwd, undefined, "jaw-interview", { cwd: input.cwd, audit });
			await rebuildActiveSnapshot(input.cwd, undefined, { cwd: input.cwd, audit });
			const rootModeState = await readExistingStateForMutation(jawInterviewStatePath(input.cwd, undefined));
			if (rootModeState.kind === "valid" && rootModeState.value.active === true) {
				const rootPhase = String(rootModeState.value.current_phase ?? "active");
				await syncSkillActiveState({
					cwd: input.cwd,
					skill: "jaw-interview",
					active: true,
					phase: rootPhase,
					source: "jwc-interview-native",
					hud: buildJawInterviewHudSummary({
						phase: rootPhase,
						updatedAt: input.updatedAt,
					}),
				});
			}
		}
		return;
	}
	await syncSkillActiveState({
		cwd: input.cwd,
		skill: "jaw-interview",
		active: false,
		phase: input.phase,
		source: "jwc-interview-native",
		hud: buildJawInterviewHudSummary({
			phase: input.phase,
			specStatus: "retired",
			updatedAt: input.updatedAt,
		}),
	});
}

export async function retireJawInterviewStateForWorkflowExit(input: {
	cwd: string;
	sessionId?: string;
	reason: JawInterviewWorkflowExitReason;
	includeActiveInterview?: boolean;
}): Promise<boolean> {
	const statePath = jawInterviewStatePath(input.cwd, input.sessionId);
	const existingRead = await readExistingStateForMutation(statePath);
	if (existingRead.kind !== "valid") return false;

	const existing = existingRead.value;
	if (existing.active !== true) return false;
	const phase = String(existing.current_phase ?? "")
		.trim()
		.toLowerCase();
	const canRetire = phase === "handoff" || (input.includeActiveInterview === true && phase === "interviewing");
	if (!canRetire) return false;

	const now = new Date().toISOString();
	const retiredPhase = phase || "inactive";
	await writeWorkflowEnvelopeAtomic(
		statePath,
		{
			...existing,
			active: false,
			current_phase: retiredPhase,
			workflow_exit_reason: input.reason,
			updated_at: now,
			...(input.sessionId ? { session_id: input.sessionId } : {}),
		},
		{
			cwd: input.cwd,
			receipt: {
				cwd: input.cwd,
				skill: "jaw-interview",
				owner: "jwc-runtime",
				command: `jwc interview retire ${input.reason}`,
				sessionId: input.sessionId,
				nowIso: now,
			},
			audit: {
				category: "state",
				verb: "retire",
				owner: "jwc-runtime",
				skill: "jaw-interview",
				fromPhase: phase,
				toPhase: retiredPhase,
			},
		},
	);

	await retireJawInterviewActiveState({
		cwd: input.cwd,
		sessionId: input.sessionId,
		phase: retiredPhase,
		updatedAt: now,
	});
	return true;
}

async function seedJawInterviewState(cwd: string, resolved: ResolvedJawInterviewArgs): Promise<string> {
	const statePath = jawInterviewStatePath(cwd, resolved.sessionId);
	const now = new Date().toISOString();
	const payload: Record<string, unknown> = {
		active: true,
		current_phase: "interviewing",
		skill: "jaw-interview",
		version: WORKFLOW_STATE_VERSION,
		resolution: resolved.resolution,
		threshold: resolved.threshold,
		threshold_source: resolved.thresholdSource,
		state: {
			initial_idea: resolved.idea,
			rounds: [],
			current_ambiguity: 1.0,
			threshold: resolved.threshold,
			threshold_source: resolved.thresholdSource,
		},
		updated_at: now,
	};
	if (resolved.language) {
		payload.language = resolved.language;
		(payload.state as Record<string, unknown>).language = resolved.language;
	}
	if (resolved.sessionId) payload.session_id = resolved.sessionId;
	await writeWorkflowEnvelopeAtomic(statePath, payload, {
		cwd,
		receipt: {
			cwd,
			skill: "jaw-interview",
			owner: "jwc-runtime",
			command: "jwc interview seed",
			sessionId: resolved.sessionId,
			nowIso: now,
		},
		audit: { category: "state", verb: "write", owner: "jwc-runtime", skill: "jaw-interview" },
	});
	return statePath;
}

async function syncJawInterviewHud(options: {
	cwd: string;
	sessionId?: string;
	phase: string;
	ambiguity?: number;
	threshold?: number;
	roundCount?: number;
	specStatus?: string;
}): Promise<void> {
	try {
		await syncSkillActiveState({
			cwd: options.cwd,
			skill: "jaw-interview",
			active: options.phase !== "complete",
			phase: options.phase,
			sessionId: options.sessionId,
			source: "jwc-interview-native",
			hud: buildJawInterviewHudSummary({
				phase: options.phase,
				ambiguity: options.ambiguity,
				threshold: options.threshold,
				roundCount: options.roundCount,
				specStatus: options.specStatus,
				updatedAt: new Date().toISOString(),
			}),
		});
	} catch {
		// HUD sync is best-effort and must not change command semantics.
	}
}

async function handleSpecWrite(args: readonly string[], cwd: string): Promise<JawInterviewCommandResult> {
	const resolved = await resolveSpecWriteArgs(args, cwd);
	const persisted = await persistJawInterviewSpec(cwd, resolved);
	const shouldHandoff = resolved.deliberate || resolved.handoff === "plan" || resolved.handoff === "ralplan";
	const summary: JawInterviewSpecWriteSummary = {
		skill: "jaw-interview",
		stage: persisted.stage,
		slug: persisted.slug,
		path: persisted.path,
		sha256: persisted.sha256,
		spec_path: persisted.path,
		sha: persisted.sha256,
		created_at: persisted.createdAt,
		state_path: persisted.statePath,
	};

	if (shouldHandoff) {
		const planphaseArgs = ["--deliberate", "--json"];
		if (resolved.sessionId) planphaseArgs.push("--session-id", resolved.sessionId);
		planphaseArgs.push(persisted.path);
		const planphaseResult = await runNativePlanWriterCommand(planphaseArgs, cwd);
		if (planphaseResult.status !== 0) {
			throw new JawInterviewCommandError(
				planphaseResult.status,
				planphaseResult.stderr?.trim() || "failed to seed planphase",
			);
		}

		const handoffArgs = ["handoff", "--mode", "jaw-interview", "--to", "plan", "--json"];
		if (resolved.sessionId) handoffArgs.push("--session-id", resolved.sessionId);
		else handoffArgs.push("--session-id", "");
		const handoffResult = await runNativeStateCommand(handoffArgs, cwd);
		if (handoffResult.status !== 0) {
			throw new JawInterviewCommandError(
				handoffResult.status,
				handoffResult.stderr?.trim() || "failed to hand off jaw-interview to plan",
			);
		}

		const planphasePayload = planphaseResult.stdout
			? (JSON.parse(planphaseResult.stdout) as Record<string, unknown>)
			: {};
		summary.handoff = {
			to: "plan",
			mode: "deliberate",
			state_path: typeof planphasePayload.state_path === "string" ? planphasePayload.state_path : undefined,
			run_id: typeof planphasePayload.run_id === "string" ? planphasePayload.run_id : undefined,
		};
	}

	const stdout = resolved.json
		? `${JSON.stringify(summary)}\n`
		: [
				`jaw-interview spec_path=${persisted.path}`,
				`sha=${persisted.sha256}`,
				`state_path=${persisted.statePath}`,
				shouldHandoff
					? `handoff=plan run_id=${summary.handoff?.run_id ?? ""} state_path=${summary.handoff?.state_path ?? ""}`
					: undefined,
				"",
			]
				.filter((line): line is string => Boolean(line))
				.join("\n");
	return { status: 0, stdout };
}

export async function runNativeJawInterviewCommand(
	args: string[],
	cwd = process.cwd(),
): Promise<JawInterviewCommandResult> {
	try {
		if (isJawInterviewSpecWriteInvocation(args)) return await handleSpecWrite(args, cwd);
		if (args[0] === "cancel") return await handleInterviewCancel(args, cwd);
		const resolved = await resolveJawInterviewArgs(args, cwd);
		if (!resolved.idea) {
			throw new JawInterviewCommandError(2, 'jwc interview requires an idea, e.g. `jwc interview "<idea>"`.');
		}
		const statePath = await seedJawInterviewState(cwd, resolved);
		await syncJawInterviewHud({
			cwd,
			sessionId: resolved.sessionId,
			phase: "interviewing",
			ambiguity: 1,
			threshold: resolved.threshold,
			roundCount: 0,
		});

		const summary = {
			skill: "jaw-interview",
			resolution: resolved.resolution,
			threshold: resolved.threshold,
			threshold_source: resolved.thresholdSource,
			idea: resolved.idea,
			language: resolved.language,
			state_path: statePath,
			handoff: "/skill:jaw-interview",
		};
		const stdout = resolved.json
			? `${JSON.stringify(summary)}\n`
			: [
					`jaw-interview seed state_path=${statePath}`,
					`resolution=${resolved.resolution} threshold=${resolved.threshold} threshold_source=${resolved.thresholdSource}`,
					"handoff=/skill:jaw-interview",
					"",
				].join("\n");
		return { status: 0, stdout };
	} catch (error) {
		if (error instanceof JawInterviewCommandError) return { status: error.exitStatus, stderr: `${error.message}\n` };
		return { status: 1, stderr: `${error instanceof Error ? error.message : String(error)}\n` };
	}
}

/**
 * `jwc interview cancel` (99.07 U2) — close an in-flight interview cleanly:
 * delete the session-scoped (env JWC_SESSION_ID or --session-id) state file
 * and sync the HUD inactive. Replaces the `--force` phase-bypass workaround
 * (260613 00:34 live incident: model tried an unknown "cancelled" phase).
 */
async function handleInterviewCancel(args: readonly string[], cwd: string): Promise<JawInterviewCommandResult> {
	let sessionId: string | undefined;
	for (let i = 1; i < args.length; i++) {
		if (args[i] === "--session-id" && args[i + 1]) sessionId = args[++i];
	}
	if (!sessionId) {
		const envSession = (process.env.JWC_SESSION_ID ?? process.env.GJC_SESSION_ID ?? "").trim();
		if (envSession) sessionId = envSession;
	}
	const targets = sessionId
		? [jawInterviewStatePath(cwd, sessionId), jawInterviewStatePath(cwd, undefined)]
		: [jawInterviewStatePath(cwd, undefined)];
	const lines: string[] = [];
	for (const target of targets) {
		try {
			await fs.unlink(target);
			lines.push(`cancelled: ${target}`);
		} catch {
			lines.push(`no interview state: ${target}`);
		}
	}
	await syncJawInterviewHud({ cwd, sessionId, phase: "complete" });
	return { status: 0, stdout: `${lines.join("\n")}\njaw-interview closed (HUD inactive).\n` };
}
