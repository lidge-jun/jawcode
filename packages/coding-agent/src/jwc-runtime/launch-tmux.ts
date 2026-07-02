import type { Args } from "../cli/args";
import {
	buildJwcTmuxExactOptionTarget,
	buildJwcTmuxExactSessionTarget,
	buildJwcTmuxProfileCommands,
	buildJwcTmuxSessionName,
	buildJwcTmuxSessionSlug,
	GJC_DEFAULT_TMUX_SESSION,
	GJC_TMUX_COMMAND_ENV,
	GJC_TMUX_MOUSE_ENV,
	GJC_TMUX_PROFILE_ENV,
	GJC_TMUX_SESSION_PREFIX,
	type JwcTmuxProfileCommand,
	resolveJwcTmuxBinary,
	resolveJwcTmuxCommand,
} from "./tmux-common";
import { buildJwcTmuxInnerCommand } from "./tmux-inner-command";
import { findJwcTmuxSessionByBranch } from "./tmux-sessions";
import {
	buildJwcTmuxRootTerminalTitle,
	buildJwcTmuxRootTerminalTitleCommands,
	buildJwcTmuxWindowTitle,
} from "./tmux-title";

export {
	buildJwcTmuxProfileCommands,
	buildJwcTmuxWindowTitle,
	GJC_DEFAULT_TMUX_SESSION,
	GJC_TMUX_COMMAND_ENV,
	GJC_TMUX_MOUSE_ENV,
	GJC_TMUX_PROFILE_ENV,
	GJC_TMUX_SESSION_PREFIX,
};

export const GJC_TMUX_LAUNCHED_ENV = "GJC_TMUX_LAUNCHED";
export const GJC_LAUNCH_POLICY_ENV = "GJC_LAUNCH_POLICY";
const WINDOWS_PSMUX_ATTACH_RETRY_DELAY_MS = 100;

type LaunchPolicy = "direct" | "tmux";

interface TtyState {
	stdin: boolean;
	stdout: boolean;
}

export interface TmuxLaunchContext {
	parsed: Args;
	rawArgs: string[];
	cwd?: string;
	env?: NodeJS.ProcessEnv;
	argv?: string[];
	execPath?: string;
	platform?: NodeJS.Platform;
	tty?: TtyState;
	spawnSync?: TmuxSpawnSync;
	tmuxAvailable?: boolean;
	worktreeBranch?: string | null;
	currentBranch?: string | null;
	existingBranchSessionName?: string | null;
	project?: string | null;
	diagnosticWriter?: (message: string) => void;
}

export interface TmuxSpawnResult {
	exitCode: number | null;
	signalCode?: string | null;
	stderr?: string;
}

export type TmuxSpawnSync = (command: string, args: string[], options: TmuxSpawnOptions) => TmuxSpawnResult;

export interface TmuxSpawnOptions {
	cwd: string;
	env: NodeJS.ProcessEnv;
	stdin: "inherit" | "pipe";
	stdout: "inherit" | "pipe";
	stderr: "inherit" | "pipe";
	captureStderr?: boolean;
}

export interface TmuxLaunchPlan {
	tmuxCommand: string;
	sessionName: string;
	cwd: string;
	innerCommand: string;
	newSessionArgs: string[];
	branch?: string | null;
	attachSessionName?: string;
	project?: string | null;
}

export interface JwcTmuxProfileResult {
	skipped: boolean;
	commands: JwcTmuxProfileCommand[];
	failures: Array<{ command: JwcTmuxProfileCommand; stderr?: string }>;
}

export interface JwcTmuxProfileContext {
	tmuxCommand: string;
	target: string;
	cwd?: string;
	env?: NodeJS.ProcessEnv;
	spawnSync?: TmuxSpawnSync;
	branch?: string | null;
	branchSlug?: string | null;
	project?: string | null;
}

function parseLaunchPolicy(env: NodeJS.ProcessEnv): LaunchPolicy {
	const raw = (env.JWC_LAUNCH_POLICY ?? env[GJC_LAUNCH_POLICY_ENV])?.trim().toLowerCase();
	if (raw === "direct" || raw === "tmux") return raw;
	if (env.GJC_NO_TMUX === "1" || env.GJC_NO_TMUX === "true") return "direct";
	return "tmux";
}

function isInteractiveRootLaunch(parsed: Args, tty: TtyState): boolean {
	return (
		tty.stdin &&
		tty.stdout &&
		!parsed.help &&
		!parsed.version &&
		!parsed.print &&
		parsed.mode === undefined &&
		parsed.export === undefined &&
		parsed.listModels === undefined
	);
}

function formatTmuxLaunchDiagnostic(stage: string, stderr?: string): string {
	const detail = stderr?.trim();
	const suffix = detail ? ` ${detail.slice(0, 240)}` : "";
	return `jwc --tmux failed after creating tmux session: ${stage}.${suffix}\n`;
}

function formatTmuxUnavailableDiagnostic(platform: NodeJS.Platform, tmuxCommand: string): string {
	if (platform === "win32") {
		return (
			`jwc --tmux requested but no tmux executable was found; starting without a tmux-backed session. ` +
			`JWC searched for psmux, pmux, and tmux on PATH (got \`${tmuxCommand}\`). ` +
			"Install psmux for native Windows tmux support, or use WSL with real tmux. " +
			"You can also point JWC at a specific binary via JWC_TMUX_COMMAND or GJC_TMUX_COMMAND.\n"
		);
	}
	return `jwc --tmux requested but no ${tmuxCommand} executable was found; starting without a tmux-backed session.\n`;
}

function writeDiagnostic(writer: ((message: string) => void) | undefined, message: string): void {
	try {
		(writer ?? process.stderr.write.bind(process.stderr))(message);
	} catch {
		// stderr may already be closed after an attach disconnect; diagnostics are best-effort.
	}
}

export function applyJwcTmuxProfile(context: JwcTmuxProfileContext): JwcTmuxProfileResult {
	const env = context.env ?? process.env;
	const branchSlug = context.branch ? buildJwcTmuxSessionSlug(context.branch) : (context.branchSlug ?? null);
	const commands = buildJwcTmuxProfileCommands(context.target, env, {
		branch: context.branch ?? null,
		branchSlug,
		project: context.project ?? null,
	});
	if (commands.length === 0) return { skipped: true, commands: [], failures: [] };
	const spawnSync = context.spawnSync ?? defaultSpawnSync;
	const cwd = context.cwd ?? process.cwd();
	const options: TmuxSpawnOptions = {
		cwd,
		env,
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
		captureStderr: true,
	};
	const failures: JwcTmuxProfileResult["failures"] = [];
	for (const command of commands) {
		const result = spawnSync(context.tmuxCommand, command.args, options);
		if (result.exitCode !== 0) failures.push({ command, stderr: result.stderr });
	}
	return { skipped: false, commands, failures };
}

function readCurrentBranch(cwd: string): string | null {
	try {
		const result = Bun.spawnSync(["git", "symbolic-ref", "--quiet", "--short", "HEAD"], {
			cwd,
			stdout: "pipe",
			stderr: "ignore",
		});
		if (result.exitCode !== 0) return null;
		const branch = result.stdout.toString().trim();
		return branch || null;
	} catch {
		return null;
	}
}

function cleanupCreatedTmuxSession(plan: TmuxLaunchPlan, spawnSync: TmuxSpawnSync, options: TmuxSpawnOptions): void {
	spawnSync(
		plan.tmuxCommand,
		["kill-session", "-t", buildJwcTmuxExactSessionTarget(plan.sessionName, { env: options.env })],
		options,
	);
}

function buildTmuxRenameWindowArgs(title: string, target?: string): string[] {
	return target ? ["rename-window", "-t", target, "--", title] : ["rename-window", "--", title];
}

function renameTmuxWindow(
	tmuxCommand: string,
	title: string,
	spawnSync: TmuxSpawnSync,
	options: TmuxSpawnOptions,
	target?: string,
): void {
	spawnSync(tmuxCommand, buildTmuxRenameWindowArgs(title, target), options);
}

function shouldSetJwcTmuxRootTerminalTitle(parsed: Args, env: NodeJS.ProcessEnv): boolean {
	return !parsed.noTitle && !env.PI_NO_TITLE;
}

function applyJwcTmuxRootTerminalTitleProfile(context: {
	tmuxCommand: string;
	target: string;
	title: string | undefined;
	spawnSync: TmuxSpawnSync;
	options: TmuxSpawnOptions;
	platform?: NodeJS.Platform;
}): void {
	if (!context.title) return;
	const binary = resolveJwcTmuxBinary({ env: context.options.env, platform: context.platform });
	if (binary.isPsmux) return;
	for (const command of buildJwcTmuxRootTerminalTitleCommands(
		buildJwcTmuxExactOptionTarget(context.target, { env: context.options.env, binary }),
		context.title,
	)) {
		context.spawnSync(context.tmuxCommand, command.args, { ...context.options, captureStderr: true });
	}
}

function renameExistingTmuxWindowIfNeeded(context: TmuxLaunchContext): void {
	const env = context.env ?? process.env;
	if (!env.TMUX || env[GJC_TMUX_LAUNCHED_ENV] === "1") return;
	if (parseLaunchPolicy(env) === "direct") return;
	const tty = context.tty ?? { stdin: Boolean(process.stdin.isTTY), stdout: Boolean(process.stdout.isTTY) };
	if (!isInteractiveRootLaunch(context.parsed, tty)) return;
	const platform = context.platform ?? process.platform;
	const tmuxCommand = resolveJwcTmuxCommand(env, platform);
	const tmuxAvailable = context.tmuxAvailable ?? Bun.which(tmuxCommand) !== null;
	if (!tmuxAvailable) return;
	const cwd = context.cwd ?? process.cwd();
	const branch = context.worktreeBranch ?? context.currentBranch ?? readCurrentBranch(cwd);
	const spawnSync = context.spawnSync ?? defaultSpawnSync;
	renameTmuxWindow(tmuxCommand, buildJwcTmuxWindowTitle(context.project ?? cwd, branch), spawnSync, {
		cwd,
		env,
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	});
}

function sleepSync(ms: number): void {
	const view = new Int32Array(new SharedArrayBuffer(4));
	Atomics.wait(view, 0, 0, ms);
}

function probeWithBackoff(probe: () => TmuxSpawnResult): TmuxSpawnResult {
	let result = probe();
	for (let attempt = 0; attempt < 2 && result.exitCode !== 0; attempt += 1) {
		sleepSync(25);
		result = probe();
	}
	return result;
}

function isTmuxAttachDisconnectError(result: TmuxSpawnResult): boolean {
	if (result.signalCode === "SIGHUP") return true;
	const stderr = result.stderr?.toLowerCase() ?? "";
	return stderr.includes("eio") || stderr.includes("input/output error");
}

function isWindowsPsmuxAttachConnectionRefused(context: {
	env: NodeJS.ProcessEnv;
	platform: NodeJS.Platform;
	result: TmuxSpawnResult;
}): boolean {
	if (context.platform !== "win32") return false;
	if (!resolveJwcTmuxBinary({ env: context.env, platform: context.platform }).isPsmux) return false;
	return context.result.stderr?.toLowerCase().includes("os error 10061") === true;
}

export function buildDefaultTmuxLaunchPlan(context: TmuxLaunchContext): TmuxLaunchPlan | undefined {
	const env = context.env ?? process.env;
	const policy = parseLaunchPolicy(env);
	if (!context.parsed.tmux || policy === "direct") return undefined;
	if (env.TMUX || env[GJC_TMUX_LAUNCHED_ENV] === "1") return undefined;
	const platform = context.platform ?? process.platform;
	const tty = context.tty ?? { stdin: Boolean(process.stdin.isTTY), stdout: Boolean(process.stdout.isTTY) };
	if (policy === "tmux" && !isInteractiveRootLaunch(context.parsed, tty)) return undefined;

	const cwd = context.cwd ?? process.cwd();
	const branch = context.worktreeBranch ?? context.currentBranch ?? readCurrentBranch(cwd);
	const project = context.project ?? cwd;
	const sessionName = buildJwcTmuxSessionName(env, { branch });
	const tmuxCommand = resolveJwcTmuxCommand(env, platform);
	const tmuxAvailable = context.tmuxAvailable ?? Bun.which(tmuxCommand) !== null;
	if (!tmuxAvailable) {
		writeDiagnostic(context.diagnosticWriter, formatTmuxUnavailableDiagnostic(platform, tmuxCommand));
		return undefined;
	}
	const existingBranchSessionName =
		"existingBranchSessionName" in context
			? (context.existingBranchSessionName ?? undefined)
			: context.worktreeBranch
				? findJwcTmuxSessionByBranch(context.worktreeBranch, env, project)?.name
				: undefined;
	const innerCommand = buildJwcTmuxInnerCommand(
		{
			cwd,
			argv: context.argv ?? process.argv,
			execPath: context.execPath ?? process.execPath,
			env,
			platform,
		},
		context.rawArgs,
		GJC_TMUX_LAUNCHED_ENV,
	);
	return {
		tmuxCommand,
		sessionName,
		cwd,
		innerCommand,
		newSessionArgs: ["new-session", "-d", "-s", sessionName, "-c", cwd, innerCommand],
		branch,
		project,
		attachSessionName: existingBranchSessionName,
	};
}

function defaultSpawnSync(command: string, args: string[], options: TmuxSpawnOptions): TmuxSpawnResult {
	const stdio = options.captureStderr
		? { stdin: options.stdin, stdout: options.stdout, stderr: "pipe" as const }
		: { stdin: options.stdin, stdout: options.stdout, stderr: options.stderr };
	const result = Bun.spawnSync({
		cmd: [command, ...args],
		cwd: options.cwd,
		env: options.env,
		...stdio,
	});
	let stderrText: string | undefined;
	if (options.captureStderr) {
		stderrText = result.stderr ? new TextDecoder().decode(result.stderr) : "";
		if (stderrText.length > 0) writeDiagnostic(undefined, stderrText);
	}
	return { exitCode: result.exitCode, signalCode: result.signalCode, stderr: stderrText };
}

export function launchDefaultTmuxIfNeeded(context: TmuxLaunchContext): boolean {
	renameExistingTmuxWindowIfNeeded(context);
	const plan = buildDefaultTmuxLaunchPlan(context);
	if (!plan) return false;
	const env = context.env ?? process.env;
	const platform = context.platform ?? process.platform;
	const spawnSync = context.spawnSync ?? defaultSpawnSync;
	const options: TmuxSpawnOptions = {
		cwd: plan.cwd,
		env,
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	};
	const isWindowsPsmux = platform === "win32" && resolveJwcTmuxBinary({ env, platform }).isPsmux;
	const attachOptions: TmuxSpawnOptions = { ...options, captureStderr: isWindowsPsmux };
	const controlOptions: TmuxSpawnOptions = { ...options, captureStderr: true };
	const probeOptions: TmuxSpawnOptions = {
		...options,
		stdin: "pipe",
		stdout: "pipe",
		stderr: "pipe",
		captureStderr: true,
	};
	const newSessionOptions: TmuxSpawnOptions = { ...probeOptions };
	const windowTitle = buildJwcTmuxWindowTitle(plan.project ?? plan.cwd, plan.branch);
	const rootTerminalTitle = shouldSetJwcTmuxRootTerminalTitle(context.parsed, env)
		? buildJwcTmuxRootTerminalTitle(plan.project ?? plan.cwd, plan.branch)
		: undefined;
	const buildProfileInputs = (): JwcTmuxProfileContext => ({
		tmuxCommand: plan.tmuxCommand,
		target: plan.sessionName,
		cwd: plan.cwd,
		env,
		spawnSync,
		branch: plan.branch,
		project: plan.project,
	});
	const probeHasSession = (): TmuxSpawnResult =>
		spawnSync(
			plan.tmuxCommand,
			["has-session", "-t", buildJwcTmuxExactSessionTarget(plan.sessionName, { env, platform })],
			probeOptions,
		);
	const attachCreatedSession = (): TmuxSpawnResult =>
		spawnSync(
			plan.tmuxCommand,
			["attach-session", "-t", buildJwcTmuxExactSessionTarget(plan.sessionName, { env, platform })],
			attachOptions,
		);
	const prepareCreatedSession = (createdResult: TmuxSpawnResult): "ready" | "failed" | "partial" => {
		const probeResult = probeWithBackoff(probeHasSession);
		if (probeResult.exitCode !== 0) {
			cleanupCreatedTmuxSession(plan, spawnSync, options);
			writeDiagnostic(
				context.diagnosticWriter,
				formatTmuxLaunchDiagnostic("session registration failed", probeResult.stderr ?? createdResult.stderr),
			);
			return "failed";
		}
		renameTmuxWindow(
			plan.tmuxCommand,
			windowTitle,
			spawnSync,
			controlOptions,
			buildJwcTmuxExactSessionTarget(plan.sessionName, { env, platform }),
		);
		const profile = applyJwcTmuxProfile(buildProfileInputs());
		if (profile.failures.length > 0) {
			const failure =
				profile.failures.find(item => item.command.args.includes("@gjc-profile")) ?? profile.failures[0];
			const probeAfterProfile = probeWithBackoff(probeHasSession);
			if (probeAfterProfile.exitCode !== 0) {
				cleanupCreatedTmuxSession(plan, spawnSync, options);
				writeDiagnostic(
					context.diagnosticWriter,
					formatTmuxLaunchDiagnostic(
						"profile tagging session disappeared",
						probeAfterProfile.stderr ?? failure?.stderr,
					),
				);
				return "failed";
			}
			cleanupCreatedTmuxSession(plan, spawnSync, options);
			writeDiagnostic(
				context.diagnosticWriter,
				formatTmuxLaunchDiagnostic("profile tagging failed", failure?.stderr),
			);
			return "partial";
		}
		applyJwcTmuxRootTerminalTitleProfile({
			tmuxCommand: plan.tmuxCommand,
			target: plan.sessionName,
			title: rootTerminalTitle,
			spawnSync,
			options,
			platform,
		});
		return "ready";
	};

	if (plan.attachSessionName) {
		applyJwcTmuxRootTerminalTitleProfile({
			tmuxCommand: plan.tmuxCommand,
			target: plan.attachSessionName,
			title: rootTerminalTitle,
			spawnSync,
			options,
			platform,
		});
		const attached = spawnSync(
			plan.tmuxCommand,
			["attach-session", "-t", buildJwcTmuxExactSessionTarget(plan.attachSessionName, { env, platform })],
			attachOptions,
		);
		return attached.exitCode === 0;
	}
	const created = spawnSync(plan.tmuxCommand, plan.newSessionArgs, newSessionOptions);
	if (created.exitCode === 0) {
		const prepared = prepareCreatedSession(created);
		if (prepared === "failed") return false;
		if (prepared === "partial") return true;
	}
	if (created.exitCode !== 0) {
		writeDiagnostic(context.diagnosticWriter, formatTmuxLaunchDiagnostic("new-session failed", created.stderr));
		return false;
	}
	const attached = attachCreatedSession();
	if (attached.exitCode === 0) return true;
	if (isTmuxAttachDisconnectError(attached)) {
		writeDiagnostic(context.diagnosticWriter, formatTmuxLaunchDiagnostic("attach disconnected", attached.stderr));
		return true;
	}
	if (isWindowsPsmuxAttachConnectionRefused({ env, platform, result: attached })) {
		sleepSync(WINDOWS_PSMUX_ATTACH_RETRY_DELAY_MS);
		const probeAfterAttach = probeWithBackoff(probeHasSession);
		if (probeAfterAttach.exitCode === 0) {
			const retryAttached = attachCreatedSession();
			if (retryAttached.exitCode === 0) return true;
			if (isTmuxAttachDisconnectError(retryAttached)) {
				writeDiagnostic(
					context.diagnosticWriter,
					formatTmuxLaunchDiagnostic("attach disconnected", retryAttached.stderr),
				);
				return true;
			}
		} else {
			const recreated = spawnSync(plan.tmuxCommand, plan.newSessionArgs, newSessionOptions);
			if (recreated.exitCode === 0 && prepareCreatedSession(recreated) === "ready") {
				const retryAttached = attachCreatedSession();
				if (retryAttached.exitCode === 0) return true;
				if (isTmuxAttachDisconnectError(retryAttached)) {
					writeDiagnostic(
						context.diagnosticWriter,
						formatTmuxLaunchDiagnostic("attach disconnected", retryAttached.stderr),
					);
					return true;
				}
			}
		}
	}
	cleanupCreatedTmuxSession(plan, spawnSync, options);
	writeDiagnostic(context.diagnosticWriter, formatTmuxLaunchDiagnostic("attach failed", attached.stderr));
	return true;
}
