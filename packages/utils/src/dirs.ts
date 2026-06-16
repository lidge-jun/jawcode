/**
 * Centralized path helpers for gajae-code config directories.
 *
 * Uses PI_CONFIG_DIR (default ".jwc") for the config root and
 * PI_CODING_AGENT_DIR to override the agent directory.
 *
 * On Linux, if XDG_DATA_HOME / XDG_STATE_HOME / XDG_CACHE_HOME environment
 * variables are set, paths are redirected to XDG-compliant locations under
 * $XDG_*_HOME/gjc/. This requires running `gjc config migrate` first to
 * move data to the new locations. No filesystem existence checks are performed
 * — if the env var is set, gjc trusts that the migration has been done.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { engines, version } from "../package.json" with { type: "json" };

/** Engine name — fixed identifier for paths, log filenames, release assets (e.g. "gjc") */
export const ENGINE_NAME: string = "gjc";

/** App name shown to users (brandable via JWC_BRAND_NAME/GJC_BRAND_NAME); the jwc fork defaults to "jwc" (062.1 §4) */
export const APP_NAME: string = process.env.JWC_BRAND_NAME || process.env.GJC_BRAND_NAME || "jwc";

/** Config directory name (e.g. ".jwc") */
export const CONFIG_DIR_NAME: string = ".jwc";

/** Version shown by the active CLI. Jawcode package bins override the internal workspace package version. */
export const VERSION: string = process.env.JWC_PACKAGE_VERSION || version;

/** Minimum Bun version */
export const MIN_BUN_VERSION: string = engines.bun.replace(/[^0-9.]/g, "");

export interface BunRuntimeErrorInput {
	currentVersion: string;
	minVersion: string;
	execPath?: string;
	platform?: NodeJS.Platform | string;
}

export function formatBunRuntimeError(input: BunRuntimeErrorInput): string {
	const platform = input.platform ?? process.platform;
	const lines = [`error: Jawcode requires Bun >= ${input.minVersion} (found v${input.currentVersion}).`];
	if (input.execPath) {
		lines.push(`detected Bun runtime: ${input.execPath}`);
	}
	if (platform === "win32") {
		lines.push('Upgrade Bun with: powershell -c "irm bun.sh/install.ps1|iex"');
		lines.push("Ensure Bun is on PATH: %USERPROFILE%\\.bun\\bin");
	} else {
		lines.push("Please upgrade: bun upgrade");
	}
	return `${lines.join("\n")}\n`;
}

// =============================================================================
// Project directory
// =============================================================================

/**
 * On macOS, strip /private prefix only when both paths resolve to the same location.
 * This preserves aliases like /private/tmp -> /tmp without rewriting unrelated paths.
 */
function standardizeMacOSPath(p: string): string {
	if (process.platform !== "darwin" || !p.startsWith("/private/")) return p;
	const stripped = p.slice("/private".length);
	try {
		if (fs.realpathSync(p) === fs.realpathSync(stripped)) {
			return stripped;
		}
	} catch {}
	return p;
}

export function resolveEquivalentPath(inputPath: string): string {
	const resolvedPath = path.resolve(inputPath);
	try {
		return fs.realpathSync(resolvedPath);
	} catch {
		return resolvedPath;
	}
}

export function normalizePathForComparison(inputPath: string): string {
	const resolvedPath = resolveEquivalentPath(inputPath);
	return process.platform === "win32" ? resolvedPath.toLowerCase() : resolvedPath;
}

export function pathIsWithin(root: string, candidate: string): boolean {
	const normalizedRoot = normalizePathForComparison(root);
	const normalizedCandidate = normalizePathForComparison(candidate);
	const relative = path.relative(normalizedRoot, normalizedCandidate);
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function relativePathWithinRoot(root: string, candidate: string): string | null {
	if (!pathIsWithin(root, candidate)) return null;
	const normalizedRoot = normalizePathForComparison(root);
	const normalizedCandidate = normalizePathForComparison(candidate);
	const relative = path.relative(normalizedRoot, normalizedCandidate);
	return relative || null;
}

let projectDir = standardizeMacOSPath(process.cwd());

/** Get the project directory. */
export function getProjectDir(): string {
	return projectDir;
}

/** Set the project directory. */
export function setProjectDir(dir: string): void {
	projectDir = standardizeMacOSPath(path.resolve(dir));
	process.chdir(projectDir);
}

/** Get the config directory name relative to home (e.g. ".jwc" or PI_CONFIG_DIR override). */
export function getConfigDirName(): string {
	return process.env.JWC_CONFIG_DIR ?? process.env.GJC_CONFIG_DIR ?? process.env.PI_CONFIG_DIR ?? CONFIG_DIR_NAME;
}

/** Get the config agent directory name relative to home (e.g. ".jwc/agent" or PI_CONFIG_DIR + "/agent"). */
export function getConfigAgentDirName(): string {
	return `${getConfigDirName()}/agent`;
}

// =============================================================================
// DirResolver — cached, XDG-aware path resolution
// =============================================================================

type XdgCategory = "data" | "state" | "cache";

/**
 * Resolves and caches all gajae-code directory paths. On Linux, when XDG environment
 * variables are set, paths are redirected under $XDG_*_HOME/gjc/. A new
 * instance is created whenever the agent directory changes, which naturally
 * invalidates all cached paths.
 */
class DirResolver {
	readonly configRoot: string;
	readonly agentDir: string;

	// Per-category base dirs. Without XDG, all three equal configRoot / agentDir.
	// With XDG on Linux, they point to $XDG_*_HOME/gjc/.
	readonly #rootDirs: Record<XdgCategory, string>;
	readonly #agentDirs: Record<XdgCategory, string>;

	readonly #rootCache = new Map<string, string>();
	readonly #agentCache = new Map<string, string>();

	constructor(agentDirOverride?: string) {
		this.configRoot = path.join(os.homedir(), getConfigDirName());

		const defaultAgent = path.join(this.configRoot, "agent");
		this.agentDir = agentDirOverride ? path.resolve(agentDirOverride) : defaultAgent;
		const isDefault = this.agentDir === defaultAgent;

		// XDG is a Linux convention. On other platforms, or for non-default
		// profiles, all categories resolve to the legacy paths.
		let xdgData: string | undefined;
		let xdgState: string | undefined;
		let xdgCache: string | undefined;
		if ((process.platform === "linux" || process.platform === "darwin") && isDefault) {
			const resolveIf = (envVar: string) => {
				const value = process.env[envVar];
				if (value) {
					try {
						const joined = path.join(value, ENGINE_NAME);
						if (fs.existsSync(joined)) {
							return joined;
						}
					} catch {}
				}
				return undefined;
			};
			xdgData = resolveIf("XDG_DATA_HOME");
			xdgState = resolveIf("XDG_STATE_HOME");
			xdgCache = resolveIf("XDG_CACHE_HOME");
		}

		this.#rootDirs = {
			data: xdgData ?? this.configRoot,
			state: xdgState ?? this.configRoot,
			cache: xdgCache ?? this.configRoot,
		};
		// XDG flattens the agent/ prefix: ~/.jwc/agent/sessions → $XDG_DATA_HOME/gjc/sessions
		this.#agentDirs = {
			data: xdgData ?? this.agentDir,
			state: xdgState ?? this.agentDir,
			cache: xdgCache ?? this.agentDir,
		};
	}

	/** Config-root subdirectory, with optional XDG override. */
	rootSubdir(subdir: string, xdg?: XdgCategory): string {
		const cached = this.#rootCache.get(subdir);
		if (cached) return cached;
		const base = xdg ? this.#rootDirs[xdg] : this.configRoot;
		const result = path.join(base, subdir);
		this.#rootCache.set(subdir, result);
		return result;
	}

	/** Agent subdirectory, with optional XDG override. */
	agentSubdir(userAgentDir: string | undefined, subdir: string, xdg?: XdgCategory): string {
		if (!userAgentDir || userAgentDir === this.agentDir) {
			const cached = this.#agentCache.get(subdir);
			if (cached) return cached;
			const base = xdg ? this.#agentDirs[xdg] : this.agentDir;
			const result = path.join(base, subdir);
			this.#agentCache.set(subdir, result);
			return result;
		}
		return path.join(userAgentDir, subdir);
	}
}

let dirs = new DirResolver(process.env.JWC_CODING_AGENT_DIR ?? process.env.GJC_CODING_AGENT_DIR);

// Anchor home for the resolver. Captured at module load to stay stable across
// test mocks of `os.homedir()`. `getPluginsDir(home)` compares against this so
// production callers (`home === RESOLVER_HOME`) hit the XDG-aware resolver while
// tests passing a temp HOME short-circuit to a deterministic path.
const RESOLVER_HOME = os.homedir();

// =============================================================================
// Root directories
// =============================================================================

/** Get the config root directory (~/.jwc). */
export function getConfigRootDir(): string {
	return dirs.configRoot;
}

/** Set the coding agent directory. Creates a fresh resolver, invalidating all cached paths. */
export function setAgentDir(dir: string): void {
	dirs = new DirResolver(dir);
	process.env.GJC_CODING_AGENT_DIR = dir;
}

/** Get the agent config directory (~/.jwc/agent). */
export function getAgentDir(): string {
	return dirs.agentDir;
}

/** Get the project-local config directory (.jwc). */
export function getProjectAgentDir(cwd: string = getProjectDir()): string {
	return path.join(cwd, CONFIG_DIR_NAME);
}

// =============================================================================
// Config-root subdirectories (~/.jwc/*)
// =============================================================================

/** Get the reports directory (~/.jwc/reports). */
export function getReportsDir(): string {
	return dirs.rootSubdir("reports", "state");
}

/** Get the logs directory (~/.jwc/logs). */
export function getLogsDir(): string {
	return dirs.rootSubdir("logs", "state");
}

/** Get the path to a dated log file (~/.jwc/logs/gjc.YYYY-MM-DD.log). */
export function getLogPath(date = new Date()): string {
	return path.join(getLogsDir(), `${ENGINE_NAME}.${date.toISOString().slice(0, 10)}.log`);
}

/**
 * Get the plugins directory (~/.jwc/plugins or its XDG equivalent).
 *
 * No-arg form (production callers) goes through the XDG-aware DirResolver so
 * reads and writes always agree. The optional `home` parameter is for test
 * isolation: when it differs from `os.homedir()` it short-circuits the resolver
 * and returns `<home>/<configDir>/plugins` so tests with a temp HOME get a
 * deterministic path. Passing `os.homedir()` explicitly is identical to the
 * no-arg form — XDG semantics are preserved.
 */
export function getPluginsDir(home?: string): string {
	if (home !== undefined && home !== RESOLVER_HOME) {
		return path.join(home, getConfigDirName(), "plugins");
	}
	return dirs.rootSubdir("plugins", "data");
}

/** Where npm installs packages (~/.jwc/plugins/node_modules). */
export function getPluginsNodeModules(): string {
	return path.join(getPluginsDir(), "node_modules");
}

/** Plugin manifest (~/.jwc/plugins/package.json). */
export function getPluginsPackageJson(): string {
	return path.join(getPluginsDir(), "package.json");
}

/** Plugin lock file (~/.jwc/plugins/gjc-plugins.lock.json). */
export function getPluginsLockfile(): string {
	return path.join(getPluginsDir(), "gjc-plugins.lock.json");
}

/** Get the remote mount directory (~/.jwc/remote). */
export function getRemoteDir(): string {
	return dirs.rootSubdir("remote", "data");
}

/** Get the agent-managed worktrees directory (~/.jwc/wt). */
export function getWorktreesDir(): string {
	return dirs.rootSubdir("wt", "data");
}

/** Get the SSH control socket directory (~/.jwc/ssh-control). */
export function getSshControlDir(): string {
	return dirs.rootSubdir("ssh-control", "state");
}

/** Get the remote host info directory (~/.jwc/remote-host). */
export function getRemoteHostDir(): string {
	return dirs.rootSubdir("remote-host", "data");
}

/** Get the managed Python venv directory (~/.jwc/python-env). */
export function getPythonEnvDir(): string {
	return dirs.rootSubdir("python-env", "data");
}

/** Get the shared Python gateway state directory (~/.jwc/agent/python-gateway; XDG default: $XDG_STATE_HOME/gjc/python-gateway). */
export function getPythonGatewayDir(): string {
	return dirs.agentSubdir(undefined, "python-gateway", "state");
}

/** Get the puppeteer sandbox directory (~/.jwc/puppeteer). */
export function getPuppeteerDir(): string {
	return dirs.rootSubdir("puppeteer", "cache");
}

/**
 * Stable 7-character hex digest of an absolute filesystem path.
 *
 * Used to pack the project identity into a single short fs-safe segment
 * (e.g. PR-checkout and task-isolation worktree dirs under `~/.jwc/wt/`).
 * Bun.hash is non-cryptographic — collision space is ~2^28, which is fine
 * for naming a handful of repos on a single machine. Same input on the
 * same Bun runtime yields the same output.
 */
export function hashPath(absPath: string): string {
	return Bun.hash(path.resolve(absPath)).toString(16).padStart(16, "0").slice(-7);
}

/** Get the path to a single worktree directory (~/.jwc/wt/<segment>). */
export function getWorktreeDir(segment: string): string {
	return path.join(getWorktreesDir(), segment);
}

/** Get the GPU cache path (~/.jwc/gpu_cache.json). */
export function getGpuCachePath(): string {
	return dirs.rootSubdir("gpu_cache.json", "cache");
}

/**
 * Get the GitHub view cache database path (~/.jwc/cache/github-cache.db).
 * Honors the `GJC_GITHUB_CACHE_DB` env var when set so tests can isolate the
 * cache file without touching the rest of the config root.
 */
export function getGithubCacheDbPath(): string {
	const override = process.env.JWC_GITHUB_CACHE_DB ?? process.env.GJC_GITHUB_CACHE_DB;
	if (override) return override;
	return dirs.rootSubdir(path.join("cache", "github-cache.db"), "cache");
}

/** Get the natives directory (~/.jwc/natives). */
export function getNativesDir(): string {
	return dirs.rootSubdir("natives", "cache");
}

/** Get the stats database path (~/.jwc/stats.db). */
export function getStatsDbPath(): string {
	return dirs.rootSubdir("stats.db", "data");
}

/** Get the autoresearch state directory (~/.jwc/autoresearch). */
export function getAutoresearchDir(): string {
	return dirs.rootSubdir("autoresearch", "state");
}

/** Get the per-project autoresearch state directory (~/.jwc/autoresearch/<encoded-project>). */
export function getAutoresearchProjectDir(encodedProject: string): string {
	return path.join(getAutoresearchDir(), encodedProject);
}

/** Get the per-project autoresearch SQLite database path (~/.jwc/autoresearch/<encoded-project>.db). */
export function getAutoresearchDbPath(encodedProject: string): string {
	return path.join(getAutoresearchDir(), `${encodedProject}.db`);
}

/** Get the per-run artifact directory (~/.jwc/autoresearch/<encoded-project>/runs/<runId>). */
export function getAutoresearchRunDir(encodedProject: string, runId: number): string {
	return path.join(getAutoresearchProjectDir(encodedProject), "runs", String(runId).padStart(4, "0"));
}

// =============================================================================
// Agent subdirectories (~/.jwc/agent/*)
// =============================================================================

/** Get the path to agent.db (SQLite database for settings and auth storage). */
export function getAgentDbPath(agentDir?: string): string {
	return dirs.agentSubdir(agentDir, "agent.db", "data");
}

/** Get the path to history.db (SQLite database for session history). */
export function getHistoryDbPath(agentDir?: string): string {
	return dirs.agentSubdir(agentDir, "history.db", "data");
}

/** Get the path to models.db (model cache database). */
export function getModelDbPath(agentDir?: string): string {
	return dirs.agentSubdir(agentDir, "models.db", "data");
}

/** Get the sessions directory (~/.jwc/agent/sessions). */
export function getSessionsDir(agentDir?: string): string {
	return dirs.agentSubdir(agentDir, "sessions", "data");
}

/** Get the content-addressed blob store directory (~/.jwc/agent/blobs). */
export function getBlobsDir(agentDir?: string): string {
	return dirs.agentSubdir(agentDir, "blobs", "data");
}

/** Get the custom themes directory (~/.jwc/agent/themes). */
export function getCustomThemesDir(agentDir?: string): string {
	return dirs.agentSubdir(agentDir, "themes");
}

/** Get the tools directory (~/.jwc/agent/tools). */
export function getToolsDir(agentDir?: string): string {
	return dirs.agentSubdir(agentDir, "tools");
}

/** Get the slash commands directory (~/.jwc/agent/commands). */
export function getCommandsDir(agentDir?: string): string {
	return dirs.agentSubdir(agentDir, "commands");
}

/** Get the prompts directory (~/.jwc/agent/prompts). */
export function getPromptsDir(agentDir?: string): string {
	return dirs.agentSubdir(agentDir, "prompts");
}

/** Get the user-level Python modules directory (~/.jwc/agent/modules). */
export function getAgentModulesDir(agentDir?: string): string {
	return dirs.agentSubdir(agentDir, "modules");
}

/** Get the memories directory (~/.jwc/agent/memories). */
export function getMemoriesDir(agentDir?: string): string {
	return dirs.agentSubdir(agentDir, "memories", "state");
}

/** Get the terminal sessions directory (~/.jwc/agent/terminal-sessions). */
export function getTerminalSessionsDir(agentDir?: string): string {
	return dirs.agentSubdir(agentDir, "terminal-sessions", "state");
}

/** Get the crash log path (~/.jwc/agent/gjc-crash.log). */
export function getCrashLogPath(agentDir?: string): string {
	return dirs.agentSubdir(agentDir, "gjc-crash.log", "state");
}

/** Get the debug log path (~/.jwc/agent/gjc-debug.log). */
export function getDebugLogPath(agentDir?: string): string {
	return dirs.agentSubdir(agentDir, `${ENGINE_NAME}-debug.log`, "state");
}

// =============================================================================
// Project subdirectories (.jwc/*)
// =============================================================================

/** Get the project-level Python modules directory (.jwc/modules). */
export function getProjectModulesDir(cwd: string = getProjectDir()): string {
	return path.join(getProjectAgentDir(cwd), "modules");
}

/** Get the project-level prompts directory (.jwc/prompts). */
export function getProjectPromptsDir(cwd: string = getProjectDir()): string {
	return path.join(getProjectAgentDir(cwd), "prompts");
}

/** Get the project-level plugin overrides path (.jwc/plugin-overrides.json). */
export function getProjectPluginOverridesPath(cwd: string = getProjectDir()): string {
	return path.join(getProjectAgentDir(cwd), "plugin-overrides.json");
}

// =============================================================================
// MCP config paths
// =============================================================================

/** Get the primary MCP config file path (first candidate). */
export function getMCPConfigPath(scope: "user" | "project", cwd: string = getProjectDir()): string {
	if (scope === "user") {
		return path.join(getAgentDir(), "mcp.json");
	}
	return path.join(getProjectAgentDir(cwd), "mcp.json");
}

/** Get the SSH config file path. */
export function getSSHConfigPath(scope: "user" | "project", cwd: string = getProjectDir()): string {
	if (scope === "user") {
		return path.join(getAgentDir(), "ssh.json");
	}
	return path.join(getProjectAgentDir(cwd), "ssh.json");
}
