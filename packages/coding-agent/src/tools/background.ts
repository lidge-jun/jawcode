import * as path from "node:path";
import type { AgentTool, AgentToolResult } from "@gajae-code/agent-core";
import type { Component } from "@gajae-code/tui";
import { Text } from "@gajae-code/tui";
import { prompt } from "@gajae-code/utils";
import * as z from "zod/v4";
import { type AsyncJobFilter, AsyncJobManager, isBackgroundJobSupportEnabled } from "../async";
import { KEYBINDINGS } from "../config/keybindings";
import type { RenderResultOptions } from "../extensibility/custom-tools/types";
import { isBackgroundAttention, sortBackgroundRows } from "../modes/background-row-model";
import { buildBackgroundDetailItems } from "../modes/components/background-footer-panel-model";
import type { BackgroundRowView, JobsSnapshot } from "../modes/jobs-observer";
import { JobsObserver } from "../modes/jobs-observer";
import type { Theme } from "../modes/theme/theme";
import backgroundDescription from "../prompts/tools/background.md" with { type: "text" };
import type { ToolSession } from "./index";
import { PREVIEW_LIMITS, replaceTabs } from "./render-utils";

const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 20;
const DEFAULT_FOLLOW_LIMIT_BYTES = 8_192;
const MAX_FOLLOW_LIMIT_BYTES = 32_768;
const TEXT_PREVIEW_WIDTH = 120;

const backgroundSchema = z.object({
	op: z.enum(["list", "detail", "follow", "cancel", "settings"]).describe("background management operation"),
	id: z.string().min(1).optional().describe("background row id (required for detail/follow/cancel)"),
	limit: z.number().int().positive().max(MAX_LIST_LIMIT).optional().describe("max rows returned by list"),
	offset: z.number().int().nonnegative().optional().describe("byte offset for follow continuation"),
	limitBytes: z
		.number()
		.int()
		.positive()
		.max(MAX_FOLLOW_LIMIT_BYTES)
		.optional()
		.describe("max bytes returned by follow"),
});

type BackgroundParams = z.infer<typeof backgroundSchema>;

export interface BackgroundFollowDetails {
	id: string;
	status: "ok" | "unsupported" | "not_found";
	message?: string;
	text?: string;
	startOffset?: number;
	nextOffset?: number;
	truncated?: boolean;
}

export interface BackgroundCancelDetails {
	id: string;
	status: "cancelled" | "not_found" | "unsupported" | "already_terminal";
	message: string;
}

export interface BackgroundSettingDetails {
	key: string;
	value: unknown;
	source: "settings" | "keybinding-default";
	description: string;
}

export interface BackgroundToolDetails {
	op: BackgroundParams["op"];
	rows?: BackgroundRowView[];
	row?: BackgroundRowView;
	attention?: boolean;
	detailItems?: Array<{ label: string; description?: string }>;
	outputRef?: string;
	follow?: BackgroundFollowDetails;
	cancel?: BackgroundCancelDetails;
	settings?: BackgroundSettingDetails[];
}

interface BackgroundResolvedIds {
	rowId: string;
	subagentId?: string;
	jobIds: string[];
	hasSubagentRecord: boolean;
}

function clampLimit(value: number | undefined, fallback: number, max: number): number {
	if (value === undefined) return fallback;
	return Math.max(1, Math.min(Math.floor(value), max));
}

function sanitizeOneLine(value: string | undefined, max = TEXT_PREVIEW_WIDTH): string | undefined {
	const cleaned = replaceTabs(value ?? "")
		.replace(/[\r\n]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (!cleaned) return undefined;
	return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

function limitBytes(text: string, maxBytes: number): { text: string; truncated: boolean } {
	const bytes = Buffer.byteLength(text, "utf8");
	if (bytes <= maxBytes) return { text, truncated: false };
	let taken = "";
	let size = 0;
	for (const char of text) {
		const next = Buffer.byteLength(char, "utf8");
		if (size + next > maxBytes) break;
		taken += char;
		size += next;
	}
	return { text: taken, truncated: true };
}

function ownerMatches(jobOwnerId: string | undefined, ownerFilter: AsyncJobFilter | undefined): boolean {
	return !ownerFilter?.ownerId || jobOwnerId === ownerFilter.ownerId;
}

function pushUnique(values: string[], value: string | null | undefined): void {
	if (!value || values.includes(value)) return;
	values.push(value);
}

function summarizeRow(row: BackgroundRowView): string {
	const attention = isBackgroundAttention(row) ? " !" : "";
	const label = sanitizeOneLine(row.label, 80) ?? "(no label)";
	return `- ${row.id} [${row.kind}/${row.status}${attention}] ${label}`;
}

function buildSnapshot(manager: AsyncJobManager, ownerId: string | undefined): JobsSnapshot {
	const observer = new JobsObserver(manager, ownerId);
	try {
		return observer.getSnapshot();
	} finally {
		observer.dispose();
	}
}

function findRow(snapshot: JobsSnapshot, id: string): BackgroundRowView | undefined {
	return snapshot.backgroundRows.find(row => row.id === id);
}

function resolveBackgroundIds(
	manager: AsyncJobManager,
	row: BackgroundRowView,
	ownerFilter: AsyncJobFilter | undefined,
): BackgroundResolvedIds {
	const jobIds: string[] = [];
	let subagentId: string | undefined;
	let hasSubagentRecord = false;

	const addOwnedJob = (jobId: string | null | undefined): void => {
		if (!jobId) return;
		const job = manager.getJob(jobId);
		if (!job || !ownerMatches(job.ownerId, ownerFilter)) return;
		pushUnique(jobIds, job.id);
		if (job.metadata?.subagent?.id) subagentId = job.metadata.subagent.id;
	};

	addOwnedJob(row.id);

	if (row.kind === "sub") {
		const directRecord = manager.getSubagentRecord(row.id, ownerFilter);
		if (directRecord) {
			subagentId = directRecord.subagentId;
			hasSubagentRecord = true;
			addOwnedJob(directRecord.currentJobId);
			for (const jobId of directRecord.historicalJobIds) addOwnedJob(jobId);
		} else {
			for (const record of manager.getSubagentRecords(ownerFilter)) {
				const ids = [record.currentJobId, ...record.historicalJobIds].filter((id): id is string => Boolean(id));
				if (!ids.includes(row.id)) continue;
				subagentId = record.subagentId;
				hasSubagentRecord = true;
				for (const jobId of ids) addOwnedJob(jobId);
				break;
			}
		}
	}

	return { rowId: row.id, subagentId, jobIds, hasSubagentRecord };
}

async function resolveVerifiedOutputRef(
	session: ToolSession,
	resolved: BackgroundResolvedIds,
): Promise<string | undefined> {
	const subagentId = resolved.subagentId;
	if (!subagentId || subagentId.includes("/") || subagentId.includes("..")) return undefined;
	const dir = session.getArtifactsDir?.();
	if (!dir) return undefined;
	const outputPath = path.join(dir, `${subagentId}.md`);
	const metaPath = `${outputPath}.meta.json`;
	const outputExists = await Bun.file(outputPath).exists();
	const metaExists = await Bun.file(metaPath).exists();
	if (!outputExists || !metaExists) return undefined;
	return `agent://${subagentId}`;
}

function followRow(
	manager: AsyncJobManager,
	row: BackgroundRowView,
	resolved: BackgroundResolvedIds,
	offset: number | undefined,
	limit: number,
	ownerFilter: AsyncJobFilter | undefined,
): BackgroundFollowDetails {
	for (const jobId of resolved.jobIds) {
		const slice = manager.readOutputSince(jobId, offset ?? 0, ownerFilter);
		if (!slice) continue;
		const limited = limitBytes(slice.text, limit);
		return {
			id: row.id,
			status: "ok",
			text: limited.text,
			startOffset: slice.startOffset,
			nextOffset: slice.nextOffset,
			truncated: slice.truncated || limited.truncated,
		};
	}
	return {
		id: row.id,
		status: "unsupported",
		message: `No retained output is available for background row ${row.id}.`,
	};
}

function cancelRow(
	manager: AsyncJobManager,
	row: BackgroundRowView,
	resolved: BackgroundResolvedIds,
	ownerFilter: AsyncJobFilter | undefined,
): BackgroundCancelDetails {
	if (row.status === "failed" || row.status === "cancelled" || row.terminalLatched) {
		return { id: row.id, status: "already_terminal", message: `Background row ${row.id} is already ${row.status}.` };
	}
	if ((row.kind === "sh" || row.kind === "mon") && row.status === "paused") {
		return {
			id: row.id,
			status: "unsupported",
			message: `Paused ${row.kind} rows are not cancellable through background.`,
		};
	}
	if (row.kind === "cron") {
		return { id: row.id, status: "unsupported", message: "Cron deletion remains available through CronDelete." };
	}
	if (row.kind === "q" && !resolved.hasSubagentRecord) {
		return {
			id: row.id,
			status: "unsupported",
			message: "Queued generic rows are not cancellable through background.",
		};
	}
	if (row.kind === "sub" && resolved.subagentId && resolved.hasSubagentRecord) {
		const cancelled = manager.cancelSubagent(resolved.subagentId, ownerFilter);
		return cancelled
			? { id: row.id, status: "cancelled", message: `Cancelled subagent ${resolved.subagentId}.` }
			: {
					id: row.id,
					status: "already_terminal",
					message: `Subagent ${resolved.subagentId} is not running or queued.`,
				};
	}
	const jobId = resolved.jobIds[0];
	if (!jobId) return { id: row.id, status: "not_found", message: `Background row not found: ${row.id}` };
	const job = manager.getJob(jobId);
	if (!job || !ownerMatches(job.ownerId, ownerFilter)) {
		return { id: row.id, status: "not_found", message: `Background row not found: ${row.id}` };
	}
	if (job.status !== "running") {
		return { id: row.id, status: "already_terminal", message: `Background row ${row.id} is already ${job.status}.` };
	}
	const cancelled = manager.cancel(jobId, ownerFilter);
	return cancelled
		? { id: row.id, status: "cancelled", message: `Cancelled background row ${row.id}.` }
		: { id: row.id, status: "already_terminal", message: `Background row ${row.id} is no longer running.` };
}

function readBackgroundSettings(session: ToolSession): BackgroundSettingDetails[] {
	return [
		{
			key: "async.enabled",
			value: session.settings.get("async.enabled"),
			source: "settings",
			description: "Enables async/background job support.",
		},
		{
			key: "async.maxJobs",
			value: session.settings.get("async.maxJobs"),
			source: "settings",
			description: "Maximum retained async jobs.",
		},
		{
			key: "async.pollWaitDuration",
			value: session.settings.get("async.pollWaitDuration"),
			source: "settings",
			description: "Default wait window for background polling.",
		},
		{
			key: "bash.autoBackground.enabled",
			value: session.settings.get("bash.autoBackground.enabled"),
			source: "settings",
			description: "Whether bash may automatically background long-running commands.",
		},
		{
			key: "bash.autoBackground.thresholdMs",
			value: session.settings.get("bash.autoBackground.thresholdMs"),
			source: "settings",
			description: "Bash duration threshold before auto-backgrounding.",
		},
		{
			key: "task.maxConcurrency",
			value: session.settings.get("task.maxConcurrency"),
			source: "settings",
			description: "Maximum concurrent task/subagent executions.",
		},
		{
			key: "app.background.expand",
			value: KEYBINDINGS["app.background.expand"].defaultKeys,
			source: "keybinding-default",
			description: "Default TUI keybinding for expanding the background footer panel.",
		},
	];
}

export class BackgroundTool implements AgentTool<typeof backgroundSchema, BackgroundToolDetails> {
	readonly name = "background";
	readonly label = "Background";
	readonly summary = "Manage background work rows";
	readonly description: string;
	readonly parameters = backgroundSchema;
	readonly strict = true;
	readonly loadMode = "essential";

	constructor(private readonly session: ToolSession) {
		this.description = prompt.render(backgroundDescription);
	}

	static createIf(session: ToolSession): BackgroundTool | null {
		if (!isBackgroundJobSupportEnabled(session.settings)) return null;
		return new BackgroundTool(session);
	}

	async execute(_toolCallId: string, params: BackgroundParams): Promise<AgentToolResult<BackgroundToolDetails>> {
		const manager = AsyncJobManager.instance();
		if (!manager) {
			return {
				content: [{ type: "text", text: "Async execution is disabled; no background rows are available." }],
				details: { op: params.op, rows: [] },
			};
		}

		const ownerId = this.session.getAgentId?.() ?? undefined;
		const ownerFilter = ownerId ? { ownerId } : undefined;
		const snapshot = buildSnapshot(manager, ownerId);

		if (params.op === "list") {
			const limit = clampLimit(params.limit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
			const rows = sortBackgroundRows(snapshot.backgroundRows).slice(0, limit);
			const lines = [
				`${snapshot.backgroundRows.length} background ${snapshot.backgroundRows.length === 1 ? "row" : "rows"}`,
			];
			for (const row of rows) lines.push(summarizeRow(row));
			if (snapshot.backgroundRows.length > rows.length)
				lines.push(`… ${snapshot.backgroundRows.length - rows.length} more`);
			return { content: [{ type: "text", text: lines.join("\n") }], details: { op: "list", rows } };
		}

		if (params.op === "settings") {
			const settings = readBackgroundSettings(this.session);
			const lines = settings.map(entry => `- ${entry.key} (${entry.source}): ${String(entry.value)}`);
			return { content: [{ type: "text", text: lines.join("\n") }], details: { op: "settings", settings } };
		}

		if (!params.id) {
			return {
				content: [{ type: "text", text: `Missing id for background ${params.op}.` }],
				details: { op: params.op },
			};
		}

		const row = findRow(snapshot, params.id);
		if (!row) {
			const message = `Background row not found: ${params.id}`;
			if (params.op === "follow") {
				return {
					content: [{ type: "text", text: message }],
					details: { op: "follow", follow: { id: params.id, status: "not_found", message } },
				};
			}
			if (params.op === "cancel") {
				return {
					content: [{ type: "text", text: message }],
					details: { op: "cancel", cancel: { id: params.id, status: "not_found", message } },
				};
			}
			return { content: [{ type: "text", text: message }], details: { op: params.op } };
		}

		const resolved = resolveBackgroundIds(manager, row, ownerFilter);

		if (params.op === "detail") {
			const detailItems = buildBackgroundDetailItems(snapshot, row.id)
				.filter(item => item.value !== "back")
				.map(item => ({ label: item.label, ...(item.description ? { description: item.description } : {}) }));
			const attention = isBackgroundAttention(row);
			const outputRef = await resolveVerifiedOutputRef(this.session, resolved);
			const lines = [summarizeRow(row), `Attention: ${attention ? "required" : "none"}`];
			for (const item of detailItems) lines.push(`${item.label}: ${item.description ?? ""}`.trimEnd());
			if (outputRef) lines.push(`Output: ${outputRef}`);
			return {
				content: [{ type: "text", text: lines.join("\n") }],
				details: { op: "detail", row, attention, detailItems, ...(outputRef ? { outputRef } : {}) },
			};
		}

		if (params.op === "follow") {
			const follow = followRow(
				manager,
				row,
				resolved,
				params.offset,
				clampLimit(params.limitBytes, DEFAULT_FOLLOW_LIMIT_BYTES, MAX_FOLLOW_LIMIT_BYTES),
				ownerFilter,
			);
			const text = follow.status === "ok" ? (follow.text ?? "") : (follow.message ?? `Cannot follow ${row.id}.`);
			return { content: [{ type: "text", text }], details: { op: "follow", row, follow } };
		}

		const cancel = cancelRow(manager, row, resolved, ownerFilter);
		return { content: [{ type: "text", text: cancel.message }], details: { op: "cancel", row, cancel } };
	}
}

interface BackgroundRenderArgs {
	op?: string;
	id?: string;
}

function renderTitle(args: BackgroundRenderArgs | undefined): string {
	if (!args?.op) return "Background";
	return args.id ? `Background ${args.op} ${args.id}` : `Background ${args.op}`;
}

export const backgroundToolRenderer = {
	inline: true,
	renderCall(args: BackgroundRenderArgs, _options: RenderResultOptions, uiTheme: Theme): Component {
		return new Text(uiTheme.fg("muted", renderTitle(args)), 0, 0);
	},
	renderResult(
		result: { content: Array<{ type: string; text?: string }>; details?: BackgroundToolDetails; isError?: boolean },
		_options: RenderResultOptions,
		uiTheme: Theme,
		args?: BackgroundRenderArgs,
	): Component {
		const text = result.content?.find(item => item.type === "text")?.text ?? renderTitle(args);
		const lines = text
			.split(/\r?\n/)
			.slice(0, PREVIEW_LIMITS.EXPANDED_LINES)
			.map(line =>
				uiTheme.fg(result.isError ? "error" : "toolOutput", sanitizeOneLine(line, TEXT_PREVIEW_WIDTH) ?? ""),
			);
		return new Text(lines.join("\n"), 0, 0);
	},
	mergeCallAndResult: true,
};
