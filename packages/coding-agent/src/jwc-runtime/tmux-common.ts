export const GJC_DEFAULT_TMUX_SESSION = "gajae_code";
export const GJC_TMUX_SESSION_PREFIX = `${GJC_DEFAULT_TMUX_SESSION}_`;
export const GJC_TMUX_COMMAND_ENV = "GJC_TMUX_COMMAND";
export const GJC_TMUX_PROFILE_ENV = "GJC_TMUX_PROFILE";
export const GJC_TMUX_MOUSE_ENV = "GJC_MOUSE";
export const GJC_TMUX_PROFILE_OPTION = "@gjc-profile";
export const GJC_TMUX_PROFILE_VALUE = "1";
export const GJC_TMUX_BRANCH_OPTION = "@gjc-branch";
export const GJC_TMUX_BRANCH_SLUG_OPTION = "@gjc-branch-slug";
export const GJC_TMUX_PROJECT_OPTION = "@gjc-project";

export interface JwcTmuxProfileCommand {
	description: string;
	args: string[];
}

export interface TmuxCommandResult {
	exitCode: number | null;
	stdout?: string;
	stderr?: string;
	signalCode?: string | null;
}

export type TmuxCommandRunner = (args: string[]) => TmuxCommandResult;

export function envDisabled(value: string | undefined): boolean {
	const normalized = value?.trim().toLowerCase();
	return normalized === "0" || normalized === "false" || normalized === "off" || normalized === "no";
}

export function resolveJwcTmuxCommand(env: NodeJS.ProcessEnv = process.env): string {
	return env[GJC_TMUX_COMMAND_ENV]?.trim() || env.GJC_TEAM_TMUX_COMMAND?.trim() || "tmux";
}

export function sanitizeTmuxToken(value: string): string {
	return (
		value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "") || "default"
	);
}

export function buildJwcTmuxSessionSlug(value: string): string {
	return sanitizeTmuxToken(value);
}

function randomTmuxSessionSuffix(): string {
	return Math.random().toString(36).slice(2, 10);
}

export function buildJwcTmuxSessionName(
	env: NodeJS.ProcessEnv = process.env,
	context: { branch?: string | null; now?: number; id?: string } = {},
): string {
	const explicit = (env.JWC_TMUX_SESSION ?? env.GJC_TMUX_SESSION)?.trim();
	if (explicit) return explicit;
	const timestamp = (context.now ?? Date.now()).toString(36);
	const id = context.id ?? randomTmuxSessionSuffix();
	const branchSlug = context.branch ? `${buildJwcTmuxSessionSlug(context.branch)}_` : "";
	return `${GJC_TMUX_SESSION_PREFIX}${branchSlug}${timestamp}_${id}`;
}

export function buildJwcTmuxRequiredProfileCommands(
	target: string,
	metadata: { branch?: string | null; branchSlug?: string | null; project?: string | null } = {},
): JwcTmuxProfileCommand[] {
	const commands: JwcTmuxProfileCommand[] = [
		{
			description: "mark GJC tmux ownership",
			args: ["set-option", "-t", target, GJC_TMUX_PROFILE_OPTION, GJC_TMUX_PROFILE_VALUE],
		},
	];
	if (metadata.branch)
		commands.push({
			description: "record GJC branch identity",
			args: ["set-option", "-t", target, GJC_TMUX_BRANCH_OPTION, metadata.branch],
		});
	if (metadata.branchSlug)
		commands.push({
			description: "record GJC branch slug",
			args: ["set-option", "-t", target, GJC_TMUX_BRANCH_SLUG_OPTION, metadata.branchSlug],
		});
	if (metadata.project)
		commands.push({
			description: "record GJC project identity",
			args: ["set-option", "-t", target, GJC_TMUX_PROJECT_OPTION, metadata.project],
		});
	return commands;
}

export function buildJwcTmuxProfileCommands(
	target: string,
	env: NodeJS.ProcessEnv = process.env,
	metadata: { branch?: string | null; branchSlug?: string | null; project?: string | null } = {},
): JwcTmuxProfileCommand[] {
	const commands = buildJwcTmuxRequiredProfileCommands(target, metadata);
	if (envDisabled(env[GJC_TMUX_PROFILE_ENV])) return commands;
	commands.push(
		{ description: "enable tmux clipboard integration", args: ["set-option", "-t", target, "set-clipboard", "on"] },
		{
			description: "make copy-mode selection readable",
			args: ["set-window-option", "-t", target, "mode-style", "fg=colour231,bg=colour60"],
		},
	);
	if (!envDisabled(env[GJC_TMUX_MOUSE_ENV]))
		commands.unshift({
			description: "enable tmux mouse scrolling",
			args: ["set-option", "-t", target, "mouse", "on"],
		});
	return commands;
}

export function normalizeTmuxCreatedAt(raw: string): string {
	const seconds = Number.parseInt(raw, 10);
	if (!Number.isFinite(seconds) || seconds <= 0) return raw;
	return new Date(seconds * 1000).toISOString();
}
