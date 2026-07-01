import { Buffer } from "node:buffer";
import * as path from "node:path";

export interface JwcTmuxInnerCommandContext {
	cwd: string;
	argv: string[];
	execPath: string;
	env?: NodeJS.ProcessEnv;
	extraEnv?: Record<string, string>;
	platform?: NodeJS.Platform;
}

function shellQuote(value: string): string {
	if (value.length === 0) return "''";
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

function powershellQuote(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

function buildEnvAssignments(values: Record<string, string> | undefined): string {
	const entries = Object.entries(values ?? {});
	return entries.length === 0 ? "" : ` ${entries.map(([key, value]) => `${key}=${shellQuote(value)}`).join(" ")}`;
}

function stripRootTmuxFlag(rawArgs: string[]): string[] {
	return rawArgs.filter(arg => arg !== "--tmux");
}

function isWindowsPlatform(platform: NodeJS.Platform | undefined): boolean {
	return platform === "win32";
}

function pathModuleForPlatform(platform: NodeJS.Platform | undefined): typeof path.win32 | typeof path {
	return isWindowsPlatform(platform) ? path.win32 : path;
}

function isBunVirtualPath(value: string | undefined): boolean {
	return value?.startsWith("/$bunfs/") === true;
}

function resolvePowerShellCommand(env: NodeJS.ProcessEnv): string {
	const explicit = env.JWC_POWERSHELL_COMMAND?.trim() || env.GJC_POWERSHELL_COMMAND?.trim();
	if (explicit) return explicit;
	if (Bun.which("pwsh")) return "pwsh";
	if (Bun.which("powershell")) return "powershell";
	return "powershell.exe";
}

function resolveCurrentJwcCommand(context: JwcTmuxInnerCommandContext): string[] {
	const entrypoint = context.argv[1];
	if (!entrypoint) return ["jwc"];
	if (isBunVirtualPath(entrypoint)) {
		return isBunVirtualPath(context.execPath) ? ["jwc"] : [context.execPath];
	}
	const pathModule = pathModuleForPlatform(context.platform);
	const resolvedEntrypoint = pathModule.isAbsolute(entrypoint)
		? entrypoint
		: pathModule.resolve(context.cwd, entrypoint);
	if (entrypoint.endsWith(".ts") || entrypoint.endsWith(".js") || entrypoint.endsWith(".mjs")) {
		return [context.execPath, resolvedEntrypoint];
	}
	return [resolvedEntrypoint];
}

function buildWindowsPowerShellInnerCommand(
	context: JwcTmuxInnerCommandContext,
	rawArgs: string[],
	launchedEnvName: string,
): string {
	const command = resolveCurrentJwcCommand(context);
	const envLines = Object.entries({ [launchedEnvName]: "1", ...(context.extraEnv ?? {}) }).map(
		([key, value]) => `$env:${key} = ${powershellQuote(value)}`,
	);
	const resolvedCommand = command.map(powershellQuote).join(" ");
	const innerArgs = stripRootTmuxFlag(rawArgs).map(powershellQuote).join(" ");
	const invocation = `& ${resolvedCommand}${innerArgs ? ` ${innerArgs}` : ""}`;
	const exitLine = "if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE } else { exit 1 }";
	const encodedCommand = Buffer.from([...envLines, invocation, exitLine].join("\n"), "utf16le").toString("base64");
	return `${resolvePowerShellCommand(context.env ?? process.env)} -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${encodedCommand}`;
}

export function buildJwcTmuxInnerCommand(
	context: JwcTmuxInnerCommandContext,
	rawArgs: string[],
	launchedEnvName: string,
): string {
	if (isWindowsPlatform(context.platform))
		return buildWindowsPowerShellInnerCommand(context, rawArgs, launchedEnvName);
	const command = resolveCurrentJwcCommand(context);
	const quoted = [...command, ...stripRootTmuxFlag(rawArgs)].map(shellQuote).join(" ");
	return `exec env ${launchedEnvName}=1${buildEnvAssignments(context.extraEnv)} ${quoted}`;
}
