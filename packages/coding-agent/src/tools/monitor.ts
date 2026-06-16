import type { AgentToolContext, AgentToolResult } from "@jawcode-dev/agent-core";
import { logger } from "@jawcode-dev/utils";
import * as z from "zod/v4";
import { AsyncJobManager } from "../async";
import { truncateTail } from "../session/streaming-output";
import { BashTool } from "./bash";
import type { ToolSession } from "./index";
import { ToolError } from "./tool-errors";

export const monitorKindEnum = z.enum(["log", "poll", "watch", "other"]);

export const monitorParamsSchema = z.object({
	command: z.string().describe("Shell command to run as a background monitor."),
	kind: monitorKindEnum.describe(
		"Category: 'log' tails a log, 'poll' polls a status, 'watch' watches a directory, 'other' for anything else.",
	),
	description: z.string().describe("Short human-readable description. Appears in task listings."),
	timeout: z.number().min(1).optional().describe("Max wall-clock seconds before shutdown. Omit for session lifetime."),
	persistent: z.boolean().optional().describe("Keep running past current turn. Default: false."),
	silent: z
		.boolean()
		.optional()
		.describe("Queue silently without triggering agent turn. Default: false; auto-enabled for kind='poll'."),
	deduplicate: z
		.boolean()
		.optional()
		.describe("Skip if stdout identical to previous. Default: false; auto-enabled for kind='poll'."),
});

export type MonitorParams = z.infer<typeof monitorParamsSchema>;

export interface MonitorToolDetails {
	taskId: string;
	kind: z.infer<typeof monitorKindEnum>;
	description: string;
	command: string;
	persistent: boolean;
}

const MONITOR_LABEL_MAX = 120;
const MAX_PENDING_MONITOR_NOTIFICATIONS = 3;
const MONITOR_NOTIFICATION_LINE_MAX_BYTES = 16 * 1024;
const MONITOR_NOTIFICATION_LINE_MAX_LINES = 20;

function buildMonitorLabel(params: MonitorParams): string {
	const base = `[monitor:${params.kind}] ${params.description}`;
	if (base.length <= MONITOR_LABEL_MAX) return base;
	return `${base.slice(0, MONITOR_LABEL_MAX - 3)}...`;
}

function formatMonitorNotificationLine(line: string): {
	content: string;
	truncated: boolean;
	totalBytes: number;
	outputBytes: number;
} {
	const truncation = truncateTail(line, {
		maxBytes: MONITOR_NOTIFICATION_LINE_MAX_BYTES,
		maxLines: MONITOR_NOTIFICATION_LINE_MAX_LINES,
	});
	const outputBytes = truncation.outputBytes ?? truncation.totalBytes;
	if (!truncation.truncated) {
		return { content: truncation.content, truncated: false, totalBytes: truncation.totalBytes, outputBytes };
	}
	const notice = `[Monitor output truncated: showing last ${outputBytes} of ${truncation.totalBytes} bytes]`;
	return {
		content: `${truncation.content}\n${notice}`,
		truncated: true,
		totalBytes: truncation.totalBytes,
		outputBytes,
	};
}

/**
 * Standalone monitor execution — can be called from BackgroundTool or any context with a ToolSession.
 */
export async function executeMonitor(
	session: ToolSession,
	params: MonitorParams,
	context?: AgentToolContext,
): Promise<AgentToolResult<MonitorToolDetails>> {
	const manager = AsyncJobManager.instance();
	if (!manager) {
		throw new ToolError("Async execution is disabled; the monitor tool is unavailable in this session.");
	}

	const persistent = params.persistent ?? false;
	const effectiveSilent = params.silent ?? params.kind === "poll";
	const effectiveDedup = params.deduplicate ?? params.kind === "poll";
	const label = buildMonitorLabel(params);
	const ownerId = session.getAgentId?.() ?? undefined;
	const bash = new BashTool(session);
	let deliveredFirstLine = false;
	const controller = { closed: false };
	let currentJobId = "";
	let sequence = 0;
	let latestLine: string | undefined;
	let coalescedCount = 0;
	let flushScheduled = false;
	let lastSeenLine: string | undefined;
	let pendingNotifications = 0;

	const isMonitorMessage = (message: { customType?: string; details?: unknown }) =>
		message.customType === "task-notification" &&
		(message.details as { taskId?: string } | undefined)?.taskId === currentJobId;

	const flushLatest = () => {
		if (!persistent || latestLine === undefined) return;
		const line = latestLine;
		const count = coalescedCount;
		latestLine = undefined;
		coalescedCount = 0;
		flushScheduled = false;
		sendNotification(line, currentJobId, count);
	};

	const closeMonitor = (mode: "purge" | "flush") => {
		if (mode === "flush") {
			flushLatest();
			controller.closed = true;
			return;
		}
		controller.closed = true;
		if (!persistent) return;
		return session.purgeQueuedCustomMessages?.(isMonitorMessage);
	};

	const sendNotification = (line: string, jobId: string, count: number) => {
		if (controller.closed) return;
		const notificationId = `${jobId}:${sequence}`;
		const suffix = count > 0 ? `\n(+${count} earlier lines)` : "";
		const notificationLine = formatMonitorNotificationLine(line);
		const content = `<task-notification>\nMonitor task ${jobId} (${params.kind}: ${params.description}) emitted latest state:\n${notificationLine.content}${suffix}\n</task-notification>`;
		const details = {
			taskId: jobId,
			kind: params.kind,
			description: params.description,
			monitor: true,
			notificationId,
			sequence,
			coalescedCount: count,
			outputTruncated: notificationLine.truncated,
			outputTotalBytes: notificationLine.totalBytes,
			outputBytes: notificationLine.outputBytes,
		};
		pendingNotifications += 1;
		if (pendingNotifications > MAX_PENDING_MONITOR_NOTIFICATIONS) {
			session.purgeQueuedCustomMessages?.(
				m =>
					m.customType === "task-notification" &&
					(m.details as { taskId?: string; notificationId?: string } | undefined)?.taskId === jobId &&
					(m.details as { notificationId?: string } | undefined)?.notificationId !== notificationId,
			);
			pendingNotifications = MAX_PENDING_MONITOR_NOTIFICATIONS;
		}
		const sendPromise = session.sendCustomMessage?.(
			{ customType: "task-notification", content, display: false, attribution: "agent", details },
			{ triggerTurn: !effectiveSilent, deliverAs: "followUp" },
		);
		if (sendPromise) {
			void sendPromise.catch(error => {
				logger.warn("Monitor task-notification delivery failed", {
					error: error instanceof Error ? error.message : String(error),
				});
			});
		} else if (!effectiveSilent) {
			session.steer?.({ customType: "task-notification", content, details });
		}
	};

	const schedulePersistentNotification = (line: string) => {
		latestLine = line;
		sequence += 1;
		coalescedCount += flushScheduled ? 1 : 0;
		if (flushScheduled) return;
		flushScheduled = true;
		queueMicrotask(flushLatest);
	};

	const monitorJob = await bash.startMonitorJob(
		{ command: params.command, timeout: params.timeout },
		{
			ownerId,
			label,
			ctx: context,
			shouldAcceptRawLine: () => !controller.closed,
			lifecycle: {
				onCancel: () => closeMonitor("purge"),
				onTerminal: () => closeMonitor("flush"),
				onEvict: () => closeMonitor("purge"),
				onTombstonePurge: () => closeMonitor("purge"),
			},
			onRawLine: (line, jobId) => {
				if (controller.closed) return;
				currentJobId = jobId;
				if (!persistent && deliveredFirstLine) return;
				deliveredFirstLine = true;
				if (persistent) {
					if (effectiveDedup && line === lastSeenLine) return;
					lastSeenLine = line;
					schedulePersistentNotification(line);
					return;
				}
				sendNotification(line, jobId, 0);
				manager.cancel(jobId, ownerId ? { ownerId } : undefined);
			},
		},
	);
	currentJobId = monitorJob.jobId;

	const startedText = `Monitor started · task ${monitorJob.jobId} · persistent: ${persistent}`;

	return {
		content: [{ type: "text", text: startedText }],
		details: {
			taskId: monitorJob.jobId,
			kind: params.kind,
			description: params.description,
			command: params.command,
			persistent,
		},
	};
}

/**
 * Thin wrapper class preserved for test compatibility and backward reference.
 * All execution logic lives in executeMonitor().
 */
export class MonitorTool {
	readonly name = "monitor";
	readonly label = "Monitor";
	readonly summary = "Start a background monitor that streams stdout lines as task notifications";
	readonly description: string;
	readonly parameters = monitorParamsSchema;
	readonly strict = true;
	readonly loadMode = "discoverable" as const;

	constructor(private readonly session: ToolSession) {
		this.description = "Background monitor tool (use background op:start_monitor instead)";
	}

	static createIf(session: ToolSession): MonitorTool | null {
		return new MonitorTool(session);
	}

	async execute(
		_toolCallId: string,
		params: MonitorParams,
		_signal?: AbortSignal,
		_onUpdate?: unknown,
		context?: import("@jawcode-dev/agent-core").AgentToolContext,
	): Promise<import("@jawcode-dev/agent-core").AgentToolResult<MonitorToolDetails>> {
		return executeMonitor(this.session, params, context);
	}
}
