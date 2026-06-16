import type { AgentMessage, AgentTool } from "@gajae-code/agent-core";
import type { AssistantMessage, ImageContent } from "@gajae-code/ai";
import { type Component, Spacer, Text, type TUI } from "@gajae-code/tui";
import type { MessageRenderer } from "../../extensibility/extensions/types";
import {
	type BashExecutionMessage,
	type CustomMessage,
	isSilentAbort,
	type PythonExecutionMessage,
	SKILL_PROMPT_MESSAGE_TYPE,
	type SkillPromptDetails,
} from "../../session/messages";
import type { SessionContext } from "../../session/session-manager";
import { formatBytes, formatDuration } from "../../tools/render-utils";
import { AssistantMessageComponent } from "../components/assistant-message";
import { BashExecutionComponent } from "../components/bash-execution";
import { BranchSummaryMessageComponent } from "../components/branch-summary-message";
import { CompactionSummaryMessageComponent } from "../components/compaction-summary-message";
import { CustomMessageComponent } from "../components/custom-message";
import { EvalExecutionComponent } from "../components/eval-execution";
import { ReadToolGroupComponent, readArgsHaveTarget, readArgsTargetInternalUrl } from "../components/read-tool-group";
import { SkillMessageComponent } from "../components/skill-message";
import { ToolExecutionComponent } from "../components/tool-execution";
import { UserMessageComponent } from "../components/user-message";
import { theme } from "../theme/theme";
import { markLiveToggleEligible } from "./ui-helpers";

export type SessionTranscriptReplayDeps = {
	ui: TUI;
	cwd: string;
	hideThinkingBlock: boolean;
	toolOutputExpanded: boolean;
	retryAttempt: number;
	getToolByName(name: string): AgentTool | undefined;
	getUserMessageText?(message: AgentMessage): string;
	getMessageRenderer?(customType: string): MessageRenderer | undefined;
	requestRender(): void;
	showImages: boolean;
	readToolResultPreview: boolean;
	editFuzzyThreshold: number;
	editAllowFuzzy: boolean;
	hashlineAutoDropPureInsertDuplicates: boolean;
};

export type SessionTranscriptReplayOptions = {
	mode: "transcript" | "chat";
};

type ToolReplayComponent = ToolExecutionComponent | ReadToolGroupComponent;
type MinimizeCapable = { setMinimized?(minimized: boolean): void };
type TextBlock = { type: "text"; text: string };

function markHistorical<T extends Component>(component: T): T {
	markLiveToggleEligible(component, false);
	return component;
}

function textFromMessage(message: AgentMessage): string {
	const content = "content" in message ? message.content : undefined;
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.filter((item): item is TextBlock => item.type === "text" && typeof item.text === "string")
			.map(item => item.text)
			.join("\n");
	}
	return "";
}

function normalizeArgs(args: unknown): Record<string, unknown> {
	return args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
}

type ReplayToolCall = Extract<AssistantMessage["content"][number], { type: "toolCall" }>;
type DedicatedExecutionMessage = BashExecutionMessage | PythonExecutionMessage;

function isReplayBoundary(message: AgentMessage): boolean {
	return message.role === "assistant" || message.role === "user" || message.role === "developer";
}

function findDedicatedExecutionForToolCall(
	messages: AgentMessage[],
	startIndex: number,
	toolCall: ReplayToolCall,
	consumedExecutions: Set<AgentMessage>,
): DedicatedExecutionMessage | undefined {
	const args = normalizeArgs(toolCall.arguments);

	for (let index = startIndex + 1; index < messages.length; index++) {
		const message = messages[index];
		if (!message || consumedExecutions.has(message)) continue;

		if (message.role === "toolResult" && message.toolCallId === toolCall.id) {
			return undefined;
		}

		if (isReplayBoundary(message)) break;

		if (
			toolCall.name === "bash" &&
			message.role === "bashExecution" &&
			typeof args.command === "string" &&
			message.command === args.command
		) {
			return message;
		}

		if (
			toolCall.name === "eval" &&
			message.role === "pythonExecution" &&
			typeof args.code === "string" &&
			message.code === args.code
		) {
			return message;
		}
	}

	return undefined;
}

function replayDedicatedExecution(
	message: DedicatedExecutionMessage,
	deps: SessionTranscriptReplayDeps,
	args: Record<string, unknown>,
): Component & MinimizeCapable {
	if (message.role === "bashExecution") {
		const component = new BashExecutionComponent(message.command, deps.ui, message.excludeFromContext);
		component.setComplete(message.exitCode, message.cancelled, {
			output: message.output,
			truncation: message.meta?.truncation,
		});
		return markHistorical(component);
	}

	const language = args.language === "js" ? "js" : "python";
	const component = new EvalExecutionComponent(message.code, deps.ui, message.excludeFromContext, language);
	component.setComplete(message.exitCode, message.cancelled, {
		output: message.output,
		truncation: message.meta?.truncation,
	});
	return markHistorical(component);
}

function addMarked(items: Component[], component: Component): void {
	items.push(markHistorical(component));
}

function renderAsyncResultRows(message: CustomMessage<unknown>): Component[] {
	const details = message.details as
		| {
				jobId?: string;
				type?: "bash" | "task";
				label?: string;
				durationMs?: number;
				jobs?: Array<{
					jobId?: string;
					type?: "bash" | "task";
					label?: string;
					durationMs?: number;
				}>;
		  }
		| undefined;
	const jobs =
		details?.jobs && details.jobs.length > 0
			? details.jobs
			: [
					{
						jobId: details?.jobId,
						type: details?.type,
						label: details?.label,
						durationMs: details?.durationMs,
					},
				];
	return jobs.map(job => {
		const jobId = job.jobId ?? "unknown";
		const typeLabel = job.type ? `[${job.type}]` : "[job]";
		const duration = typeof job.durationMs === "number" ? formatDuration(job.durationMs) : undefined;
		const line = [
			theme.fg("success", `${theme.status.success} Background job completed`),
			theme.fg("dim", typeLabel),
			theme.fg("accent", jobId),
			duration ? theme.fg("dim", `(${duration})`) : undefined,
		]
			.filter(Boolean)
			.join(" ");
		return markHistorical(new Text(line, 1, 0));
	});
}

function renderIrcRows(message: CustomMessage<unknown>): Component[] {
	const details = message.details as
		| { from?: string; to?: string; message?: string; reply?: string; body?: string; kind?: "message" | "reply" }
		| undefined;
	let arrow: string;
	let body: string;
	if (message.customType === "irc:incoming") {
		const peer = details?.from ?? "?";
		body = details?.message ?? "";
		arrow = `⇦ ${peer}`;
	} else if (message.customType === "irc:autoreply") {
		const peer = details?.to ?? "?";
		body = details?.reply ?? "";
		arrow = `⇨ ${peer}`;
	} else {
		const from = details?.from ?? "?";
		const to = details?.to ?? "?";
		body = details?.body ?? "";
		arrow = `${from} ⇨ ${to}`;
	}
	const components: Component[] = [markHistorical(new Text(theme.fg("accent", `[IRC] ${arrow}`), 1, 0))];
	if (body) {
		for (const line of body.split("\n")) {
			components.push(markHistorical(new Text(theme.fg("muted", `  ${line}`), 0, 0)));
		}
	}
	return components;
}

function replayStandardMessage(message: AgentMessage, deps: SessionTranscriptReplayDeps): Component[] {
	switch (message.role) {
		case "bashExecution": {
			const component = new BashExecutionComponent(message.command, deps.ui, message.excludeFromContext);
			component.setComplete(message.exitCode, message.cancelled, {
				output: message.output,
				truncation: message.meta?.truncation,
			});
			return [markHistorical(component)];
		}
		case "pythonExecution": {
			const component = new EvalExecutionComponent(message.code, deps.ui, message.excludeFromContext);
			component.setComplete(message.exitCode, message.cancelled, {
				output: message.output,
				truncation: message.meta?.truncation,
			});
			return [markHistorical(component)];
		}
		case "hookMessage":
		case "custom": {
			if (!message.display) return [];
			const customMessage = message as CustomMessage<unknown>;
			if (customMessage.customType === "async-result") return renderAsyncResultRows(customMessage);
			if (customMessage.customType === SKILL_PROMPT_MESSAGE_TYPE) {
				const component = new SkillMessageComponent(customMessage as CustomMessage<SkillPromptDetails>);
				component.setExpanded(false);
				return [markHistorical(component)];
			}
			if (
				customMessage.customType === "irc:incoming" ||
				customMessage.customType === "irc:autoreply" ||
				customMessage.customType === "irc:relay"
			) {
				return renderIrcRows(customMessage);
			}
			const component = new CustomMessageComponent(
				customMessage,
				deps.getMessageRenderer?.(customMessage.customType),
			);
			component.setExpanded(false);
			return [markHistorical(component)];
		}
		case "compactionSummary": {
			const spacer = markHistorical(new Spacer(1));
			const component = new CompactionSummaryMessageComponent(message);
			component.setExpanded(false);
			return [spacer, markHistorical(component)];
		}
		case "branchSummary": {
			const spacer = markHistorical(new Spacer(1));
			const component = new BranchSummaryMessageComponent(message);
			component.setExpanded(false);
			return [spacer, markHistorical(component)];
		}
		case "fileMention": {
			return message.files.map(file => {
				let suffix: string;
				if (file.skippedReason === "tooLarge") {
					const size = typeof file.byteSize === "number" ? formatBytes(file.byteSize) : "unknown size";
					suffix = `(skipped: ${size})`;
				} else {
					suffix = file.image
						? "(image)"
						: file.lineCount === undefined
							? "(unknown lines)"
							: `(${file.lineCount} lines)`;
				}
				const text = `${theme.fg("dim", `${theme.tree.last} `)}${theme.fg("muted", "Read")} ${theme.fg(
					"accent",
					file.path,
				)} ${theme.fg("dim", suffix)}`;
				return markHistorical(new Text(text, 0, 0));
			});
		}
		case "user":
		case "developer": {
			const textContent = deps.getUserMessageText?.(message) || textFromMessage(message);
			if (!textContent) return [];
			const isSynthetic = message.role === "developer" ? true : (message.synthetic ?? false);
			return [markHistorical(new UserMessageComponent(textContent, isSynthetic))];
		}
		case "assistant":
		case "toolResult":
			return [];
		default:
			return [];
	}
}

export function buildSessionTranscriptComponents(
	sessionContext: SessionContext,
	deps: SessionTranscriptReplayDeps,
	options: SessionTranscriptReplayOptions,
): Component[] {
	if (options.mode !== "transcript") {
		throw new Error("session transcript replay H1 only supports transcript mode");
	}
	const items: Component[] = [];
	const pendingTools = new Map<string, ToolReplayComponent>();
	let readGroup: ReadToolGroupComponent | null = null;
	const readToolCallArgs = new Map<string, Record<string, unknown>>();
	const readToolCallAssistantComponents = new Map<string, AssistantMessageComponent>();
	let lastToolComponent: MinimizeCapable | undefined;
	const consumedDedicatedExecutions = new Set<AgentMessage>();

	for (let messageIndex = 0; messageIndex < sessionContext.messages.length; messageIndex++) {
		const message = sessionContext.messages[messageIndex];
		if (!message || consumedDedicatedExecutions.has(message)) continue;
		if (message.role === "assistant") {
			lastToolComponent?.setMinimized?.(true);
			lastToolComponent = undefined;
			readGroup = null;
			const contentBlocks = message.content;
			let assistantComponent: AssistantMessageComponent | undefined;
			let segmentStart = 0;
			const isAbortedSilently = message.stopReason === "aborted" && isSilentAbort(message.errorMessage);
			const hasErrorStop =
				!isAbortedSilently && (message.stopReason === "aborted" || message.stopReason === "error");
			const errorMessage = hasErrorStop
				? message.stopReason === "aborted"
					? deps.retryAttempt > 0
						? `Aborted after ${deps.retryAttempt} retry attempt${deps.retryAttempt > 1 ? "s" : ""}`
						: "Operation aborted"
					: message.errorMessage || "Error"
				: null;

			const flushSegment = (end: number): void => {
				const slice = contentBlocks.slice(segmentStart, end);
				segmentStart = end;
				const visible = slice.some(
					c => (c.type === "text" && c.text.trim()) || (c.type === "thinking" && c.thinking.trim()),
				);
				if (!visible) return;
				lastToolComponent?.setMinimized?.(true);
				lastToolComponent = undefined;
				const segmentMessage: AssistantMessage =
					end < contentBlocks.length
						? { ...message, content: slice, stopReason: "stop" as const, errorMessage: undefined }
						: { ...message, content: slice };
				const component = new AssistantMessageComponent(segmentMessage, deps.hideThinkingBlock, deps.requestRender);
				component.setThinkingExpanded(false);
				if (end >= contentBlocks.length) component.setUsageInfo(message.usage);
				addMarked(items, component);
				assistantComponent = component;
				readGroup = null;
			};

			for (let blockIndex = 0; blockIndex < contentBlocks.length; blockIndex++) {
				const content = contentBlocks[blockIndex];
				if (content.type !== "toolCall") continue;
				flushSegment(blockIndex);
				if (
					content.name === "read" &&
					readArgsHaveTarget(content.arguments) &&
					!readArgsTargetInternalUrl(content.arguments)
				) {
					if (!readGroup) {
						readGroup = new ReadToolGroupComponent({ showContentPreview: deps.readToolResultPreview });
						readGroup.setExpanded(false);
						addMarked(items, readGroup);
					}
					const normalizedArgs = normalizeArgs(content.arguments);
					readGroup.updateArgs(normalizedArgs, content.id);
					pendingTools.set(content.id, readGroup);
					if (assistantComponent) readToolCallAssistantComponents.set(content.id, assistantComponent);
					if (hasErrorStop && errorMessage) {
						readGroup.updateResult(
							{ content: [{ type: "text", text: errorMessage }], isError: true },
							false,
							content.id,
						);
						pendingTools.delete(content.id);
					}
					continue;
				}

				readGroup = null;
				const dedicatedExecution = findDedicatedExecutionForToolCall(
					sessionContext.messages,
					messageIndex,
					content,
					consumedDedicatedExecutions,
				);
				if (dedicatedExecution) {
					const dedicatedArgs = normalizeArgs(content.arguments);
					const component = replayDedicatedExecution(dedicatedExecution, deps, dedicatedArgs);
					lastToolComponent?.setMinimized?.(true);
					lastToolComponent = component;
					items.push(component);
					consumedDedicatedExecutions.add(dedicatedExecution);
					continue;
				}
				const tool = deps.getToolByName(content.name);
				const renderArgs =
					"partialJson" in content
						? { ...content.arguments, __partialJson: content.partialJson }
						: content.arguments;
				const component = new ToolExecutionComponent(
					content.name,
					renderArgs,
					{
						showImages: deps.showImages,
						editFuzzyThreshold: deps.editFuzzyThreshold,
						editAllowFuzzy: deps.editAllowFuzzy,
						hashlineAutoDropPureInsertDuplicates: deps.hashlineAutoDropPureInsertDuplicates,
					},
					tool,
					deps.ui,
					deps.cwd,
					content.id,
				);
				component.setExpanded(false);
				component.setArgsComplete(content.id);
				markHistorical(component);
				lastToolComponent?.setMinimized?.(true);
				lastToolComponent = component;
				items.push(component);
				if (hasErrorStop && errorMessage) {
					component.updateResult(
						{ content: [{ type: "text", text: errorMessage }], isError: true },
						false,
						content.id,
					);
				} else {
					pendingTools.set(content.id, component);
				}
			}
			flushSegment(contentBlocks.length);
			assistantComponent?.setUsageInfo(message.usage);
			continue;
		}

		if (message.role === "toolResult") {
			const pendingReadComponent = pendingTools.get(message.toolCallId);
			const isReadGroupResult =
				message.toolName === "read" &&
				(!pendingReadComponent || pendingReadComponent instanceof ReadToolGroupComponent);
			if (isReadGroupResult) {
				const assistantComponent = readToolCallAssistantComponents.get(message.toolCallId);
				const images: ImageContent[] = message.content.filter(
					(content): content is ImageContent => content.type === "image",
				);
				if (images.length > 0 && assistantComponent && deps.showImages) {
					assistantComponent.setToolResultImages(message.toolCallId, images);
					const hasText = message.content.some(c => c.type === "text");
					if (!hasText) {
						if (pendingReadComponent instanceof ReadToolGroupComponent) {
							pendingReadComponent.deleteEntry(message.toolCallId);
							if (pendingReadComponent.isEmpty()) {
								const index = items.indexOf(pendingReadComponent);
								if (index >= 0) items.splice(index, 1);
								if (readGroup === pendingReadComponent) readGroup = null;
							}
						}
						pendingTools.delete(message.toolCallId);
						readToolCallArgs.delete(message.toolCallId);
						readToolCallAssistantComponents.delete(message.toolCallId);
						continue;
					}
				}
				let component = pendingTools.get(message.toolCallId);
				if (!component) {
					if (!readGroup) {
						readGroup = new ReadToolGroupComponent({ showContentPreview: deps.readToolResultPreview });
						readGroup.setExpanded(false);
						addMarked(items, readGroup);
					}
					const args = readToolCallArgs.get(message.toolCallId);
					if (args) readGroup.updateArgs(args, message.toolCallId);
					component = readGroup;
					pendingTools.set(message.toolCallId, readGroup);
				}
				component.updateResult(message, false, message.toolCallId);
				pendingTools.delete(message.toolCallId);
				readToolCallArgs.delete(message.toolCallId);
				readToolCallAssistantComponents.delete(message.toolCallId);
				continue;
			}

			const component = pendingTools.get(message.toolCallId);
			if (component) {
				component.updateResult(message, false, message.toolCallId);
				pendingTools.delete(message.toolCallId);
				continue;
			}
			const fallback = new Text(theme.fg("toolTitle", `Tool ${message.toolName}`), 1, 0);
			addMarked(items, fallback);
			for (const part of message.content) {
				if (part.type === "text" && part.text) {
					for (const line of part.text.split("\n")) addMarked(items, new Text(line, 0, 0));
				}
			}
			continue;
		}

		for (const component of replayStandardMessage(message, deps)) {
			items.push(component);
		}
	}

	return items;
}
