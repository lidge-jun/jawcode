/**
 * Windows psmux detection and tmux-binary resolution.
 *
 * JWC keeps the existing GJC_* tmux compatibility envs, but accepts JWC_*
 * aliases for new psmux detection knobs.
 */

export const JWC_PSMUX_COMMAND_ENV = "JWC_PSMUX_COMMAND";
export const JWC_PSMUX_DETECTION_ENV = "JWC_PSMUX_DETECTION";
export const JWC_PSMUX_FORCE_DETECT_ENV = "JWC_PSMUX_FORCE_DETECT";
export const GJC_PSMUX_COMMAND_ENV = "GJC_PSMUX_COMMAND";
export const GJC_PSMUX_DETECTION_ENV = "GJC_PSMUX_DETECTION";
export const GJC_PSMUX_FORCE_DETECT_ENV = "GJC_PSMUX_FORCE_DETECT";

export const PSMUX_BINARY_NAMES = ["psmux", "pmux", "tmux"] as const;
const PSMUX_VERSION_MARKERS = ["psmux", "pmux"] as const;

export type PsmuxSpawnRunner = (
	command: string,
	args: string[],
) => { exitCode: number | null; stdout?: string; stderr?: string };

export type BinaryResolver = (candidate: string) => string | null;

const DEFAULT_BINARY_RESOLVER: BinaryResolver = candidate => {
	const stripped = candidate.trim().replace(/^["']|["']$/g, "");
	if (!stripped) return null;
	return Bun.which(stripped) ? stripped : null;
};

let activeBinaryResolver: BinaryResolver = DEFAULT_BINARY_RESOLVER;

export function __setBinaryResolverForTests(resolver: BinaryResolver | null): void {
	activeBinaryResolver = resolver ?? DEFAULT_BINARY_RESOLVER;
}

interface CacheEntry {
	command: string;
	isPsmux: boolean;
}

const detectionCache = new Map<string, CacheEntry>();

function firstEnv(env: NodeJS.ProcessEnv, ...keys: string[]): string | undefined {
	for (const key of keys) {
		const value = env[key]?.trim();
		if (value) return value;
	}
	return undefined;
}

export function envDisabled(value: string | undefined): boolean {
	const normalized = value?.trim().toLowerCase();
	return normalized === "0" || normalized === "false" || normalized === "off" || normalized === "no";
}

function envForcesProbe(value: string | undefined): boolean {
	if (value === undefined) return false;
	if (envDisabled(value)) return false;
	return value.trim().length > 0;
}

function readSpawnRunner(): PsmuxSpawnRunner {
	return (command, args) => {
		try {
			const result = Bun.spawnSync({
				cmd: [command, ...args],
				stdout: "pipe",
				stderr: "pipe",
				env: process.env,
			});
			return {
				exitCode: result.exitCode,
				stdout: result.stdout.toString(),
				stderr: result.stderr.toString(),
			};
		} catch {
			return { exitCode: -1, stdout: "", stderr: "" };
		}
	};
}

function probeVersionOutput(command: string, runner: PsmuxSpawnRunner): string {
	for (const flag of ["-V", "--version"]) {
		const result = runner(command, [flag]);
		const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.toLowerCase();
		if (result.exitCode === 0 && text.trim().length > 0) return text;
	}
	return "";
}

function outputMentionsPsmux(output: string): boolean {
	return PSMUX_VERSION_MARKERS.some(marker => output.includes(marker));
}

function resolveBinaryPath(candidate: string): string | null {
	return activeBinaryResolver(candidate);
}

function namesPsmuxBinary(value: string): boolean {
	const normalized = value
		.trim()
		.replace(/^["']|["']$/g, "")
		.replace(/\\/g, "/")
		.toLowerCase();
	const baseName = normalized.split("/").pop() ?? normalized;
	return baseName === "psmux" || baseName === "psmux.exe" || baseName === "pmux" || baseName === "pmux.exe";
}

function detectPsmuxForCommand(command: string, runner: PsmuxSpawnRunner): boolean {
	const resolved = resolveBinaryPath(command);
	if (!resolved) return false;
	return outputMentionsPsmux(probeVersionOutput(resolved, runner));
}

export function detectPsmux(
	command: string,
	options: { force?: boolean; env?: NodeJS.ProcessEnv; runner?: PsmuxSpawnRunner } = {},
): boolean {
	const env = options.env ?? process.env;
	if (namesPsmuxBinary(command)) return true;
	const explicit = firstEnv(env, JWC_PSMUX_COMMAND_ENV, GJC_PSMUX_COMMAND_ENV);
	if (explicit) {
		if (namesPsmuxBinary(explicit)) return true;
		const explicitPath = resolveBinaryPath(explicit);
		if (explicitPath && explicitPath === resolveBinaryPath(command)) return true;
	}
	if (envDisabled(firstEnv(env, JWC_PSMUX_DETECTION_ENV, GJC_PSMUX_DETECTION_ENV))) return false;
	const force =
		options.force === true || envForcesProbe(firstEnv(env, JWC_PSMUX_FORCE_DETECT_ENV, GJC_PSMUX_FORCE_DETECT_ENV));
	const useCache = !force;
	if (useCache) {
		const cached = detectionCache.get(command);
		if (cached) return cached.isPsmux;
	}
	const runner = options.runner ?? readSpawnRunner();
	const isPsmux = detectPsmuxForCommand(command, runner);
	if (useCache) detectionCache.set(command, { command, isPsmux });
	return isPsmux;
}

export interface ResolveJwcTmuxBinaryOptions {
	platform?: NodeJS.Platform;
	env?: NodeJS.ProcessEnv;
	runner?: PsmuxSpawnRunner;
}

export interface ResolvedTmuxBinary {
	command: string;
	isPsmux: boolean;
	viaExplicitOverride: boolean;
}

export function resolveJwcTmuxBinary(options: ResolveJwcTmuxBinaryOptions = {}): ResolvedTmuxBinary {
	const env = options.env ?? process.env;
	const platform = options.platform ?? process.platform;
	const runner = options.runner ?? readSpawnRunner();
	const explicit = env.JWC_TMUX_COMMAND?.trim() || env.GJC_TMUX_COMMAND?.trim() || env.GJC_TEAM_TMUX_COMMAND?.trim();
	if (explicit) {
		const isPsmux = detectPsmux(explicit, { env, runner });
		return { command: explicit, isPsmux, viaExplicitOverride: true };
	}
	if (platform === "win32") {
		for (const candidate of PSMUX_BINARY_NAMES) {
			if (resolveBinaryPath(candidate)) {
				const isPsmux = detectPsmux(candidate, { env, runner });
				return { command: candidate, isPsmux, viaExplicitOverride: false };
			}
		}
	}
	if (resolveBinaryPath("tmux")) {
		const isPsmux = detectPsmux("tmux", { env, runner });
		return { command: "tmux", isPsmux, viaExplicitOverride: false };
	}
	return { command: "tmux", isPsmux: false, viaExplicitOverride: false };
}

export function clearPsmuxDetectionCache(): void {
	detectionCache.clear();
}

export interface PsmuxProbe {
	command: string;
	versionOutput: string;
	isPsmux: boolean;
}

export function probePsmux(
	command: string,
	options: { env?: NodeJS.ProcessEnv; runner?: PsmuxSpawnRunner; force?: boolean } = {},
): PsmuxProbe {
	const env = options.env ?? process.env;
	const runner = options.runner ?? readSpawnRunner();
	const resolved = resolveBinaryPath(command);
	if (!resolved) return { command, versionOutput: "", isPsmux: false };
	if (options.force) clearPsmuxDetectionCache();
	const output = probeVersionOutput(resolved, runner);
	const explicit = firstEnv(env, JWC_PSMUX_COMMAND_ENV, GJC_PSMUX_COMMAND_ENV);
	const isPsmux = outputMentionsPsmux(output) || explicit === resolved || namesPsmuxBinary(explicit ?? "");
	return { command: resolved, versionOutput: output, isPsmux };
}
