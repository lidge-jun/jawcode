import * as fs from "node:fs";
import { type Component, truncateToWidth, visibleWidth } from "@jawcode-dev/tui";
import { formatCount, getProjectDir } from "@jawcode-dev/utils";
import { $ } from "bun";
import { settings } from "../../config/settings";
import type { StatusLinePreset, StatusLineSegmentId, StatusLineSeparatorStyle } from "../../config/settings-schema";
import { theme } from "../../modes/theme/theme";
import type { AgentSession } from "../../session/agent-session";
import { readSessionStrictSkillActiveState, type SkillActiveEntry } from "../../skill-state/active-state";
import * as git from "../../utils/git";
import { getSessionAccentAnsi, getSessionAccentHex } from "../../utils/session-color";
import { EMPTY_JOBS_SNAPSHOT, type JobsSnapshot } from "../jobs-observer";
import { sanitizeStatusText } from "../shared";
import { classifyQuotaWindow } from "./quota-window";
import { renderSkillHudBar } from "./skill-hud/render";
import {
	canReuseCachedPr,
	createPrCacheContext,
	isSamePrCacheContext,
	type PrCacheContext,
} from "./status-line/git-utils";
import { getPreset } from "./status-line/presets";
import { renderSegment, type SegmentContext } from "./status-line/segments";
import { getSeparator } from "./status-line/separators";
import { calculateTokensPerSecond } from "./status-line/token-rate";
import { type PabcdSegmentState, readGoalLedgerStats, readPabcdSegmentState } from "./status-line/workflow-readers";

export interface StatusLineSegmentOptions {
	model?: { showThinkingLevel?: boolean };
	path?: { abbreviate?: boolean; maxLength?: number; stripWorkPrefix?: boolean };
	git?: { showBranch?: boolean; showStaged?: boolean; showUnstaged?: boolean; showUntracked?: boolean };
	time?: { format?: "12h" | "24h"; showSeconds?: boolean };
	usage?: { mode?: "used" | "remaining" };
}

export interface StatusLineSettings {
	preset?: StatusLinePreset;
	leftSegments?: StatusLineSegmentId[];
	rightSegments?: StatusLineSegmentId[];
	separator?: StatusLineSeparatorStyle;
	segmentOptions?: StatusLineSegmentOptions;
	showHookStatus?: boolean;
	showSkillHud?: boolean;
	sessionAccent?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// StatusLineComponent
// ═══════════════════════════════════════════════════════════════════════════

export class StatusLineComponent implements Component {
	#settings: StatusLineSettings = {};
	#cachedBranch: string | null | undefined = undefined;
	#cachedBranchRepoId: string | null | undefined = undefined;
	#gitWatcher: fs.FSWatcher | null = null;
	#onBranchChange: (() => void) | null = null;
	#autoCompactEnabled: boolean = true;
	#hookStatuses: Map<string, string> = new Map();
	#subagentCount: number = 0;
	#jobs: JobsSnapshot = EMPTY_JOBS_SNAPSHOT;
	#sessionStartTime: number = Date.now();
	#planModeStatus: { enabled: boolean; paused: boolean } | null = null;
	#goalModeStatus: { enabled: boolean; paused: boolean } | null = null;
	#skillHudEntries: SkillActiveEntry[] = [];
	#skillHudLastFetch = 0;
	#skillHudInFlight = false;

	// Git status caching (1s TTL)
	#cachedGitStatus: { staged: number; unstaged: number; untracked: number } | null = null;
	#gitStatusLastFetch = 0;
	#gitStatusInFlight = false;

	// PR lookup caching (invalidated on branch/repo context changes)
	#cachedPr: { number: number; url: string } | null | undefined = undefined;
	#cachedPrContext: PrCacheContext | undefined = undefined;
	#prLookupInFlight = false;
	#defaultBranch?: string;
	#lastTokensPerSecond: number | null = null;
	#lastTokensPerSecondTimestamp: number | null = null;

	// Anthropic usage caching (5-min TTL, OAuth/sub only)
	#cachedUsage: {
		fiveHour?: { percent: number; resetMinutes?: number };
		sevenDay?: { percent: number; resetHours?: number };
	} | null = null;
	#usageFetchedAt = 0;
	#usageInFlight = false;
	constructor(private readonly session: AgentSession) {
		this.#settings = {
			preset: settings.get("statusLine.preset"),
			leftSegments: settings.get("statusLine.leftSegments"),
			rightSegments: settings.get("statusLine.rightSegments"),
			separator: settings.get("statusLine.separator"),
			showHookStatus: settings.get("statusLine.showHookStatus"),
			showSkillHud: settings.get("statusLine.showSkillHud"),
			segmentOptions: settings.getGroup("statusLine").segmentOptions,
			sessionAccent: settings.get("statusLine.sessionAccent"),
		};
	}

	updateSettings(settings: StatusLineSettings): void {
		this.#settings = { ...this.#settings, ...settings };
	}

	setAutoCompactEnabled(enabled: boolean): void {
		this.#autoCompactEnabled = enabled;
	}

	setSubagentCount(count: number): void {
		this.#subagentCount = count;
	}

	setJobs(jobs: JobsSnapshot): void {
		this.#jobs = jobs;
	}

	setSessionStartTime(time: number): void {
		this.#sessionStartTime = time;
	}

	setPlanModeStatus(status: { enabled: boolean; paused: boolean } | undefined): void {
		this.#planModeStatus = status ?? null;
	}

	setGoalModeStatus(status: { enabled: boolean; paused: boolean } | undefined): void {
		this.#goalModeStatus = status ?? null;
	}

	setSkillHudEntriesForTest(entries: SkillActiveEntry[]): void {
		this.#skillHudEntries = entries;
		this.#skillHudLastFetch = Date.now();
	}

	setHookStatus(key: string, text: string | undefined): void {
		if (text === undefined) {
			this.#hookStatuses.delete(key);
		} else {
			this.#hookStatuses.set(key, text);
		}
	}

	watchBranch(onBranchChange: () => void): void {
		this.#onBranchChange = onBranchChange;
		this.#setupGitWatcher();
	}

	#setupGitWatcher(): void {
		if (this.#gitWatcher) {
			this.#gitWatcher.close();
			this.#gitWatcher = null;
		}

		const gitHeadPath = git.repo.resolveSync(getProjectDir())?.headPath ?? null;
		if (!gitHeadPath) return;

		try {
			this.#gitWatcher = fs.watch(gitHeadPath, () => {
				this.#invalidateGitCaches();
				if (this.#onBranchChange) {
					this.#onBranchChange();
				}
			});
		} catch {
			this.#invalidateGitCaches();
		}
	}

	dispose(): void {
		if (this.#gitWatcher) {
			this.#gitWatcher.close();
			this.#gitWatcher = null;
		}
	}

	invalidate(): void {
		this.#invalidateGitCaches();
	}

	#invalidateGitCaches(): void {
		this.#cachedBranch = undefined;
		this.#cachedBranchRepoId = undefined;
		this.#cachedPrContext = undefined;
	}
	#getCurrentBranch(): string | null {
		const head = git.head.resolveSync(getProjectDir());
		const gitHeadPath = head?.headPath ?? null;
		if (this.#cachedBranch !== undefined && this.#cachedBranchRepoId === gitHeadPath) {
			return this.#cachedBranch;
		}

		this.#cachedBranchRepoId = gitHeadPath;
		if (!head) {
			this.#cachedBranch = null;
			return null;
		}

		this.#cachedBranch = head.kind === "ref" ? (head.branchName ?? head.ref) : "detached";

		return this.#cachedBranch ?? null;
	}

	#isDefaultBranch(branch: string): boolean {
		if (this.#defaultBranch === undefined) {
			this.#defaultBranch = "main";
			(async () => {
				const resolved = await git.branch.default(getProjectDir());
				if (resolved) {
					this.#defaultBranch = resolved;
					if (this.#onBranchChange) {
						this.#onBranchChange();
					}
				}
			})();
		}
		return branch === this.#defaultBranch;
	}

	#getGitStatus(): { staged: number; unstaged: number; untracked: number } | null {
		if (this.#gitStatusInFlight || Date.now() - this.#gitStatusLastFetch < 1000) {
			return this.#cachedGitStatus;
		}

		this.#gitStatusInFlight = true;

		(async () => {
			try {
				this.#cachedGitStatus = await git.status.summary(getProjectDir());
			} catch {
				this.#cachedGitStatus = null;
			} finally {
				this.#gitStatusLastFetch = Date.now();
				this.#gitStatusInFlight = false;
			}
		})();

		return this.#cachedGitStatus;
	}

	#lookupPr(): { number: number; url: string } | null {
		const branch = this.#getCurrentBranch();
		const currentContext = branch ? createPrCacheContext(branch, this.#cachedBranchRepoId ?? null) : null;

		if (canReuseCachedPr(this.#cachedPr, this.#cachedPrContext, currentContext)) {
			return this.#cachedPr ?? null;
		}

		const stalePr = this.#cachedPr;

		// Don't look up if no branch, detached HEAD, default branch, or already in flight
		if (!branch || branch === "detached" || this.#isDefaultBranch(branch) || this.#prLookupInFlight) {
			return stalePr ?? null;
		}

		this.#prLookupInFlight = true;
		const lookupContext = currentContext;

		// Fire async lookup, keep stale value visible until resolved
		(async () => {
			// Helper: only write cache if branch/repo context hasn't changed since launch
			const setCachedPr = (value: { number: number; url: string } | null) => {
				const latestBranch = this.#getCurrentBranch();
				const latestContext = latestBranch
					? createPrCacheContext(latestBranch, this.#cachedBranchRepoId ?? null)
					: undefined;
				if (lookupContext && isSamePrCacheContext(latestContext, lookupContext)) {
					this.#cachedPr = value;
					this.#cachedPrContext = lookupContext;
				}
			};
			try {
				// Requires `gh repo set-default` to be configured; fails gracefully if not
				const result = await $`gh pr view --json number,url`.quiet().nothrow();
				if (result.exitCode !== 0) {
					setCachedPr(null);
					return;
				}
				const pr = JSON.parse(result.stdout.toString()) as { number: number; url: string };
				if (typeof pr.number === "number") {
					setCachedPr({ number: pr.number, url: pr.url });
				} else {
					setCachedPr(null);
				}
			} catch {
				setCachedPr(null);
			} finally {
				this.#prLookupInFlight = false;
				if (this.#onBranchChange) {
					this.#onBranchChange();
				}
			}
		})();

		return stalePr ?? null;
	}

	#getTokensPerSecond(): number | null {
		let lastAssistantTimestamp: number | null = null;
		for (let i = this.session.state.messages.length - 1; i >= 0; i--) {
			const message = this.session.state.messages[i];
			if (message?.role === "assistant") {
				lastAssistantTimestamp = message.timestamp;
				break;
			}
		}

		if (lastAssistantTimestamp === null) {
			this.#lastTokensPerSecond = null;
			this.#lastTokensPerSecondTimestamp = null;
			return null;
		}

		const rate = calculateTokensPerSecond(this.session.state.messages, this.session.isStreaming);
		if (rate !== null) {
			this.#lastTokensPerSecond = rate;
			this.#lastTokensPerSecondTimestamp = lastAssistantTimestamp;
			return rate;
		}

		if (this.#lastTokensPerSecondTimestamp === lastAssistantTimestamp) {
			return this.#lastTokensPerSecond;
		}

		return null;
	}

	#pabcdState: PabcdSegmentState | null = null;
	#pabcdInFlight = false;
	#pabcdLastFetch = 0;
	#onPabcdStageChange?: () => void;

	/** 99.04: 1s-TTL background poll for the pabcd envelope (skill-HUD rail twin). */
	#refreshPabcdInBackground(): void {
		const now = Date.now();
		if (this.#pabcdInFlight || now - this.#pabcdLastFetch < 1000) return;
		const getCwd = this.session.sessionManager?.getCwd;
		const getSessionId = this.session.sessionManager?.getSessionId;
		const cwd = typeof getCwd === "function" ? getCwd.call(this.session.sessionManager) : getProjectDir();
		const sessionId = typeof getSessionId === "function" ? getSessionId.call(this.session.sessionManager) : undefined;
		this.#pabcdInFlight = true;
		const prevStage = this.#pabcdState?.stage ?? null;
		void readPabcdSegmentState(cwd, sessionId)
			.then(state => {
				if (state && sessionId && state.stateSessionId !== sessionId) {
					this.#pabcdState = null;
				} else {
					this.#pabcdState = state;
				}
			})
			.catch(() => {
				this.#pabcdState = null;
			})
			.finally(() => {
				this.#pabcdLastFetch = Date.now();
				this.#pabcdInFlight = false;
				const newStage = this.#pabcdState?.stage ?? null;
				if (newStage !== prevStage) this.#onPabcdStageChange?.();
			});
	}

	onPabcdStageChange(cb: () => void): void {
		this.#onPabcdStageChange = cb;
	}

	refreshPabcdNow(): void {
		this.#pabcdLastFetch = 0;
		this.#refreshPabcdInBackground();
	}

	get activePabcdStage(): string | null {
		if (!this.#pabcdState?.active) return null;
		const currentSessionId = this.session.sessionManager?.getSessionId?.();
		if (currentSessionId && this.#pabcdState.stateSessionId !== currentSessionId) {
			return null;
		}
		return this.#pabcdState.stage;
	}

	#refreshSkillHudInBackground(): void {
		if (this.#settings.showSkillHud === false) return;
		const now = Date.now();
		if (this.#skillHudInFlight || now - this.#skillHudLastFetch < 1000) return;
		const getCwd = this.session.sessionManager?.getCwd;
		const getSessionId = this.session.sessionManager?.getSessionId;
		const cwd = typeof getCwd === "function" ? getCwd.call(this.session.sessionManager) : getProjectDir();
		const sessionId = typeof getSessionId === "function" ? getSessionId.call(this.session.sessionManager) : undefined;
		this.#skillHudInFlight = true;
		void readSessionStrictSkillActiveState(cwd, sessionId)
			.then(state => {
				this.#skillHudEntries = state?.active_skills ?? [];
			})
			.catch(() => {
				this.#skillHudEntries = [];
			})
			.finally(() => {
				this.#skillHudLastFetch = Date.now();
				this.#skillHudInFlight = false;
			});
	}

	/**
	 * Background-refresh the Anthropic OAuth quota report. Guarded by a 5-min
	 * TTL on both success (cache lifetime) and error (backoff). Exposed
	 * (non-private) so unit tests can verify the backoff invariant.
	 */
	refreshUsageInBackground(): void {
		const now = Date.now();
		if (this.#usageInFlight) return;
		if (this.#usageFetchedAt > 0 && now - this.#usageFetchedAt < 5 * 60_000) return;
		const fetcher = (this.session as { fetchUsageReports?: () => Promise<unknown> }).fetchUsageReports;
		if (typeof fetcher !== "function") return;
		this.#usageInFlight = true;
		void fetcher
			.call(this.session)
			.then(reports => {
				this.#cachedUsage = this.#normalizeUsageReports(reports);
				this.#usageFetchedAt = Date.now();
			})
			.catch(() => {
				// Backoff on error: stamp the fetch time so the 5-min TTL guard
				// also acts as an error budget. Without this, every render
				// kicks off another fetch (gated only by #usageInFlight),
				// which hammers the endpoint during a network outage / 5xx.
				this.#usageFetchedAt = Date.now();
			})
			.finally(() => {
				this.#usageInFlight = false;
			});
	}

	#normalizeUsageReports(reports: unknown): {
		fiveHour?: { percent: number; resetMinutes?: number };
		sevenDay?: { percent: number; resetHours?: number };
	} | null {
		if (!Array.isArray(reports)) return null;
		let fiveHour: { percent: number; resetMinutes?: number } | undefined;
		let sevenDay: { percent: number; resetHours?: number } | undefined;
		const now = Date.now();
		for (const report of reports) {
			if (!report || typeof report !== "object") continue;
			const limits = (report as { limits?: unknown }).limits;
			if (!Array.isArray(limits)) continue;
			for (const limit of limits) {
				if (!limit || typeof limit !== "object") continue;
				const l = limit as {
					scope?: { windowId?: string; tier?: string; modelId?: string };
					window?: { resetsAt?: number; durationMs?: number };
					amount?: { usedFraction?: number };
				};
				const fraction = l.amount?.usedFraction;
				if (typeof fraction !== "number") continue;
				const resetsAt = l.window?.resetsAt;
				// A per-model row is not the account-wide quota. Anthropic marks those
				// with `tier` (opus/sonnet); openai-codex marks them with `modelId`
				// while ALSO always setting `tier` to the plan slug — so keying on
				// `tier` alone silently rejected every codex limit and its quota never
				// appeared here at all.
				if (l.scope?.modelId) continue;
				const bucket = classifyQuotaWindow(l.scope?.windowId, l.window?.durationMs, l.scope?.tier);
				if (bucket === "5h" && !fiveHour) {
					fiveHour = {
						percent: fraction * 100,
						resetMinutes:
							typeof resetsAt === "number" ? Math.max(0, Math.round((resetsAt - now) / 60_000)) : undefined,
					};
				} else if (bucket === "7d" && !sevenDay) {
					sevenDay = {
						percent: fraction * 100,
						resetHours:
							typeof resetsAt === "number" ? Math.max(0, Math.round((resetsAt - now) / 3_600_000)) : undefined,
					};
				}
			}
		}
		if (!fiveHour && !sevenDay) return null;
		return { fiveHour, sevenDay };
	}

	/**
	 * Read the session-owned context snapshot. Status rendering must never
	 * maintain an independent token heuristic.
	 */
	getCachedContextBreakdown(): {
		usedTokens: number | null;
		contextWindow: number;
		source: "provider_anchor" | "heuristic" | "unknown";
	} {
		const usage = this.session.getContextUsage();
		return {
			usedTokens: usage?.tokens ?? null,
			contextWindow: usage?.contextWindow ?? this.session.model?.contextWindow ?? 0,
			source: usage?.source ?? "unknown",
		};
	}

	#buildSegmentContext(width: number): SegmentContext {
		const state = this.session.state;

		// Trigger background fetch (5-min TTL); render uses cached value
		this.refreshUsageInBackground();

		// Get usage statistics
		const aggregateUsageStats = this.session.sessionManager?.getUsageStatistics() ?? {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			premiumRequests: 0,
			cost: 0,
		};
		const usageStats = {
			...aggregateUsageStats,
			tokensPerSecond: this.#getTokensPerSecond(),
		};

		// Context usage — aligned with /context command so both surfaces report the same value
		const contextUsage = this.session.getContextUsage();
		const contextWindow = contextUsage?.contextWindow ?? state.model?.contextWindow ?? 0;
		const contextPercent = contextUsage?.percent ?? null;

		return {
			session: this.session,
			width,
			options: this.#resolveSettings().segmentOptions ?? {},
			planMode: this.#planModeStatus,
			goalMode: this.#goalModeStatus,
			usageStats,
			contextPercent,
			contextWindow,
			autoCompactEnabled: this.#autoCompactEnabled,
			subagentCount: this.#subagentCount,
			jobs: this.#jobs,
			sessionStartTime: this.#sessionStartTime,
			git: {
				branch: this.#getCurrentBranch(),
				status: this.#getGitStatus(),
				pr: this.#lookupPr(),
			},
			usage: this.#cachedUsage,
			pabcd: this.#pabcdState,
			goal: (() => {
				try {
					const getCwd = this.session.sessionManager?.getCwd;
					const cwd = typeof getCwd === "function" ? getCwd.call(this.session.sessionManager) : getProjectDir();
					return readGoalLedgerStats(cwd);
				} catch {
					return null;
				}
			})(),
		};
	}

	#resolveSettings(): Required<
		Pick<StatusLineSettings, "leftSegments" | "rightSegments" | "separator" | "segmentOptions">
	> &
		StatusLineSettings {
		const preset = this.#settings.preset ?? "default";
		const presetDef = getPreset(preset);
		const useCustomSegments = preset === "custom";
		const mergedSegmentOptions: StatusLineSettings["segmentOptions"] = {};

		for (const [segment, options] of Object.entries(presetDef.segmentOptions ?? {})) {
			mergedSegmentOptions[segment as keyof StatusLineSegmentOptions] = { ...(options as Record<string, unknown>) };
		}

		for (const [segment, options] of Object.entries(this.#settings.segmentOptions ?? {})) {
			const current = mergedSegmentOptions[segment as keyof StatusLineSegmentOptions] ?? {};
			mergedSegmentOptions[segment as keyof StatusLineSegmentOptions] = {
				...(current as Record<string, unknown>),
				...(options as Record<string, unknown>),
			};
		}

		const leftSegments = useCustomSegments
			? (this.#settings.leftSegments ?? presetDef.leftSegments)
			: presetDef.leftSegments;
		const rightSegments = useCustomSegments
			? (this.#settings.rightSegments ?? presetDef.rightSegments)
			: presetDef.rightSegments;

		return {
			...this.#settings,
			leftSegments,
			rightSegments,
			separator: this.#settings.separator ?? presetDef.separator,
			segmentOptions: mergedSegmentOptions,
		};
	}

	#buildStatusLine(width: number): string {
		const ctx = this.#buildSegmentContext(width);
		const effectiveSettings = this.#resolveSettings();
		const separatorDef = getSeparator(effectiveSettings.separator ?? "powerline-thin", theme);

		const bgAnsi = theme.getBgAnsi("statusLineBg");
		const fgAnsi = theme.getFgAnsi("text");
		const sepAnsi = theme.getFgAnsi("statusLineSep");

		// Collect visible segment contents
		const leftParts: string[] = [];
		const leftSegIds: StatusLineSegmentId[] = [];
		for (const segId of effectiveSettings.leftSegments) {
			const rendered = renderSegment(segId, ctx);
			if (rendered.visible && rendered.content) {
				leftParts.push(rendered.content);
				leftSegIds.push(segId);
			}
		}

		const rightParts: string[] = [];
		for (const segId of effectiveSettings.rightSegments) {
			const rendered = renderSegment(segId, ctx);
			if (rendered.visible && rendered.content) {
				rightParts.push(rendered.content);
			}
		}

		const footerOwnsBackgroundJobs = this.#jobs.backgroundRows.some(row => row.kind === "sh" || row.kind === "sub");
		const runningBackgroundJobs = footerOwnsBackgroundJobs
			? 0
			: (this.session.getAsyncJobSnapshot()?.running.filter(job => job.metadata?.monitor !== true).length ?? 0);
		if (runningBackgroundJobs > 0) {
			const icon = theme.icon.agents ? `${theme.icon.agents} ` : "";
			const label = `${formatCount("job", runningBackgroundJobs)} running`;
			rightParts.push(theme.fg("statusLineSubagents", `${icon}${label}`));
		}
		const topFillWidth = Math.max(0, width);
		const left = [...leftParts];
		const right = [...rightParts];

		const leftSepWidth = visibleWidth(separatorDef.left);
		const rightSepWidth = visibleWidth(separatorDef.right);
		const leftCapWidth = separatorDef.endCaps ? visibleWidth(separatorDef.endCaps.right) : 0;
		const rightCapWidth = separatorDef.endCaps ? visibleWidth(separatorDef.endCaps.left) : 0;

		const groupWidth = (parts: string[], capWidth: number, sepWidth: number): number => {
			if (parts.length === 0) return 0;
			const partsWidth = parts.reduce((sum, part) => sum + visibleWidth(part), 0);
			const sepTotal = Math.max(0, parts.length - 1) * (sepWidth + 2);
			return partsWidth + sepTotal + 2 + capWidth;
		};

		let leftWidth = groupWidth(left, leftCapWidth, leftSepWidth);
		let rightWidth = groupWidth(right, rightCapWidth, rightSepWidth);
		const totalWidth = () => leftWidth + rightWidth + (left.length > 0 && right.length > 0 ? 1 : 0);

		if (topFillWidth > 0) {
			while (totalWidth() > topFillWidth && right.length > 0) {
				right.pop();
				rightWidth = groupWidth(right, rightCapWidth, rightSepWidth);
			}
			// Shrink path before dropping left segments — path is the only elastic segment
			const pathIdx = leftSegIds.indexOf("path");
			if (pathIdx >= 0 && totalWidth() > topFillWidth) {
				const overflow = totalWidth() - topFillWidth;
				const currentPathVW = visibleWidth(left[pathIdx]);
				const minPathVW = 8; // icon + ellipsis + a few chars
				const shrinkable = currentPathVW - minPathVW;
				if (shrinkable > 0) {
					const shrinkBy = Math.min(shrinkable, overflow);
					const currentMaxLen = ctx.options.path?.maxLength ?? 40;
					let newMaxLen = Math.max(4, Math.min(currentMaxLen, currentPathVW) - shrinkBy);
					const pathCtx = (maxLen: number): SegmentContext => ({
						...ctx,
						options: { ...ctx.options, path: { ...ctx.options.path, maxLength: maxLen } },
					});
					let reRendered = renderSegment("path", pathCtx(newMaxLen));
					if (reRendered.visible && reRendered.content) {
						// maxLength governs path text, not icon prefix; iterate to compensate
						for (let i = 0; i < 8; i++) {
							const saved = currentPathVW - visibleWidth(reRendered.content);
							if (saved >= shrinkBy) break;
							const nextMaxLen = Math.max(4, newMaxLen - (shrinkBy - saved));
							if (nextMaxLen >= newMaxLen) break; // no progress or hit floor
							newMaxLen = nextMaxLen;
							const adjusted = renderSegment("path", pathCtx(newMaxLen));
							if (!adjusted.visible || !adjusted.content) break;
							reRendered = adjusted;
						}
						left[pathIdx] = reRendered.content;
						leftWidth = groupWidth(left, leftCapWidth, leftSepWidth);
					}
				}
			}
			// 99.00.03 P1-4 — drop unprotected segments first so workflow context
			// (mode/pabcd) survives narrow terminals; protected ones go last.
			const PROTECTED_SEGMENTS: ReadonlySet<string> = new Set(["mode", "pabcd"]);
			while (totalWidth() > topFillWidth && left.length > 0) {
				let dropIdx = -1;
				for (let i = leftSegIds.length - 1; i >= 0; i--) {
					if (!PROTECTED_SEGMENTS.has(leftSegIds[i])) {
						dropIdx = i;
						break;
					}
				}
				if (dropIdx === -1) dropIdx = leftSegIds.length - 1; // only protected left — drop from the end
				left.splice(dropIdx, 1);
				leftSegIds.splice(dropIdx, 1);
				leftWidth = groupWidth(left, leftCapWidth, leftSepWidth);
			}
		}

		const renderGroup = (parts: string[], direction: "left" | "right"): string => {
			if (parts.length === 0) return "";
			const sep = direction === "left" ? separatorDef.left : separatorDef.right;
			const cap = separatorDef.endCaps
				? direction === "left"
					? separatorDef.endCaps.right
					: separatorDef.endCaps.left
				: "";
			const capPrefix = separatorDef.endCaps?.useBgAsFg ? bgAnsi.replace("\x1b[48;", "\x1b[38;") : bgAnsi + sepAnsi;
			const capText = cap ? `${capPrefix}${cap}\x1b[0m` : "";

			let content = bgAnsi + fgAnsi;
			content += ` ${parts.join(` ${sepAnsi}${sep}${fgAnsi} `)} `;
			content += "\x1b[0m";

			if (capText) {
				return direction === "right" ? capText + content : content + capText;
			}
			return content;
		};

		const leftGroup = renderGroup(left, "left");
		const rightGroup = renderGroup(right, "right");
		if (!leftGroup && !rightGroup) return "";

		if (topFillWidth === 0 || left.length === 0 || right.length === 0) {
			return leftGroup + (leftGroup && rightGroup ? " " : "") + rightGroup;
		}

		leftWidth = groupWidth(left, leftCapWidth, leftSepWidth);
		rightWidth = groupWidth(right, rightCapWidth, rightSepWidth);
		const gapWidth = Math.max(1, topFillWidth - leftWidth - rightWidth);
		const sessionName =
			effectiveSettings.sessionAccent !== false ? this.session.sessionManager?.getSessionName() : undefined;
		const accentHex = sessionName ? getSessionAccentHex(sessionName) : undefined;
		const gapColor = getSessionAccentAnsi(accentHex) ?? theme.getFgAnsi("border");
		const gapFill = `${gapColor}${theme.boxRound.horizontal.repeat(gapWidth)}\x1b[39m`;
		return leftGroup + gapFill + rightGroup;
	}

	getTopBorder(width: number): { content: string; width: number } {
		const content = this.#buildStatusLine(width);
		return {
			content,
			width: visibleWidth(content),
		};
	}

	render(width: number): string[] {
		const lines: string[] = [];
		this.#refreshSkillHudInBackground();
		this.#refreshPabcdInBackground();
		const skillHud = this.#settings.showSkillHud === false ? null : renderSkillHudBar(this.#skillHudEntries, width);
		if (skillHud) {
			lines.push(skillHud);
		}

		const statusLine = this.#buildStatusLine(width);
		if (statusLine) {
			lines.push(truncateToWidth(statusLine, width));
		}

		const showHooks = this.#settings.showHookStatus ?? true;
		if (showHooks && this.#hookStatuses.size > 0) {
			const sortedStatuses = Array.from(this.#hookStatuses.entries())
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([, text]) => sanitizeStatusText(text));
			const hookLine = sortedStatuses.join(" ");
			lines.push(truncateToWidth(hookLine, width));
		}

		return lines;
	}
}
