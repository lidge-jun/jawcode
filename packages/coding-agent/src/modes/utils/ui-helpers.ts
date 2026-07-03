import type { AgentMessage } from "@jawcode-dev/agent-core";
import type { AssistantMessage, ImageContent, Message } from "@jawcode-dev/ai";
import { type Component, Spacer, Text, TruncatedText, ViewportFill } from "@jawcode-dev/tui";
import { APP_NAME } from "@jawcode-dev/utils";
import { settings } from "../../config/settings";
import { isJawBrand } from "../../discovery/helpers";
import { AssistantMessageComponent } from "../../modes/components/assistant-message";
import { BashExecutionComponent } from "../../modes/components/bash-execution";
import { BranchSummaryMessageComponent } from "../../modes/components/branch-summary-message";
import { CompactionSummaryMessageComponent } from "../../modes/components/compaction-summary-message";
import { CustomMessageComponent } from "../../modes/components/custom-message";
import { DynamicBorder } from "../../modes/components/dynamic-border";
import { EvalExecutionComponent } from "../../modes/components/eval-execution";
import {
	ReadToolGroupComponent,
	readArgsHaveTarget,
	readArgsTargetInternalUrl,
} from "../../modes/components/read-tool-group";
import { SkillMessageComponent } from "../../modes/components/skill-message";
import { ToolExecutionComponent } from "../../modes/components/tool-execution";
import { UserMessageComponent } from "../../modes/components/user-message";
import { theme } from "../../modes/theme/theme";
import type { CompactionQueuedMessage, InteractiveModeContext } from "../../modes/types";
import {
	type CustomMessage,
	isSilentAbort,
	SKILL_PROMPT_MESSAGE_TYPE,
	type SkillPromptDetails,
} from "../../session/messages";
import type { SessionContext } from "../../session/session-manager";
import { formatBytes, formatDuration } from "../../tools/render-utils";

type TextBlock = { type: "text"; text: string };
interface RenderInitialMessagesOptions {
	preserveExistingChat?: boolean;
}
type LiveToggleEligible = {
	liveToggleEligible?: boolean;
};

type QueuedMessages = {
	steering: string[];
	followUp: string[];
};

/**
 * 083.9 P2-b → 083.10 §1: commit render lane gate. DEFAULT ON — finalized
 * cells are written once into the real terminal scrollback instead of living
 * in the diff-rendered frame. JWC_COMMIT_LANE=0 opts out (virtual lane only);
 * unsupported terminals/zellij/overlays fall back per-call inside
 * TUI.commitLines regardless of this gate.
 */
export function commitLaneEnabled(): boolean {
	const env = process.env.JWC_COMMIT_LANE;
	if (env !== undefined) return env !== "0" && env !== "false";
	return true;
}

/**
 * 99.20.04 / 260703 WP6a-B — tool render mode. `commit` (jaw brand default):
 * live-zone previews + collapsed-on-completion + ctrl+o current-turn
 * expansion. `verbose` (engine default, gjc upstream parity): every tool and
 * thinking block renders fully expanded, permanently — no minimize on the
 * next tool, no fold toggle.
 */
export function toolRenderModeIsCommit(): boolean {
	const mode = settings.get("tool.renderMode");
	return (mode ?? (isJawBrand() ? "commit" : "verbose")) === "commit";
}

/**
 * 260703 WP6b — commit-on-completion: finalized blocks reach the terminal
 * scrollback as they complete instead of waiting for the next prompt submit
 * (codex-rs model). Safe since the 260704 top-anchor redesign (devlog 80):
 * commits either write directly into blank fill rows (no scroll) or push
 * ONLY content across the scrollback seam, so the blank-gap class that
 * forced the earlier rollback is geometrically impossible.
 * JWC_COMMIT_ON_COMPLETION=0 opts out.
 */
export function commitOnCompletionEnabled(): boolean {
	const env = process.env.JWC_COMMIT_ON_COMPLETION;
	if (env !== undefined) return env !== "0" && env !== "false";
	return true;
}

/**
 * 260703 WP6b — mid-turn contiguous-prefix commit. Reuses the exact
 * turn-boundary sweep (same stopper set: streaming component, pending tools,
 * non-committable children — so it can never commit past live content or out
 * of order), and every refusal lane degrades to today's behavior: the block
 * stays in the virtual lane and the next boundary sweep retries. Refusals
 * come free from TUI.commitLines (overlay open, frame overflowed, WP3b-min
 * off-bottom/mux gate while streaming, width probe unresolved). COMMIT MODE
 * ONLY: renderCommitted() forces the collapsed form, which is the committed
 * contract for commit mode but would violate verbose permanence — verbose
 * keeps its boundary-only cadence.
 */
export function commitFinalizedBacklogMidTurn(ctx: InteractiveModeContext): void {
	if (!commitOnCompletionEnabled()) return;
	if (!toolRenderModeIsCommit()) return;
	commitFinalizedBacklog(ctx);
}

export function markLiveToggleEligible(component: unknown, eligible: boolean): void {
	if (typeof component === "object" && component !== null) {
		(component as LiveToggleEligible).liveToggleEligible = eligible;
	}
}

/**
 * 260703 WP2 — multiset helpers for the local-submission signature protocol.
 * Signatures are `text\u0000imageCount`; identical texts must keep independent
 * credits or a second delivery re-adds a duplicate chat component / wipes the
 * editor draft (see devlog 30_dup_input_signatures.md).
 */
export function addSignatureCredit(counts: Map<string, number>, signature: string): void {
	counts.set(signature, (counts.get(signature) ?? 0) + 1);
}

/** Consume one credit; false when none remain. */
export function consumeSignatureCredit(counts: Map<string, number>, signature: string): boolean {
	const n = counts.get(signature) ?? 0;
	if (n <= 0) return false;
	if (n === 1) counts.delete(signature);
	else counts.set(signature, n - 1);
	return true;
}

/** Remove the first occurrence; false when absent. */
export function takeFirstSignature(list: string[], signature: string): boolean {
	const index = list.indexOf(signature);
	if (index === -1) return false;
	list.splice(index, 1);
	return true;
}

export function isLiveToggleEligible(component: unknown): boolean {
	return (
		typeof component === "object" &&
		component !== null &&
		(component as LiveToggleEligible).liveToggleEligible === true
	);
}

type CommittedRenderable = {
	renderCommitted(width: number): string[];
};

function hasCommittedRenderer(component: unknown): component is CommittedRenderable {
	return (
		typeof component === "object" &&
		component !== null &&
		"renderCommitted" in component &&
		typeof (component as { renderCommitted?: unknown }).renderCommitted === "function"
	);
}

/**
 * 083.9 P4 — turn-boundary commit sweep. Called right before the next prompt
 * submit: every finalized chat component commits its pixels into the
 * scrollback and is flagged `committed` (frame assembly skips it; the object
 * stays in chatContainer for alt+t transcript and sweeps). The just-finished
 * turn therefore stays FULLY interactive (ctrl+o/t, focus mode, Enter
 * expand) until the user moves on — pixels freeze only at the turn boundary.
 *
 * Commits must form a contiguous prefix of the frame, so the walk stops at
 * the first non-committable child (streaming component, pending tool awaiting
 * a result, or a commitLines fallback).
 */
/**
 * The contiguous-prefix stopper set shared by the sweep and the realign gate
 * (they MUST stay identical — gpt-5.5 review rounds 1/3): the streaming
 * component, a pending agent tool, or any component that declares itself not
 * yet committable (`isBacklogCommittable()` — user `!`/`$` bash/eval
 * executions still running across a turn boundary; committing them freezes
 * their pixels and their later result updates could never render).
 */
function stopsBacklogSweep(ctx: InteractiveModeContext, pending: Set<unknown>, child: unknown): boolean {
	if (child === ctx.streamingComponent || pending.has(child)) return true;
	const committable = (child as { isBacklogCommittable?: () => boolean }).isBacklogCommittable;
	return typeof committable === "function" && committable.call(child) === false;
}

export function commitFinalizedBacklog(ctx: InteractiveModeContext, options?: { markOnly?: boolean }): void {
	// The typeof guard doubles as a harness escape hatch: partial UI fixtures
	// (and any non-TUI surface) simply stay on the virtual lane.
	if (!commitLaneEnabled() || typeof ctx.ui.commitLines !== "function") return;
	// 260702 F3: after a successful scroll-out realign the finalized cells'
	// pixels are already in the physical scrollback (as-streamed) — mark them
	// committed WITHOUT a second insert-history write, or the content would
	// appear twice in history.
	const markOnly = options?.markOnly === true;
	const width = Math.max(1, ctx.ui.terminal?.columns ?? 80);
	const pending = new Set<unknown>(ctx.pendingTools.values());
	for (const child of ctx.chatContainer.children) {
		if (child.committed) continue;
		if (stopsBacklogSweep(ctx, pending, child)) return;
		if (!markOnly) {
			const lines = hasCommittedRenderer(child) ? child.renderCommitted(width) : child.render(width);
			if (lines.length > 0 && !ctx.ui.commitLines(lines)) return;
		}
		child.committed = true;
		markLiveToggleEligible(child, false);
	}
}

/**
 * 260702 F3 (gpt-5.5 review blocker) — the scroll-out realign is only safe
 * when the sweep that follows can mark the ENTIRE backlog: a still-pending
 * component (background/detached tool parked in chatContainer between turns)
 * or the streaming component stops the contiguous-prefix sweep, and its rows
 * — already pushed into the scrollback by the scroll-out — would be redrawn
 * by the forced rebuild, duplicating content across scrollback and frame.
 */
export function canMarkEntireBacklog(ctx: InteractiveModeContext): boolean {
	// Partial UI fixtures may omit these structures — refuse (skip realign)
	// rather than throw; realign is an optimization, not a correctness need.
	if (!ctx.pendingTools || !ctx.chatContainer?.children) return false;
	const pending = new Set<unknown>(ctx.pendingTools.values());
	for (const child of ctx.chatContainer.children) {
		if (child.committed) continue;
		if (stopsBacklogSweep(ctx, pending, child)) return false;
	}
	return true;
}

/**
 * 260702 F3 follow-up (user e2e: duplicated welcome banner) — after a
 * successful scroll-out realign the frame preamble (config warnings, spacers,
 * welcome banner, changelog — every direct UI child mounted ABOVE
 * chatContainer) is physically in the scrollback like everything else, but it
 * is outside the chatContainer sweep, so the forced rebuild repainted it and
 * pushed a fresh copy into history at every turn boundary. Mark it committed
 * (frame assembly skips committed children); the ViewportFill spacer must
 * stay live — it carries the pin sentinel.
 */
/**
 * 260704 gap fix — commit the PREAMBLE (welcome banner, warnings, changelog)
 * into the scrollback via the top-anchored write lane. With the fill sentinel
 * now the first frame child, the lane is alive from frame 1; committing the
 * preamble at the first stream start moves the banner to the scrollback seam
 * so all later content flows top-down beneath it (no banner-vs-chat gap) and
 * — critically — GUARANTEES reading order: chat rows must never commit above
 * an in-frame banner. Idempotent; stops at the first refusal and retries at
 * the next stream start.
 */
export function commitPreamble(ctx: InteractiveModeContext): void {
	if (!commitLaneEnabled() || typeof ctx.ui.commitLines !== "function") return;
	const children = ctx.ui.children;
	if (!Array.isArray(children)) return;
	const width = Math.max(1, ctx.ui.terminal?.columns ?? 80);
	for (const child of children) {
		if (child === (ctx.chatContainer as unknown as Component)) break;
		if (child instanceof ViewportFill) continue;
		if (child.committed) continue;
		const lines = hasCommittedRenderer(child) ? child.renderCommitted(width) : child.render(width);
		if (lines.length > 0 && !ctx.ui.commitLines(lines)) return;
		child.committed = true;
	}
}

export function markPreambleCommitted(ctx: InteractiveModeContext): void {
	const children = ctx.ui.children;
	if (!Array.isArray(children)) return;
	for (const child of children) {
		if (child === (ctx.chatContainer as unknown as Component)) break;
		if (child instanceof ViewportFill) continue;
		child.committed = true;
	}
}

/**
 * 260702 F3 — measure the composer cluster: every component mounted BELOW the
 * chat container (pending-message chips, live tool zone, status/todo/btw
 * containers, breathing-room spacer, status line, hook widgets, editor,
 * composer footer, background panel). Walking the actual TUI child list keeps
 * anonymous members (the Spacer) and future additions counted. Returns -1
 * when the cluster cannot be located — the realign refuses rather than
 * scrolling composer pixels into history.
 */
export function measureComposerClusterRows(ctx: InteractiveModeContext): number {
	const children = ctx.ui.children;
	if (!Array.isArray(children)) return -1;
	// 260703 v3: anchor on the chat container, not the live tool container —
	// pendingMessagesContainer (queued Steer/Follow-up chips) is mounted
	// BETWEEN them, and measuring below liveToolContainer classified the chip
	// pixels as transcript content, so the realign parked stale gray chip text
	// into the committed block and stamped it into the scrollback. Everything
	// below the transcript is composer cluster.
	const start = children.indexOf(ctx.chatContainer as never);
	if (start === -1) return -1;
	const width = Math.max(1, ctx.ui.terminal?.columns ?? 80);
	let rows = 0;
	for (let i = start + 1; i < children.length; i++) {
		rows += children[i].render(width).length;
	}
	return rows;
}

export class UiHelpers {
	constructor(private ctx: InteractiveModeContext) {}

	/** Extract text content from a user message */
	getUserMessageText(message: Message): string {
		if (message.role !== "user") return "";
		const textBlocks =
			typeof message.content === "string"
				? [{ type: "text", text: message.content }]
				: message.content.filter((content): content is TextBlock => content.type === "text");
		return textBlocks.map(block => block.text).join("");
	}

	/**
	 * Show a status message in the chat.
	 *
	 * If multiple status messages are emitted back-to-back (without anything else being added to the chat),
	 * we update the previous status line instead of appending new ones to avoid log spam.
	 */
	showStatus(message: string, options?: { dim?: boolean }): void {
		if (this.ctx.isBackgrounded) {
			return;
		}
		const children = this.ctx.chatContainer.children;
		const last = children.length > 0 ? children[children.length - 1] : undefined;
		const secondLast = children.length > 1 ? children[children.length - 2] : undefined;
		const useDim = options?.dim ?? true;
		const rendered = useDim ? theme.fg("dim", message) : message;

		if (last && secondLast && last === this.ctx.lastStatusText && secondLast === this.ctx.lastStatusSpacer) {
			this.ctx.lastStatusText.setText(rendered);
			this.ctx.ui.requestRender();
			return;
		}

		const spacer = new Spacer(1);
		const text = new Text(rendered, 1, 0);
		this.ctx.chatContainer.addChild(spacer);
		this.ctx.chatContainer.addChild(text);
		this.ctx.lastStatusSpacer = spacer;
		this.ctx.lastStatusText = text;
		this.ctx.ui.requestRender();
	}

	addMessageToChat(message: AgentMessage, options?: { populateHistory?: boolean; live?: boolean }): Component[] {
		switch (message.role) {
			case "bashExecution": {
				const component = new BashExecutionComponent(message.command, this.ctx.ui, message.excludeFromContext);
				if (message.output) {
					component.appendOutput(message.output);
				}
				component.setComplete(message.exitCode, message.cancelled, {
					truncation: message.meta?.truncation,
				});
				markLiveToggleEligible(component, options?.live === true);
				this.ctx.chatContainer.addChild(component);
				break;
			}
			case "pythonExecution": {
				const component = new EvalExecutionComponent(message.code, this.ctx.ui, message.excludeFromContext);
				if (message.output) {
					component.appendOutput(message.output);
				}
				component.setComplete(message.exitCode, message.cancelled, {
					truncation: message.meta?.truncation,
				});
				this.ctx.chatContainer.addChild(component);
				markLiveToggleEligible(component, options?.live === true);
				break;
			}
			case "hookMessage":
			case "custom": {
				if (message.display) {
					if (message.customType === "async-result") {
						const details = (
							message as CustomMessage<{
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
							}>
						).details;
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
						for (const job of jobs) {
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
							this.ctx.chatContainer.addChild(new Text(line, 1, 0));
						}
						break;
					}
					if (message.customType === SKILL_PROMPT_MESSAGE_TYPE) {
						const component = new SkillMessageComponent(message as CustomMessage<SkillPromptDetails>);
						component.setExpanded(options?.live === true ? this.ctx.toolOutputExpanded : false);
						markLiveToggleEligible(component, options?.live === true);
						this.ctx.chatContainer.addChild(component);
						break;
					}
					if (
						message.customType === "irc:incoming" ||
						message.customType === "irc:autoreply" ||
						message.customType === "irc:relay"
					) {
						const details = (
							message as CustomMessage<{
								from?: string;
								to?: string;
								message?: string;
								reply?: string;
								body?: string;
								kind?: "message" | "reply";
							}>
						).details;
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
						const components: Component[] = [];
						const header = `${theme.fg("accent", `[IRC] ${arrow}`)}`;
						const headerComponent = new Text(header, 1, 0);
						this.ctx.chatContainer.addChild(headerComponent);
						components.push(headerComponent);
						if (body) {
							for (const line of body.split("\n")) {
								const lineComponent = new Text(theme.fg("muted", `  ${line}`), 0, 0);
								this.ctx.chatContainer.addChild(lineComponent);
								components.push(lineComponent);
							}
						}
						return components;
					}
					const renderer = this.ctx.session.extensionRunner?.getMessageRenderer(message.customType);
					// Both HookMessage and CustomMessage have the same structure, cast for compatibility
					const component = new CustomMessageComponent(message as CustomMessage<unknown>, renderer);
					component.setExpanded(options?.live === true ? this.ctx.toolOutputExpanded : false);
					markLiveToggleEligible(component, options?.live === true);
					this.ctx.chatContainer.addChild(component);
				}
				break;
			}
			case "compactionSummary": {
				this.ctx.chatContainer.addChild(new Spacer(1));
				const component = new CompactionSummaryMessageComponent(message);
				component.setExpanded(options?.live === true ? this.ctx.toolOutputExpanded : false);
				markLiveToggleEligible(component, options?.live === true);
				this.ctx.chatContainer.addChild(component);
				break;
			}
			case "branchSummary": {
				this.ctx.chatContainer.addChild(new Spacer(1));
				const component = new BranchSummaryMessageComponent(message);
				component.setExpanded(options?.live === true ? this.ctx.toolOutputExpanded : false);
				markLiveToggleEligible(component, options?.live === true);
				this.ctx.chatContainer.addChild(component);
				break;
			}
			case "fileMention": {
				// Render compact file mention display
				for (const file of message.files) {
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
					this.ctx.chatContainer.addChild(new Text(text, 0, 0));
				}
				break;
			}
			case "user":
			case "developer": {
				const textContent = this.ctx.getUserMessageText(message);
				if (textContent) {
					const isSynthetic = message.role === "developer" ? true : (message.synthetic ?? false);
					const userComponent = new UserMessageComponent(textContent, isSynthetic);
					this.ctx.chatContainer.addChild(userComponent);
					if (options?.populateHistory && message.role === "user" && !isSynthetic) {
						this.ctx.editor.addToHistory(textContent);
					}
				}
				break;
			}
			case "assistant": {
				const assistantComponent = new AssistantMessageComponent(message, this.ctx.hideThinkingBlock, () =>
					this.ctx.ui.requestRender(),
				);
				assistantComponent.setThinkingExpanded(options?.live === true ? this.ctx.thinkingExpanded : false);
				markLiveToggleEligible(assistantComponent, options?.live === true);
				this.ctx.chatContainer.addChild(assistantComponent);
				break;
			}
			case "toolResult": {
				// Tool results are rendered inline with tool calls, handled separately
				break;
			}
			default: {
				message satisfies never;
			}
		}
		return [];
	}

	/**
	 * Render session context to chat. Used for initial load and rebuild after compaction.
	 * @param sessionContext Session context to render
	 * @param options.updateFooter Update footer state
	 * @param options.populateHistory Add user messages to editor history
	 */
	renderSessionContext(
		sessionContext: SessionContext,
		options: { updateFooter?: boolean; populateHistory?: boolean } = {},
	): void {
		// Preserved: message_start handler owns this lifecycle (see #783)
		this.ctx.pendingTools.clear();

		if (options.updateFooter) {
			this.ctx.statusLine.invalidate();
			this.ctx.updateEditorBorderColor();
		}

		let readGroup: ReadToolGroupComponent | null = null;
		const readToolCallArgs = new Map<string, Record<string, unknown>>();
		const readToolCallAssistantComponents = new Map<string, AssistantMessageComponent>();
		for (const message of sessionContext.messages) {
			// Assistant messages need special handling for tool calls
			if (message.role === "assistant") {
				// 083.1: a new assistant message closes the previous tool batch —
				// in replay every batch is history, so its last tool collapses too.
				this.ctx.lastToolComponent?.setMinimized?.(true);
				this.ctx.lastToolComponent = undefined;
				// 083.3: render the message in segments split at toolCall boundaries so
				// reasoning that followed a tool call appears below that tool's row.
				const contentBlocks = message.content;
				let assistantComponent: AssistantMessageComponent | undefined;
				let segmentStart = 0;
				const flushSegment = (end: number): void => {
					const slice = contentBlocks.slice(segmentStart, end);
					segmentStart = end;
					const visible = slice.some(
						c => (c.type === "text" && c.text.trim()) || (c.type === "thinking" && c.thinking.trim()),
					);
					if (!visible) return;
					// An assistant segment after tool rows closes that tool batch (083.1).
					this.ctx.lastToolComponent?.setMinimized?.(true);
					this.ctx.lastToolComponent = undefined;
					// Only the final segment keeps the error/abort footer.
					const segmentMessage =
						end < contentBlocks.length
							? { ...message, content: slice, stopReason: "stop" as const, errorMessage: undefined }
							: { ...message, content: slice };
					this.ctx.addMessageToChat(segmentMessage);
					const lastChild = this.ctx.chatContainer.children[this.ctx.chatContainer.children.length - 1];
					if (lastChild instanceof AssistantMessageComponent) {
						assistantComponent = lastChild;
					}
				};
				readGroup = null;
				const isAbortedSilently = message.stopReason === "aborted" && isSilentAbort(message.errorMessage);
				const hasErrorStop =
					!isAbortedSilently && (message.stopReason === "aborted" || message.stopReason === "error");
				const errorMessage = hasErrorStop
					? message.stopReason === "aborted"
						? (() => {
								const retryAttempt = this.ctx.session.retryAttempt;
								return retryAttempt > 0
									? `Aborted after ${retryAttempt} retry attempt${retryAttempt > 1 ? "s" : ""}`
									: "Operation aborted";
							})()
						: message.errorMessage || "Error"
					: null;

				// Render tool call components, flushing the preceding assistant
				// segment before each so block order matches arrival order (083.3).
				for (let blockIndex = 0; blockIndex < contentBlocks.length; blockIndex++) {
					const content = contentBlocks[blockIndex];
					if (content.type !== "toolCall") {
						continue;
					}
					flushSegment(blockIndex);

					if (
						content.name === "read" &&
						readArgsHaveTarget(content.arguments) &&
						!readArgsTargetInternalUrl(content.arguments)
					) {
						if (hasErrorStop && errorMessage) {
							if (!readGroup) {
								readGroup = new ReadToolGroupComponent({
									showContentPreview: this.ctx.settings.get("read.toolResultPreview"),
								});
								readGroup.setExpanded(false);
								markLiveToggleEligible(readGroup, false);
								this.ctx.chatContainer.addChild(readGroup);
							}
							readGroup.updateArgs(content.arguments, content.id);
							readGroup.updateResult(
								{ content: [{ type: "text", text: errorMessage }], isError: true },
								false,
								content.id,
							);
						} else {
							const normalizedArgs =
								content.arguments && typeof content.arguments === "object" && !Array.isArray(content.arguments)
									? (content.arguments as Record<string, unknown>)
									: {};
							readToolCallArgs.set(content.id, normalizedArgs);
							if (assistantComponent) {
								readToolCallAssistantComponents.set(content.id, assistantComponent);
							}
						}
						continue;
					}

					readGroup = null;
					const tool = this.ctx.session.getToolByName(content.name);
					const renderArgs =
						"partialJson" in content
							? { ...content.arguments, __partialJson: content.partialJson }
							: content.arguments;
					const component = new ToolExecutionComponent(
						content.name,
						renderArgs,
						{
							showImages: settings.get("terminal.showImages"),
							editFuzzyThreshold: settings.get("edit.fuzzyThreshold"),
							editAllowFuzzy: settings.get("edit.fuzzyMatch"),
							hashlineAutoDropPureInsertDuplicates: settings.get("edit.hashlineAutoDropPureInsertDuplicates"),
						},
						tool,
						this.ctx.ui,
						this.ctx.sessionManager.getCwd(),
						content.id,
					);
					component.setExpanded(false);
					markLiveToggleEligible(component, false);
					// 083.1: during replay, every tool minimizes its predecessor so only
					// the final tool block keeps its preview.
					this.ctx.lastToolComponent?.setMinimized?.(true);
					this.ctx.lastToolComponent = component;
					this.ctx.chatContainer.addChild(component);

					if (hasErrorStop && errorMessage) {
						component.updateResult(
							{ content: [{ type: "text", text: errorMessage }], isError: true },
							false,
							content.id,
						);
					} else {
						this.ctx.pendingTools.set(content.id, component);
					}
				}
				flushSegment(contentBlocks.length);
				assistantComponent?.setUsageInfo(message.usage);
			} else if (message.role === "toolResult") {
				const pendingReadComponent = this.ctx.pendingTools.get(message.toolCallId);
				const isReadGroupResult =
					message.toolName === "read" &&
					(!pendingReadComponent || pendingReadComponent instanceof ReadToolGroupComponent);
				if (isReadGroupResult) {
					const assistantComponent = readToolCallAssistantComponents.get(message.toolCallId);
					const images: ImageContent[] = message.content.filter(
						(content): content is ImageContent => content.type === "image",
					);
					if (images.length > 0 && assistantComponent && settings.get("terminal.showImages")) {
						assistantComponent.setToolResultImages(message.toolCallId, images);
						const hasText = message.content.some(c => c.type === "text");
						if (!hasText) {
							readToolCallArgs.delete(message.toolCallId);
							readToolCallAssistantComponents.delete(message.toolCallId);
							continue;
						}
					}
					let component = this.ctx.pendingTools.get(message.toolCallId);
					if (!component) {
						if (!readGroup) {
							readGroup = new ReadToolGroupComponent({
								showContentPreview: this.ctx.settings.get("read.toolResultPreview"),
							});
							readGroup.setExpanded(false);
							markLiveToggleEligible(readGroup, false);
							this.ctx.chatContainer.addChild(readGroup);
						}
						const args = readToolCallArgs.get(message.toolCallId);
						if (args) {
							readGroup.updateArgs(args, message.toolCallId);
						}
						component = readGroup;
						this.ctx.pendingTools.set(message.toolCallId, readGroup);
					}
					component.updateResult(message, false, message.toolCallId);
					this.ctx.pendingTools.delete(message.toolCallId);
					readToolCallArgs.delete(message.toolCallId);
					readToolCallAssistantComponents.delete(message.toolCallId);
					continue;
				}

				// Match tool results to pending tool components
				const component = this.ctx.pendingTools.get(message.toolCallId);
				if (component) {
					component.updateResult(message, false, message.toolCallId);
					this.ctx.pendingTools.delete(message.toolCallId);
				}
			} else {
				// All other messages use standard rendering
				this.ctx.addMessageToChat(message, options);
			}
		}
		this.ctx.pendingTools.clear();
		this.ctx.ui.requestRender();
	}

	renderInitialMessages(prebuiltContext?: SessionContext, options: RenderInitialMessagesOptions = {}): void {
		// This path is used to rebuild the visible chat transcript (e.g. after custom/debug UI).
		// Clear existing rendered chat first to avoid duplicating the full session in the container.
		const preservedChatChildren = options.preserveExistingChat ? this.ctx.chatContainer.children : undefined;
		this.ctx.chatContainer.clear();
		this.ctx.pendingMessagesContainer.clear();
		this.ctx.pendingBashComponents = [];
		this.ctx.pendingPythonComponents = [];

		// Reuse a pre-built context when available (e.g. from navigateTree) to avoid a second O(N) walk.
		const context = prebuiltContext ?? this.ctx.session.buildDisplaySessionContext();
		this.ctx.renderSessionContext(context, {
			updateFooter: true,
			populateHistory: true,
		});

		// Show compaction info if session was compacted
		const allEntries = this.ctx.sessionManager.getEntries();
		let compactionCount = 0;
		for (const entry of allEntries) {
			if (entry.type === "compaction") {
				compactionCount++;
			}
		}
		if (compactionCount > 0) {
			const times = compactionCount === 1 ? "1 time" : `${compactionCount} times`;
			this.ctx.showStatus(`Session compacted ${times}`);
		}
		if (preservedChatChildren && preservedChatChildren.length > 0) {
			for (const child of preservedChatChildren) {
				this.ctx.chatContainer.addChild(child);
			}
			this.ctx.ui.requestRender();
		}
	}

	clearEditor(): void {
		if (this.ctx.isBackgrounded) {
			return;
		}
		this.ctx.editor.setText("");
		this.ctx.pendingImages = [];
		this.ctx.ui.requestRender();
	}

	showError(errorMessage: string): void {
		if (this.ctx.isBackgrounded) {
			process.stderr.write(`Error: ${errorMessage}\n`);
			return;
		}
		this.ctx.chatContainer.addChild(new Spacer(1));
		this.ctx.chatContainer.addChild(new Text(theme.fg("error", `Error: ${errorMessage}`), 1, 0));
		this.ctx.ui.requestRender();
	}

	showWarning(warningMessage: string): void {
		if (this.ctx.isBackgrounded) {
			process.stderr.write(`Warning: ${warningMessage}\n`);
			return;
		}
		this.ctx.chatContainer.addChild(new Spacer(1));
		this.ctx.chatContainer.addChild(new Text(theme.fg("warning", `Warning: ${warningMessage}`), 1, 0));
		this.ctx.ui.requestRender();
	}

	showNewVersionNotification(newVersion: string): void {
		this.ctx.chatContainer.addChild(new Spacer(1));
		this.ctx.chatContainer.addChild(new DynamicBorder(text => theme.fg("warning", text)));
		this.ctx.chatContainer.addChild(
			new Text(
				theme.bold(theme.fg("warning", "Update Available")) +
					"\n" +
					theme.fg("muted", `New version ${newVersion} is available. Run: `) +
					theme.fg("accent", `${APP_NAME} update`),
				1,
				0,
			),
		);
		this.ctx.chatContainer.addChild(new DynamicBorder(text => theme.fg("warning", text)));
		this.ctx.ui.requestRender();
	}

	updatePendingMessagesDisplay(): void {
		this.ctx.pendingMessagesContainer.clear();
		const queuedMessages = this.ctx.session.getQueuedMessages() as QueuedMessages;

		const steeringMessages: Array<{ message: string; label: string }> = [];
		for (const message of queuedMessages.steering) {
			steeringMessages.push({ message, label: "Steer" });
		}
		for (const entry of this.ctx.compactionQueuedMessages as CompactionQueuedMessage[]) {
			if (entry.mode === "steer") {
				steeringMessages.push({ message: entry.text, label: "Steer" });
			}
		}

		const followUpMessages: Array<{ message: string; label: string }> = [];
		for (const message of queuedMessages.followUp) {
			followUpMessages.push({ message, label: "Follow-up" });
		}
		for (const entry of this.ctx.compactionQueuedMessages as CompactionQueuedMessage[]) {
			if (entry.mode === "followUp") {
				followUpMessages.push({ message: entry.text, label: "Follow-up" });
			}
		}

		const allMessages = [...steeringMessages, ...followUpMessages];
		if (allMessages.length > 0) {
			this.ctx.pendingMessagesContainer.addChild(new Spacer(1));
			for (const entry of allMessages) {
				const queuedText = theme.fg("dim", `${entry.label}: ${entry.message}`);
				this.ctx.pendingMessagesContainer.addChild(new TruncatedText(queuedText, 1, 0));
			}
			const dequeueKey = this.ctx.keybindings.getDisplayString("app.message.dequeue") || "Alt+Up";
			const hintText = theme.fg("dim", `${theme.tree.hook} ${dequeueKey} to edit`);
			this.ctx.pendingMessagesContainer.addChild(new TruncatedText(hintText, 1, 0));
		}
	}

	queueCompactionMessage(text: string, mode: "steer" | "followUp"): void {
		this.ctx.compactionQueuedMessages.push({ text, mode } as CompactionQueuedMessage);
		this.ctx.editor.addToHistory(text);
		this.ctx.editor.setText("");
		this.ctx.updatePendingMessagesDisplay();
		this.ctx.showStatus("Queued message for after compaction");
	}

	async #deliverQueuedMessage(message: CompactionQueuedMessage): Promise<void> {
		if (this.ctx.isKnownSlashCommand(message.text)) {
			await this.ctx.session.prompt(message.text);
			return;
		}
		await this.ctx.withLocalSubmission(message.text, () =>
			message.mode === "followUp" ? this.ctx.session.followUp(message.text) : this.ctx.session.steer(message.text),
		);
	}

	isKnownSlashCommand(text: string): boolean {
		if (!text.startsWith("/")) return false;
		const spaceIndex = text.indexOf(" ");
		const commandName = spaceIndex === -1 ? text.slice(1) : text.slice(1, spaceIndex);
		if (!commandName) return false;

		if (this.ctx.session.extensionRunner?.getCommand(commandName)) {
			return true;
		}

		for (const command of this.ctx.session.customCommands) {
			if (command.command.name === commandName) {
				return true;
			}
		}

		return this.ctx.fileSlashCommands.has(commandName);
	}

	async flushCompactionQueue(options?: { willRetry?: boolean }): Promise<void> {
		if (this.ctx.compactionQueuedMessages.length === 0) {
			return;
		}

		const queuedMessages = [...(this.ctx.compactionQueuedMessages as CompactionQueuedMessage[])];
		this.ctx.compactionQueuedMessages = [] as CompactionQueuedMessage[];
		this.ctx.updatePendingMessagesDisplay();

		const restoreQueue = (error: unknown) => {
			this.ctx.session.clearQueue();
			this.ctx.compactionQueuedMessages = queuedMessages;
			this.ctx.updatePendingMessagesDisplay();
			this.ctx.showError(
				`Failed to send queued message${queuedMessages.length > 1 ? "s" : ""}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		};

		try {
			if (options?.willRetry) {
				for (const message of queuedMessages) {
					await this.#deliverQueuedMessage(message);
				}
				this.ctx.updatePendingMessagesDisplay();
				return;
			}

			let firstPromptIndex = -1;
			for (let i = 0; i < queuedMessages.length; i++) {
				if (!this.ctx.isKnownSlashCommand(queuedMessages[i].text)) {
					firstPromptIndex = i;
					break;
				}
			}
			if (firstPromptIndex === -1) {
				for (const message of queuedMessages) {
					await this.ctx.session.prompt(message.text);
				}
				return;
			}

			const preCommands = queuedMessages.slice(0, firstPromptIndex);
			const firstPrompt = queuedMessages[firstPromptIndex];
			const rest = queuedMessages.slice(firstPromptIndex + 1);

			for (const message of preCommands) {
				// preCommands are all slash commands; #deliverQueuedMessage handles
				// that branch (no local-submission marking needed since slash
				// commands don't generate a matching user message_start).
				await this.#deliverQueuedMessage(message);
			}

			// Pass streamingBehavior so that if the session is still streaming when
			// compaction-end fires (race window between isStreaming flipping false and
			// the event landing here), prompt() routes the message into the steer/
			// follow-up queue instead of throwing AgentBusyError. When the session is
			// genuinely idle, streamingBehavior is ignored and a fresh prompt runs as
			// before. This keeps the steer preview honest: if delivery has to be
			// deferred, the message lands in the same queue every other consumer
			// (Alt+Up dequeue, post-stream drain) already drains, instead of being
			// stranded in compactionQueuedMessages with no drainer.
			//
			// firstPrompt is fire-and-forget — its rejection is funneled through
			// `restoreQueue` rather than rethrown, so we use the primitive
			// recordLocalSubmission and dispose manually in the catch.
			const disposeFirstPrompt = this.ctx.recordLocalSubmission(firstPrompt.text);
			this.ctx.prepareRealUserAgentPromptSubmission();
			const promptPromise = this.ctx.session
				.prompt(firstPrompt.text, {
					streamingBehavior: firstPrompt.mode === "followUp" ? "followUp" : "steer",
				})
				.catch((error: unknown) => {
					disposeFirstPrompt();
					restoreQueue(error);
				});

			for (const message of rest) {
				await this.#deliverQueuedMessage(message);
			}
			this.ctx.updatePendingMessagesDisplay();
			void promptPromise;
		} catch (error) {
			restoreQueue(error);
		}
	}

	/** Move pending bash components from pending area to chat */
	flushPendingBashComponents(): void {
		for (const component of this.ctx.pendingBashComponents) {
			this.ctx.pendingMessagesContainer.removeChild(component);
			this.ctx.chatContainer.addChild(component);
		}
		this.ctx.pendingBashComponents = [];
		for (const component of this.ctx.pendingPythonComponents) {
			this.ctx.pendingMessagesContainer.removeChild(component);
			this.ctx.chatContainer.addChild(component);
		}
		this.ctx.pendingPythonComponents = [];
	}

	findLastAssistantMessage(): AssistantMessage | undefined {
		for (let i = this.ctx.session.messages.length - 1; i >= 0; i--) {
			const message = this.ctx.session.messages[i];
			if (message?.role === "assistant") {
				return message as AssistantMessage;
			}
		}
		return undefined;
	}

	extractAssistantText(message: AssistantMessage): string {
		let text = "";
		for (const content of message.content) {
			if (content.type === "text") {
				text += content.text;
			}
		}
		return text.trim();
	}
}
