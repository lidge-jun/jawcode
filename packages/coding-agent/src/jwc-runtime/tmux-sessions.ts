import {
	buildJwcTmuxProfileCommands,
	buildJwcTmuxSessionName,
	GJC_TMUX_BRANCH_OPTION,
	GJC_TMUX_BRANCH_SLUG_OPTION,
	GJC_TMUX_PROFILE_OPTION,
	GJC_TMUX_PROFILE_VALUE,
	GJC_TMUX_PROJECT_OPTION,
	normalizeTmuxCreatedAt,
	resolveJwcTmuxCommand,
} from "./tmux-common";

export interface JwcTmuxSessionStatus {
	name: string;
	attached: boolean;
	windows: number;
	panes: number;
	bindings: string;
	createdAt: string;
	branch?: string;
	branchSlug?: string;
	project?: string;
}

function runTmux(args: string[], env: NodeJS.ProcessEnv = process.env): string {
	const tmuxCommand = resolveJwcTmuxCommand(env);
	const result = Bun.spawnSync([tmuxCommand, ...args], { stdout: "pipe", stderr: "pipe", env });
	if (result.exitCode === 0) return result.stdout.toString();
	throw new Error(result.stderr.toString().trim() || `tmux ${args.join(" ")} failed`);
}

function tryKillSession(sessionName: string, env: NodeJS.ProcessEnv): void {
	try {
		runTmux(["kill-session", "-t", `=${sessionName}`], env);
	} catch {
		// Best-effort cleanup only; preserve the original create/tag failure.
	}
}

function parseBooleanFlag(value: string | undefined): boolean {
	return value === "1";
}

function parseNumber(value: string | undefined): number {
	const parsed = Number.parseInt(value ?? "0", 10);
	return Number.isFinite(parsed) ? parsed : 0;
}

function parseSessionLine(line: string): JwcTmuxSessionStatus | null {
	const [
		name = "",
		windows = "0",
		attached = "0",
		created = "",
		profile = "",
		bindings = "",
		panes = "0",
		branch = "",
		branchSlug = "",
		project = "",
	] = line.split("\t");
	if (!name || profile !== GJC_TMUX_PROFILE_VALUE) return null;
	return {
		name,
		attached: parseBooleanFlag(attached),
		windows: parseNumber(windows),
		panes: parseNumber(panes),
		bindings,
		createdAt: normalizeTmuxCreatedAt(created),
		branch: branch || undefined,
		branchSlug: branchSlug || undefined,
		project: project || undefined,
	};
}

function listSessionLines(env: NodeJS.ProcessEnv = process.env): string[] {
	let output = "";
	try {
		output = runTmux(
			[
				"list-sessions",
				"-F",
				`#{session_name}\t#{session_windows}\t#{session_attached}\t#{session_created}\t#{${GJC_TMUX_PROFILE_OPTION}}\t#{session_key_table}\t#{session_panes}\t#{${GJC_TMUX_BRANCH_OPTION}}\t#{${GJC_TMUX_BRANCH_SLUG_OPTION}}\t#{${GJC_TMUX_PROJECT_OPTION}}`,
			],
			env,
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes("no server running") || message.includes("failed to connect to server")) return [];
		throw error;
	}
	return output
		.split("\n")
		.map(line => line.trim())
		.filter(Boolean);
}

export function listJwcTmuxSessions(env: NodeJS.ProcessEnv = process.env): JwcTmuxSessionStatus[] {
	return listSessionLines(env)
		.map(parseSessionLine)
		.filter((session): session is JwcTmuxSessionStatus => session != null)
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function findJwcTmuxSessionByBranch(
	branch: string,
	env: NodeJS.ProcessEnv = process.env,
	project?: string | null,
): JwcTmuxSessionStatus | undefined {
	return listJwcTmuxSessions(env).find(
		session => session.branch === branch && (!project || session.project === project),
	);
}

export function statusJwcTmuxSession(sessionName: string, env: NodeJS.ProcessEnv = process.env): JwcTmuxSessionStatus {
	const session = listJwcTmuxSessions(env).find(candidate => candidate.name === sessionName);
	if (!session) throw new Error(`jwc_tmux_session_not_found:${sessionName}`);
	return session;
}

export function createJwcTmuxSession(env: NodeJS.ProcessEnv = process.env): JwcTmuxSessionStatus {
	const tmuxCommand = resolveJwcTmuxCommand(env);
	const sessionName = buildJwcTmuxSessionName(env);
	const command = "exec env GJC_TMUX_LAUNCHED=1 gjc";
	const created = Bun.spawnSync([tmuxCommand, "new-session", "-d", "-s", sessionName, command], {
		stdout: "pipe",
		stderr: "pipe",
		env,
	});
	if (created.exitCode !== 0) throw new Error(created.stderr.toString().trim() || "gjc_tmux_session_create_failed");
	try {
		for (const profileCommand of buildJwcTmuxProfileCommands(sessionName, env)) {
			runTmux(profileCommand.args, env);
		}
	} catch (error) {
		tryKillSession(sessionName, env);
		throw error;
	}
	return statusJwcTmuxSession(sessionName, env);
}

function readProfileForExactTarget(sessionName: string, env: NodeJS.ProcessEnv): string {
	return runTmux(["show-options", "-qv", "-t", `=${sessionName}`, GJC_TMUX_PROFILE_OPTION], env).trim();
}

export function removeJwcTmuxSession(sessionName: string, env: NodeJS.ProcessEnv = process.env): JwcTmuxSessionStatus {
	const session = statusJwcTmuxSession(sessionName, env);
	if (readProfileForExactTarget(session.name, env) !== GJC_TMUX_PROFILE_VALUE) {
		throw new Error(`gjc_tmux_session_not_managed:${sessionName}`);
	}
	runTmux(["kill-session", "-t", `=${session.name}`], env);
	return session;
}

export function attachJwcTmuxSession(sessionName: string, env: NodeJS.ProcessEnv = process.env): never {
	const session = statusJwcTmuxSession(sessionName, env);
	const tmuxCommand = resolveJwcTmuxCommand(env);
	const result = Bun.spawnSync([tmuxCommand, "attach-session", "-t", `=${session.name}`], {
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
		env,
	});
	process.exit(result.exitCode ?? 1);
}
