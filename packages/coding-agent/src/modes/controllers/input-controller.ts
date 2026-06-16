import * as fs from "node:fs/promises";
import * as path from "node:path";
import { type AgentMessage, ThinkingLevel } from "@jawcode-dev/agent-core";
import type { Message } from "@jawcode-dev/ai";
import type { AutocompleteProvider, OverlayHandle, SlashCommand } from "@jawcode-dev/tui";
import { $env, sanitizeText } from "@jawcode-dev/utils";
import { isSettingsInitialized, settings } from "../../config/settings";
import { resolveSubskillActivationForSkillInvocation } from "../../extensibility/jwc-plugins";
import { buildSkillPromptMessage, parseSkillInvocations } from "../../extensibility/skills";
import { expandEmoticons } from "../../modes/emoji-autocomplete";
import { createPromptActionAutocompleteProvider } from "../../modes/prompt-action-autocomplete";
import { theme } from "../../modes/theme/theme";
import type { InteractiveModeContext } from "../../modes/types";
import { commitFinalizedBacklog, isLiveToggleEligible } from "../../modes/utils/ui-helpers";
import type { AgentSessionEvent } from "../../session/agent-session";
import { SKILL_PROMPT_MESSAGE_TYPE, type SkillPromptDetails } from "../../session/messages";
import { executeBuiltinSlashCommand } from "../../slash-commands/builtin-registry";
import { copyToClipboard, readImageFromClipboard } from "../../utils/clipboard";
import { getEditorCommand, openInEditor } from "../../utils/external-editor";
import { ensureSupportedImageInput, ImageInputTooLargeError, loadImageInput } from "../../utils/image-loading";
import { resizeImage } from "../../utils/image-resize";
import { generateSessionTitle, setSessionTerminalTitle } from "../../utils/title-generator";
import { AssistantMessageComponent } from "../components/assistant-message";
import { FullTranscriptOverlayComponent } from "../components/full-transcript-overlay";
import { appKey } from "../components/keybinding-hints";
import { ToolExecutionComponent } from "../components/tool-execution";
import { ToolTranscriptOverlayComponent } from "../components/tool-transcript-overlay";
import { buildSessionTranscriptComponents } from "../utils/session-transcript-replay";

interface Expandable {
	setExpanded(expanded: boolean): void;
}

interface Minimizable {
	setMinimized(minimized: boolean): void;
}

function isCommittedComponent(item: unknown): boolean {
	return (
		typeof item === "object" &&
		item !== null &&
		"committed" in item &&
		(item as { committed?: unknown }).committed === true
	);
}

function uncommitted<T>(items: readonly T[]): T[] {
	return items.filter(item => !isCommittedComponent(item));
}

const INTERACTIVE_ABORT_CLEANUP_TIMEOUT_MS = 5_000;
// Hangul IME chord hint (devlog 082.1): hook-status key + how long the hint stays up.
const HANGUL_IME_HINT_KEY = "ime-hangul-chord";
const HANGUL_IME_HINT_DURATION_MS = 4_000;
// Double-press exit window — aligned with Claude Code's 800ms (devlog 99.20.06 W1).
const DOUBLE_PRESS_EXIT_WINDOW_MS = 800;
const CLIPBOARD_TEMP_IMAGE_FILE_PATTERN = /^clipboard-\d{4}-\d{2}-\d{2}-\d{6}-[A-Za-z0-9]+\.(?:png|jpe?g|gif|webp)$/i;
const MACOS_CLIPBOARD_TEMP_DIR_PATTERN = /^\/var\/folders\/[^/]+\/[^/]+\/T$/;

function isExpandable(obj: unknown): obj is Expandable {
	return typeof obj === "object" && obj !== null && "setExpanded" in obj && typeof obj.setExpanded === "function";
}

function isMinimizable(obj: unknown): obj is Minimizable {
	return typeof obj === "object" && obj !== null && "setMinimized" in obj && typeof obj.setMinimized === "function";
}

export class InputController {
	constructor(private ctx: InteractiveModeContext) {}

	/** Set after a first Esc silently consumes a queued steer. Kept until the
	 *  queued steer is either cancelled by a second Esc or drained by continuation,
	 *  so abort cleanup going idle cannot turn the second Esc into an idle action. */
	#steerConsumePending = false;

	/** Auto-clear timer for the transient Hangul IME chord hint. */
	#hangulImeHintTimer: NodeJS.Timeout | undefined;

	#abortInteractive(options?: { silent?: boolean }): Promise<void> {
		this.ctx.onUserInterrupt();
		return this.ctx.session.abort({
			timeoutMs: INTERACTIVE_ABORT_CLEANUP_TIMEOUT_MS,
			cause: "user_interrupt",
			silent: options?.silent,
		});
	}

	setupKeyHandlers(): void {
		this.ctx.editor.setActionKeys("app.interrupt", this.ctx.keybindings.getKeys("app.interrupt"));
		this.ctx.editor.shouldBypassAutocompleteOnEscape = () =>
			Boolean(
				this.ctx.loadingAnimation ||
					this.ctx.hasActiveBtw() ||
					(this.#steerConsumePending && this.ctx.session.hasQueuedSteering) ||
					this.ctx.session.isStreaming ||
					this.ctx.session.isCompacting ||
					this.ctx.session.isGeneratingHandoff ||
					this.ctx.session.isBashRunning ||
					this.ctx.session.isEvalRunning ||
					this.ctx.autoCompactionLoader ||
					this.ctx.retryLoader ||
					this.ctx.autoCompactionEscapeHandler ||
					this.ctx.retryEscapeHandler,
			);
		// An open btw panel must stay dismissable with Esc even while another
		// controller (auto-compaction, auto-retry, manual compaction, etc.) has
		// temporarily replaced editor.onEscape. This priority hook is never
		// swapped out, so it always wins for the interrupt key.
		this.ctx.editor.onInterruptPriority = () => (this.ctx.hasActiveBtw() ? this.ctx.handleBtwEscape() : false);
		this.ctx.editor.onEscape = () => {
			if (this.ctx.hasActiveBtw() && this.ctx.handleBtwEscape()) {
				return;
			}
			if (this.#steerConsumePending) {
				if (this.ctx.session.hasQueuedSteering) {
					// Second Esc before the scheduled steer continuation drains the
					// queue: restore/drop the queued steer and perform a real abort,
					// even if abort cleanup already made the session look idle.
					this.#steerConsumePending = false;
					this.restoreQueuedMessagesToEditor({ abort: true });
					return;
				}
				this.#steerConsumePending = false;
			}
			if (this.ctx.loadingAnimation) {
				if (this.ctx.cancelPendingSubmission()) {
					return;
				}
				this.restoreQueuedMessagesToEditor({ abort: true });
			} else if (this.ctx.session.isBashRunning) {
				this.ctx.session.abortBash();
			} else if (this.ctx.isBashMode) {
				this.ctx.editor.setText("");
				this.ctx.isBashMode = false;
				this.ctx.isBashNoContext = false;
				this.ctx.updateEditorBorderColor();
			} else if (this.ctx.session.isEvalRunning) {
				this.ctx.session.abortEval();
			} else if (this.ctx.isPythonMode) {
				this.ctx.editor.setText("");
				this.ctx.isPythonMode = false;
				this.ctx.updateEditorBorderColor();
			} else if (this.ctx.session.isStreaming) {
				if (this.ctx.session.hasQueuedSteering && !this.#steerConsumePending) {
					// First Esc with a queued steer: silently consume it and
					// auto-continue via steer-on-interrupt instead of stalling on
					// "Operation aborted".
					this.#steerConsumePending = true;
					void this.#abortInteractive({ silent: true });
				} else {
					void this.#abortInteractive();
				}
			} else if (!this.ctx.editor.getText().trim()) {
				// Double-interrupt with empty editor triggers /tree, /branch, or nothing based on setting
				const action = settings.get("doubleEscapeAction");
				if (action !== "none") {
					const now = Date.now();
					if (now - this.ctx.lastEscapeTime < 500) {
						if (action === "tree") {
							this.ctx.showTreeSelector();
						} else {
							this.ctx.showUserMessageSelector();
						}
						this.ctx.lastEscapeTime = 0;
					} else {
						this.ctx.lastEscapeTime = now;
					}
				}
			}
		};

		this.ctx.editor.setActionKeys("app.clear", this.ctx.keybindings.getKeys("app.clear"));
		this.ctx.editor.onClear = () => this.handleCtrlC();
		this.ctx.editor.setActionKeys("app.exit", this.ctx.keybindings.getKeys("app.exit"));
		this.ctx.editor.onExit = () => this.handleCtrlD();
		// Double-Escape safety net (082.1) keeps its guaranteed immediate exit —
		// decoupled from onExit, which is now a double-press chord (99.20.06 W2).
		this.ctx.editor.onForcedExit = () => void this.ctx.shutdown();
		this.ctx.editor.onExitPending = () => {
			// Quiet contexts only: while streaming/loading or inside transient UI,
			// the first Esc means interrupt/dismiss — an exit notice would mislead.
			if (
				this.ctx.session.isStreaming ||
				this.ctx.loadingAnimation ||
				this.ctx.hasActiveBtw() ||
				this.ctx.editor.isShowingAutocomplete()
			) {
				return;
			}
			this.#showExitPendingNotice("esc");
		};
		this.ctx.editor.setActionKeys("app.suspend", this.ctx.keybindings.getKeys("app.suspend"));
		this.ctx.editor.onSuspend = () => this.handleCtrlZ();
		this.ctx.editor.setActionKeys("app.thinking.cycle", this.ctx.keybindings.getKeys("app.thinking.cycle"));
		this.ctx.editor.onCycleThinkingLevel = () => this.cycleThinkingLevel();
		this.ctx.editor.setActionKeys("app.model.cycleForward", this.ctx.keybindings.getKeys("app.model.cycleForward"));
		this.ctx.editor.onCycleModelForward = () => this.cycleRoleModel();
		this.ctx.editor.setActionKeys("app.model.cycleBackward", this.ctx.keybindings.getKeys("app.model.cycleBackward"));
		this.ctx.editor.onCycleModelBackward = () => this.cycleRoleModel({ temporary: true });
		this.ctx.editor.setActionKeys(
			"app.model.selectTemporary",
			this.ctx.keybindings.getKeys("app.model.selectTemporary"),
		);
		this.ctx.editor.onSelectModelTemporary = () => this.ctx.showModelSelector({ temporaryOnly: true });

		// Global debug handler on TUI (works regardless of focus)
		this.ctx.ui.onDebug = () => this.ctx.showDebugSelector();
		this.ctx.editor.setActionKeys("app.model.select", this.ctx.keybindings.getKeys("app.model.select"));
		this.ctx.editor.onSelectModel = () => this.ctx.showModelSelector();
		this.ctx.editor.setActionKeys("app.history.search", this.ctx.keybindings.getKeys("app.history.search"));
		this.ctx.editor.onHistorySearch = () => this.ctx.showHistorySearch();
		this.ctx.editor.setActionKeys("app.thinking.toggle", this.ctx.keybindings.getKeys("app.thinking.toggle"));
		this.ctx.editor.onToggleThinking = () => this.ctx.toggleThinkingBlockVisibility();
		this.ctx.editor.setActionKeys("app.transcript.full", this.ctx.keybindings.getKeys("app.transcript.full"));
		this.ctx.editor.onFullTranscript = () => this.showFullTranscript();
		this.ctx.editor.setActionKeys("app.editor.external", this.ctx.keybindings.getKeys("app.editor.external"));
		this.ctx.editor.onExternalEditor = () => void this.openExternalEditor();
		this.ctx.editor.onShowHotkeys = () => this.ctx.handleHotkeysCommand();
		this.ctx.editor.setActionKeys(
			"app.clipboard.pasteImage",
			this.ctx.keybindings.getKeys("app.clipboard.pasteImage"),
		);
		this.ctx.editor.onPasteImage = () => this.handleImagePaste();
		this.ctx.editor.setActionKeys(
			"app.clipboard.copyPrompt",
			this.ctx.keybindings.getKeys("app.clipboard.copyPrompt"),
		);
		this.ctx.editor.onCopyPrompt = () => this.handleCopyPrompt();
		this.ctx.editor.onPasteText = text => this.handleTextPaste(text);
		this.ctx.editor.onPastePendingInputCleared = (reason, droppedInputCount) => {
			const reasonText = reason === "timeout" ? "timed out" : "exceeded the input queue limit";
			this.ctx.showWarning(
				`Paste handling ${reasonText}; discarded ${droppedInputCount} buffered input event${droppedInputCount === 1 ? "" : "s"}.`,
			);
		};
		this.ctx.editor.setActionKeys("app.tools.expand", this.ctx.keybindings.getKeys("app.tools.expand"));
		this.ctx.editor.onExpandTools = () => this.toggleToolOutputExpansion();
		this.ctx.editor.setActionKeys("app.message.dequeue", this.ctx.keybindings.getKeys("app.message.dequeue"));
		this.ctx.editor.onDequeue = () => this.handleDequeue();
		this.ctx.editor.onHangulCtrlChordHint = (_jamo, chord) => this.showHangulImeHint(chord);

		this.ctx.editor.clearCustomKeyHandlers();
		// Wire up extension shortcuts
		this.registerExtensionShortcuts();

		const planModeKeys = this.ctx.keybindings.getKeys("app.plan.toggle");
		for (const key of planModeKeys) {
			this.ctx.editor.setCustomKeyHandler(key, () => void this.ctx.handlePlanModeCommand());
		}

		for (const key of this.ctx.keybindings.getKeys("app.session.new")) {
			this.ctx.editor.setCustomKeyHandler(key, () => this.ctx.handleClearCommand());
		}
		for (const key of this.ctx.keybindings.getKeys("app.session.tree")) {
			this.ctx.editor.setCustomKeyHandler(key, () => this.ctx.showTreeSelector());
		}
		for (const key of this.ctx.keybindings.getKeys("app.session.fork")) {
			this.ctx.editor.setCustomKeyHandler(key, () => this.ctx.showUserMessageSelector());
		}
		for (const key of this.ctx.keybindings.getKeys("app.session.resume")) {
			this.ctx.editor.setCustomKeyHandler(key, () => this.ctx.showSessionSelector());
		}
		for (const key of this.ctx.keybindings.getKeys("app.message.followUp")) {
			this.ctx.editor.setCustomKeyHandler(key, () => void this.handleFollowUp());
		}
		for (const key of this.ctx.keybindings.getKeys("app.stt.toggle")) {
			this.ctx.editor.setCustomKeyHandler(key, () => void this.ctx.handleSTTToggle());
		}
		for (const key of this.ctx.keybindings.getKeys("app.clipboard.copyLine")) {
			this.ctx.editor.setCustomKeyHandler(key, () => this.handleCopyCurrentLine());
		}
		for (const key of this.ctx.keybindings.getKeys("app.session.observe")) {
			this.ctx.editor.setCustomKeyHandler(key, () => this.ctx.showSessionObserver());
		}
		for (const key of this.ctx.keybindings.getKeys("app.jobs.open")) {
			this.ctx.editor.setCustomKeyHandler(key, () => this.ctx.showJobsOverlay());
		}
		for (const key of this.ctx.keybindings.getKeys("app.background.expand")) {
			this.ctx.editor.setCustomKeyHandler(key, () => this.ctx.toggleBackgroundFooterPanel());
		}
		for (const key of this.ctx.keybindings.getKeys("app.tools.focus")) {
			this.ctx.editor.setCustomKeyHandler(key, () => this.enterOrMoveToolFocus());
		}
		for (const key of this.ctx.keybindings.getKeys("app.tools.transcript")) {
			this.ctx.editor.setCustomKeyHandler(key, () => this.showToolTranscript());
		}

		this.ctx.editor.onChange = (text: string) => {
			const wasBashMode = this.ctx.isBashMode;
			const wasBashNoContext = this.ctx.isBashNoContext;
			const wasPythonMode = this.ctx.isPythonMode;
			const trimmed = text.trimStart();
			this.ctx.isBashMode = trimmed.startsWith("!");
			this.ctx.isBashNoContext = trimmed.startsWith("!!");
			this.ctx.isPythonMode = trimmed.startsWith("$") && !trimmed.startsWith("${");
			if (
				wasBashMode !== this.ctx.isBashMode ||
				wasBashNoContext !== this.ctx.isBashNoContext ||
				wasPythonMode !== this.ctx.isPythonMode
			) {
				this.ctx.updateEditorBorderColor();
			}
		};
	}

	setupEditorSubmitHandler(): void {
		this.ctx.editor.onSubmit = async (text: string) => {
			text = text.trim();
			if ((!isSettingsInitialized() || settings.get("emojiAutocomplete")) && text) text = expandEmoticons(text);

			// Empty submit while streaming with queued messages: flush queues immediately
			if (!text && this.ctx.session.isStreaming && this.ctx.session.queuedMessageCount > 0) {
				// Abort current stream and let queued messages be processed
				await this.#abortInteractive();
				return;
			}

			if (!text) return;

			// Continue shortcuts: "." or "c" sends empty message (agent continues, no visible message)
			if (text === "." || text === "c") {
				if (this.ctx.onInputCallback) {
					this.ctx.editor.setText("");
					this.ctx.pendingImages = [];
					this.ctx.onInputCallback({ text: "", cancelled: false, started: true });
				}
				return;
			}

			const runner = this.ctx.session.extensionRunner;
			let inputImages = this.ctx.pendingImages.length > 0 ? [...this.ctx.pendingImages] : undefined;

			if (runner?.hasHandlers("input")) {
				const result = await runner.emitInput(text, inputImages, "interactive");
				if (result?.handled) {
					this.ctx.editor.setText("");
					this.ctx.pendingImages = [];
					return;
				}
				if (result?.text !== undefined) {
					text = result.text.trim();
				}
				if (result?.images !== undefined) {
					inputImages = result.images;
				}
			}

			if (!text) return;

			// Handle built-in slash commands
			const slashResult = await executeBuiltinSlashCommand(text, {
				ctx: this.ctx,
				handleBackgroundCommand: () => this.handleBackgroundCommand(),
			});
			if (slashResult === true) {
				// 083.7 §10: slash-only interactions never reach agent_end, so a
				// post-overflow gap (selector/dropdown transient growth) would
				// linger above the composer — compact here. No-op without a gap.
				this.ctx.ui.compactViewportFill();
				return;
			}
			if (typeof slashResult === "string") {
				// Command handled but returned remaining text to use as prompt
				text = slashResult;
			}

			// Handle skill commands (/skill:name [args]). While streaming, Enter
			// honors `busyPromptMode`: "steer" interrupts the active turn, "queue"
			// runs after it completes (matches the free-text Enter semantics applied
			// a few lines below at the streaming branch). Ctrl+Enter always routes
			// through `handleFollowUp` and dispatches the same helper with `"followUp"`.
			if (await this.#invokeSkillCommand(text, this.#busyStreamingBehavior())) {
				return;
			}

			// Handle bash command (! for normal, !! for excluded from context)
			if (text.startsWith("!")) {
				const isExcluded = text.startsWith("!!");
				const command = isExcluded ? text.slice(2).trim() : text.slice(1).trim();
				if (command) {
					if (this.ctx.session.isBashRunning) {
						this.ctx.showWarning("A bash command is already running. Press Esc to cancel it first.");
						this.ctx.editor.setText(text);
						return;
					}
					this.ctx.editor.addToHistory(text);
					await this.ctx.handleBashCommand(command, isExcluded);
					this.ctx.isBashMode = false;
					this.ctx.isBashNoContext = false;
					this.ctx.updateEditorBorderColor();
					return;
				}
			}

			// Handle python command ($ for normal, $$ for excluded from context)
			if (text.startsWith("$")) {
				const isExcluded = text.startsWith("$$");
				const code = isExcluded ? text.slice(2).trim() : text.slice(1).trim();
				if (code) {
					if (this.ctx.session.isEvalRunning) {
						this.ctx.showWarning("A Python execution is already running. Press Esc to cancel it first.");
						this.ctx.editor.setText(text);
						return;
					}
					this.ctx.editor.addToHistory(text);
					await this.ctx.handlePythonCommand(code, isExcluded);
					this.ctx.isPythonMode = false;
					this.ctx.updateEditorBorderColor();
					return;
				}
			}

			// Queue input during compaction
			if (this.ctx.session.isCompacting) {
				if (this.ctx.pendingImages.length > 0) {
					this.ctx.showStatus("Compaction in progress. Retry after it completes to send images.");
					return;
				}
				this.ctx.queueCompactionMessage(text, "steer");
				return;
			}

			// If streaming, use prompt() with the busy-prompt behavior the user
			// selected: "steer" interrupts the active turn, "queue" defers the
			// prompt to run after the active turn completes (in submission order).
			// This handles extension commands (execute immediately), prompt template expansion, and queueing
			if (this.ctx.session.isStreaming) {
				this.ctx.editor.addToHistory(text);
				this.ctx.editor.setText("");
				const images = inputImages && inputImages.length > 0 ? [...inputImages] : undefined;
				this.ctx.pendingImages = [];
				// Record the signature so the queued message's eventual delivery
				// (a user-role `message_start` event) leaves any draft the user has
				// typed since queuing intact. Same protection as #783, applied to
				// the streaming/queue path.
				const streamingBehavior = this.#busyStreamingBehavior();
				await this.ctx.withLocalSubmission(
					text,
					() => this.ctx.session.prompt(text, { streamingBehavior, images }),
					{ imageCount: images?.length ?? 0 },
				);
				this.ctx.updatePendingMessagesDisplay();
				this.ctx.ui.requestRender();
				return;
			}

			// Normal message submission
			// First, move any pending bash components to chat
			this.ctx.flushPendingBashComponents();

			// Generate session title on first message
			const hasUserMessages = this.ctx.session.messages.some((m: AgentMessage) => m.role === "user");
			if (!hasUserMessages && !this.ctx.sessionManager.getSessionName() && !$env.PI_NO_TITLE) {
				const registry = this.ctx.session.modelRegistry;
				generateSessionTitle(
					text,
					registry,
					this.ctx.settings,
					this.ctx.session.sessionId,
					this.ctx.session.model,
					provider => this.ctx.session.agent.metadataForProvider(provider),
				)
					.then(async title => {
						if (title) {
							const applied = await this.ctx.sessionManager.setSessionName(title, "auto");
							if (applied) {
								setSessionTerminalTitle(
									this.ctx.sessionManager.getSessionName()!,
									this.ctx.sessionManager.getCwd(),
								);
								this.ctx.updateEditorBorderColor();
							}
						}
					})
					.catch(() => {});
			}

			if (this.ctx.onInputCallback) {
				// Include any pending images from clipboard paste
				const images = inputImages && inputImages.length > 0 ? [...inputImages] : undefined;
				this.ctx.pendingImages = [];

				// 083.9 P4: turn boundary — the finished turn's components freeze
				// their pixels into the scrollback now (they stayed interactive
				// until this moment), then the gap compacts.
				commitFinalizedBacklog(this.ctx);
				// 083.8 S2: collapse any post-overflow gap left by the previous turn
				// HERE — the screen is about to change anyway (new user message), so
				// the full rebuild is invisible. Doing this at agent_end made the
				// final response visibly jump (devlog 083.8 ⑤).
				this.ctx.ui.compactViewportFill();
				// Render user message immediately, then let session events catch up
				const submission = this.ctx.startPendingSubmission({ text, images });

				this.ctx.onInputCallback(submission);
			}
			this.ctx.editor.addToHistory(text);
		};
	}

	/**
	 * Hangul IME chord hint (devlog 082.1): a Ctrl chord pressed under a Hangul
	 * IME arrives as a bare jamo on legacy terminals, so the shortcut silently
	 * does nothing. Surface a transient hint under the input instead of firing
	 * anything; it auto-clears shortly after.
	 */
	showHangulImeHint(chord: string): void {
		const text = `${chord} needs the English layout — switch to English (한/A) or press esc esc to exit`;
		// 99.20.06: the hint lives on the composer footer; the hook-status line
		// above the editor stays as the legacy surface when the footer is off.
		if (this.ctx.composerFooter?.isEnabled()) {
			this.ctx.composerFooter.setTransient(text, { durationMs: HANGUL_IME_HINT_DURATION_MS });
			return;
		}
		// Plain text: hook-status lines pass through sanitizeStatusText, which strips ANSI.
		this.ctx.statusLine.setHookStatus(HANGUL_IME_HINT_KEY, text);
		this.ctx.ui.requestRender();
		if (this.#hangulImeHintTimer) clearTimeout(this.#hangulImeHintTimer);
		this.#hangulImeHintTimer = setTimeout(() => {
			this.#hangulImeHintTimer = undefined;
			this.ctx.statusLine.setHookStatus(HANGUL_IME_HINT_KEY, undefined);
			this.ctx.ui.requestRender();
		}, HANGUL_IME_HINT_DURATION_MS);
		this.#hangulImeHintTimer.unref?.();
	}

	/** Footer notice for an armed double-press exit (devlog 99.20.06 §2.4). */
	#showExitPendingNotice(keyLabel: string): void {
		if (!this.ctx.composerFooter?.isEnabled()) return;
		this.ctx.composerFooter.setTransient(`press ${keyLabel} again to exit`, {
			durationMs: DOUBLE_PRESS_EXIT_WINDOW_MS,
		});
	}

	handleCtrlC(): void {
		if (this.ctx.goalModeEnabled && this.ctx.session?.isStreaming) {
			void this.#abortInteractive();
			return;
		}
		const now = Date.now();
		if (now - this.ctx.lastSigintTime < DOUBLE_PRESS_EXIT_WINDOW_MS) {
			void this.ctx.shutdown();
		} else {
			this.ctx.clearEditor();
			this.ctx.lastSigintTime = now;
			this.#showExitPendingNotice(appKey(this.ctx.keybindings, "app.clear"));
		}
	}

	/** Timestamp of the last exit-chord press while armed (99.20.06 W2 double-press). */
	#lastExitChordTime = 0;

	handleCtrlD(): void {
		// Legacy surface (footer off): single-press exit, unchanged — a silent
		// double-press requirement without the footer notice would be confusing.
		if (!this.ctx.composerFooter.isEnabled()) {
			void this.ctx.shutdown();
			return;
		}
		// CC parity (99.20.06 W2): the exit chord only acts on an empty editor;
		// with text present it is a no-op (drafts are still snapshotted by
		// shutdown() on the ctrl+c/esc paths).
		if (this.ctx.editor.getText().length > 0) {
			return;
		}
		const now = Date.now();
		if (now - this.#lastExitChordTime < DOUBLE_PRESS_EXIT_WINDOW_MS) {
			void this.ctx.shutdown();
		} else {
			this.#lastExitChordTime = now;
			this.#showExitPendingNotice(appKey(this.ctx.keybindings, "app.exit"));
		}
	}

	handleCtrlZ(): void {
		// Set up handler to restore TUI when resumed
		process.once("SIGCONT", () => {
			this.ctx.ui.start();
			this.ctx.ui.requestRender(true);
		});

		// Stop the TUI (restore terminal to normal mode)
		this.ctx.ui.stop();

		// Send SIGTSTP to process group (pid=0 means all processes in group)
		process.kill(0, "SIGTSTP");
	}

	handleDequeue(): void {
		const restored = this.restoreQueuedMessagesToEditor();
		if (restored === 0) {
			this.ctx.showStatus("No queued messages to restore");
		} else {
			this.ctx.showStatus(`Restored ${restored} queued message${restored > 1 ? "s" : ""} to editor`);
		}
	}

	/**
	 * Resolve how a prompt submitted while the agent is busy should be delivered.
	 * Driven by the `busyPromptMode` setting and kept distinct from the
	 * follow-up keybinding: "steer" interrupts the active turn, "queue" defers
	 * the prompt to the follow-up queue so it runs after the active turn
	 * completes (in submission order). Only consulted while streaming.
	 */
	#busyStreamingBehavior(): "steer" | "followUp" {
		return this.ctx.settings.get("busyPromptMode") === "queue" ? "followUp" : "steer";
	}

	/**
	 * Dispatch skill slash invocation(s) (`/skill:<name>`) through custom messages
	 * using the supplied `streamingBehavior`. Returns true if the text was a
	 * recognised skill command chain and was dispatched. A failure to load a skill
	 * file is surfaced via `showError` but still returns true — the editor was
	 * already cleared on the success path, so falling through to plain-text
	 * handling at that point would double-submit. Returns false when the text
	 * isn't a `/skill:` prefix or the command name isn't a registered skill,
	 * so the caller can fall through to plain-text handling (this branch
	 * leaves the editor state untouched). `streamingBehavior` is only consulted
	 * while the agent is streaming; the idle path of `promptCustomMessage`
	 * ignores it.
	 */
	async #invokeSkillCommand(text: string, streamingBehavior: "steer" | "followUp"): Promise<boolean> {
		if (!text.startsWith("/")) return false;
		const invocations = parseSkillInvocations(text, this.ctx.skillCommands ?? new Map());
		if (invocations.length === 0) return false;
		this.ctx.editor.addToHistory(text);
		this.ctx.editor.setText("");
		try {
			for (let index = 0; index < invocations.length; index += 1) {
				const invocation = invocations[index];
				if (!invocation) continue;
				const activationResult = await resolveSubskillActivationForSkillInvocation({
					cwd: this.ctx.sessionManager.getCwd(),
					sessionId: this.ctx.session.sessionId,
					skillName: invocation.skill.name,
					args: invocation.args,
				});
				const built = await buildSkillPromptMessage(invocation.skill, activationResult.cleanedArgs, {
					subskillActivation: activationResult.activation,
					subskillActivationSet: activationResult.activeSubskillsToPersist,
					cwd: this.ctx.sessionManager.getCwd(),
					sessionId: this.ctx.session.sessionId,
				});
				const details: SkillPromptDetails = built.details;
				const displayText = `/${invocation.commandName}${activationResult.cleanedArgs ? ` ${activationResult.cleanedArgs}` : ""}`;
				// When the agent is streaming, register a compact slash-form text as
				// the pending-display twin BEFORE dispatching the CustomMessage. The
				// returned tag is embedded in details so AgentSession.#handleAgentEvent
				// can remove the matching display entry when the agent consumes this
				// message (mirrors the user-message dequeue path).
				if (this.ctx.session.isStreaming) {
					const tag = this.ctx.session.enqueueCustomMessageDisplay(displayText, streamingBehavior);
					details.__pendingDisplayTag = tag;
				}
				const isLast = index === invocations.length - 1;
				if (!this.ctx.session.isStreaming && !isLast) {
					await this.ctx.session.sendCustomMessage({
						customType: SKILL_PROMPT_MESSAGE_TYPE,
						content: built.message,
						display: true,
						details,
						attribution: "user",
					});
					continue;
				}
				await this.ctx.session.promptCustomMessage(
					{
						customType: SKILL_PROMPT_MESSAGE_TYPE,
						content: built.message,
						display: true,
						details,
						attribution: "user",
					},
					{ streamingBehavior },
				);
			}
			if (this.ctx.session.isStreaming) {
				this.ctx.updatePendingMessagesDisplay();
				this.ctx.ui.requestRender();
			}
		} catch (err) {
			this.ctx.showError(`Failed to load skill: ${err instanceof Error ? err.message : String(err)}`);
		}
		return true;
	}

	/** Send editor text as a follow-up message (queued behind current stream). */
	async handleFollowUp(): Promise<void> {
		const text = this.ctx.editor.getText().trim();
		if (!text) return;

		// Compaction first: while compacting, free text gets queued via
		// `queueCompactionMessage`, and `/skill:*` rides the same queue so a
		// skill typed during compaction is not lost or short-circuited through
		// `promptCustomMessage`. The skill text is queued verbatim; whether
		// the queued entry is later re-parsed into a skill invocation is a
		// separate concern owned by the compaction-resume path.
		if (this.ctx.session.isCompacting) {
			this.ctx.queueCompactionMessage(text, "followUp");
			return;
		}

		// Skill commands invoke through the custom-message path regardless of
		// which keybinding submitted them. Enter routes them as `steer`;
		// Ctrl+Enter (this handler) routes them as `followUp`.
		if (await this.#invokeSkillCommand(text, "followUp")) {
			return;
		}

		if (this.ctx.session.isStreaming) {
			this.ctx.editor.addToHistory(text);
			this.ctx.editor.setText("");
			await this.ctx.withLocalSubmission(text, () =>
				this.ctx.session.prompt(text, { streamingBehavior: "followUp" }),
			);
			this.ctx.updatePendingMessagesDisplay();
			this.ctx.ui.requestRender();
			return;
		}

		// Not streaming — just submit normally
		this.ctx.editor.addToHistory(text);
		this.ctx.editor.setText("");
		await this.ctx.withLocalSubmission(text, () => this.ctx.session.prompt(text));
	}

	restoreQueuedMessagesToEditor(options?: { abort?: boolean; currentText?: string }): number {
		this.ctx.locallySubmittedUserSignatures.clear();
		const { steering, followUp } = this.ctx.session.clearQueue();
		const allQueued = [...steering, ...followUp];
		if (allQueued.length === 0) {
			this.ctx.updatePendingMessagesDisplay();
			if (options?.abort) {
				void this.#abortInteractive();
			}
			return 0;
		}
		const queuedText = allQueued.join("\n\n");
		const currentText = options?.currentText ?? this.ctx.editor.getText();
		const combinedText = [queuedText, currentText].filter(t => t.trim()).join("\n\n");
		this.ctx.editor.setText(combinedText);
		this.ctx.updatePendingMessagesDisplay();
		if (options?.abort) {
			void this.#abortInteractive();
		}
		return allQueued.length;
	}

	handleBackgroundCommand(): void {
		if (this.ctx.isBackgrounded) {
			this.ctx.showStatus("Background mode already enabled");
			return;
		}
		if (!this.ctx.session.isStreaming && this.ctx.session.queuedMessageCount === 0) {
			this.ctx.showWarning("Agent is idle; nothing to background");
			return;
		}
		if (this.ctx.hasActiveBtw()) {
			this.ctx.handleBtwEscape();
		}

		this.ctx.isBackgrounded = true;
		const backgroundUiContext = this.ctx.createBackgroundUiContext();

		// Background mode disables interactive UI so tools like ask fail fast.
		this.ctx.setToolUIContext(backgroundUiContext, false);
		this.ctx.initializeHookRunner(backgroundUiContext, false);

		if (this.ctx.loadingAnimation) {
			this.ctx.loadingAnimation.stop();
			this.ctx.loadingAnimation = undefined;
		}
		if (this.ctx.autoCompactionLoader) {
			this.ctx.autoCompactionLoader.stop();
			this.ctx.autoCompactionLoader = undefined;
			this.ctx.autoCompactionProgressPresenter?.stop();
			this.ctx.autoCompactionProgressPresenter = undefined;
		}
		if (this.ctx.retryLoader) {
			this.ctx.retryLoader.stop();
			this.ctx.retryLoader = undefined;
		}
		if (this.ctx.retryCountdownTimer) {
			clearInterval(this.ctx.retryCountdownTimer);
			this.ctx.retryCountdownTimer = undefined;
		}
		if (this.ctx.retryEscapeHandler) {
			this.ctx.editor.onEscape = this.ctx.retryEscapeHandler;
			this.ctx.retryEscapeHandler = undefined;
		}
		this.ctx.statusContainer.clear();
		this.ctx.statusLine.dispose();

		if (this.ctx.unsubscribe) {
			this.ctx.unsubscribe();
		}
		this.ctx.unsubscribe = this.ctx.session.subscribe(async (event: AgentSessionEvent) => {
			await this.ctx.handleBackgroundEvent(event);
		});

		// Backgrounding keeps the current process to preserve in-flight agent state.
		if (this.ctx.isInitialized) {
			this.ctx.ui.stop();
			this.ctx.isInitialized = false;
		}

		process.stdout.write("Background mode enabled. Run `bg` to continue in background.\n");

		if (process.platform === "win32" || !process.stdout.isTTY) {
			process.stdout.write("Backgrounding requires POSIX job control; continuing in foreground.\n");
			return;
		}

		process.kill(0, "SIGTSTP");
	}

	handleTextPaste(text: string): boolean | Promise<boolean> {
		const imagePath = this.#getPastedImagePathCandidate(text);
		return imagePath ? this.#attachPastedImagePath(imagePath) : false;
	}

	async #attachPastedImagePath(imagePath: string): Promise<boolean> {
		try {
			const image = await loadImageInput({
				path: imagePath,
				cwd: this.ctx.sessionManager.getCwd(),
				autoResize: this.ctx.settings.get("images.autoResize"),
			});
			if (!image) {
				this.ctx.showStatus("Unsupported pasted clipboard image file");
				return true;
			}

			this.ctx.pendingImages.push({
				type: "image",
				data: image.data,
				mimeType: image.mimeType,
			});
			this.ctx.editor.insertText(`${this.#nextImagePlaceholder()} `);
			this.ctx.showStatus(`Attached image: ${path.basename(image.resolvedPath)}`, { dim: true });
			this.ctx.ui.requestRender();
			return true;
		} catch (error) {
			if (error instanceof ImageInputTooLargeError) {
				this.ctx.showStatus(error.message);
				return true;
			}
			this.ctx.showStatus("Failed to attach pasted clipboard image");
			return true;
		}
	}

	#getPastedImagePathCandidate(text: string): string | undefined {
		const resolvedPath = path.resolve(text.trim());
		const parentDir = path.dirname(resolvedPath);
		const isClipboardTempPath =
			(parentDir === "/tmp" || MACOS_CLIPBOARD_TEMP_DIR_PATTERN.test(parentDir)) &&
			CLIPBOARD_TEMP_IMAGE_FILE_PATTERN.test(path.basename(resolvedPath));
		return isClipboardTempPath ? resolvedPath : undefined;
	}

	#nextImagePlaceholder(): string {
		return `[image ${this.ctx.pendingImages.length}]`;
	}

	async handleImagePaste(): Promise<boolean> {
		try {
			const image = await readImageFromClipboard();
			if (image) {
				const base64Data = image.data.toBase64();
				let imageData = await ensureSupportedImageInput({
					type: "image",
					data: base64Data,
					mimeType: image.mimeType,
				});
				if (!imageData) {
					this.ctx.showStatus(`Unsupported clipboard image format: ${image.mimeType}`);
					return false;
				}
				if (this.ctx.settings.get("images.autoResize")) {
					try {
						const resized = await resizeImage({
							type: "image",
							data: imageData.data,
							mimeType: imageData.mimeType,
						});
						imageData = { type: "image", data: resized.data, mimeType: resized.mimeType };
					} catch {
						// Keep the normalized image when resize fails.
					}
				}

				this.ctx.pendingImages.push({
					type: "image",
					data: imageData.data,
					mimeType: imageData.mimeType,
				});
				this.ctx.editor.insertText(`${this.#nextImagePlaceholder()} `);
				this.ctx.ui.requestRender();
				return true;
			}
			// No image in clipboard - show hint
			this.ctx.showStatus("No image in clipboard (use terminal paste for text)");
			return false;
		} catch {
			this.ctx.showStatus("Failed to read clipboard");
			return false;
		}
	}

	createAutocompleteProvider(commands: SlashCommand[], basePath: string): AutocompleteProvider {
		return createPromptActionAutocompleteProvider({
			commands,
			basePath,
			keybindings: this.ctx.keybindings,
			copyCurrentLine: () => this.handleCopyCurrentLine(),
			copyPrompt: () => this.handleCopyPrompt(),
			undo: prefix => this.ctx.editor.undoPastTransientText(prefix),
			moveCursorToMessageEnd: () => this.ctx.editor.moveToMessageEnd(),
			moveCursorToMessageStart: () => this.ctx.editor.moveToMessageStart(),
			moveCursorToLineStart: () => this.ctx.editor.moveToLineStart(),
			moveCursorToLineEnd: () => this.ctx.editor.moveToLineEnd(),
		});
	}

	/** Copy the current editor line to the system clipboard. */
	handleCopyCurrentLine(): void {
		const { line } = this.ctx.editor.getCursor();
		const text = this.ctx.editor.getLines()[line] || "";
		if (!text) {
			this.ctx.showStatus("Nothing to copy");
			return;
		}
		try {
			copyToClipboard(text);
			const sanitized = sanitizeText(text);
			const preview = sanitized.length > 30 ? `${sanitized.slice(0, 30)}...` : sanitized;
			this.ctx.showStatus(`Copied line: ${preview}`);
		} catch {
			this.ctx.showWarning("Failed to copy to clipboard");
		}
	}

	/** Copy current prompt text to system clipboard. */
	handleCopyPrompt(): void {
		const text = this.ctx.editor.getText();
		if (!text) {
			this.ctx.showStatus("Nothing to copy");
			return;
		}
		try {
			copyToClipboard(text);
			const sanitized = sanitizeText(text);
			const preview = sanitized.length > 30 ? `${sanitized.slice(0, 30)}...` : sanitized;
			this.ctx.showStatus(`Copied: ${preview}`);
		} catch {
			this.ctx.showWarning("Failed to copy to clipboard");
		}
	}

	cycleThinkingLevel(): void {
		const newLevel = this.ctx.session.cycleThinkingLevel();
		if (newLevel === undefined) {
			this.ctx.showStatus("Current model does not support thinking");
		} else {
			this.ctx.statusLine.invalidate();
			this.ctx.updateEditorBorderColor();
		}
	}

	async cycleRoleModel(options?: { temporary?: boolean }): Promise<void> {
		try {
			const cycleOrder = settings.get("cycleOrder");
			const result = await this.ctx.session.cycleRoleModels(cycleOrder, options);
			if (!result) {
				this.ctx.showStatus("Only one role model available");
				return;
			}

			this.ctx.statusLine.invalidate();
			this.ctx.updateEditorBorderColor();
			const roleLabel = result.role === "default" ? "default" : result.role;
			const roleLabelStyled = theme.bold(theme.fg("accent", roleLabel));
			const thinkingStr =
				result.model.thinking && result.thinkingLevel !== ThinkingLevel.Off
					? ` (thinking: ${result.thinkingLevel})`
					: "";
			const tempLabel = options?.temporary ? " (temporary)" : "";
			const cycleSeparator = theme.fg("dim", " > ");
			const cycleLabel = cycleOrder
				.map(role => {
					if (role === result.role) {
						return theme.bold(theme.fg("accent", role));
					}
					return theme.fg("muted", role);
				})
				.join(cycleSeparator);
			const orderLabel = ` (cycle: ${cycleLabel})`;
			this.ctx.showStatus(
				`Switched to ${roleLabelStyled}: ${result.model.name || result.model.id}${thinkingStr}${tempLabel}${orderLabel}`,
				{ dim: false },
			);
		} catch (error) {
			this.ctx.showError(error instanceof Error ? error.message : String(error));
		}
	}

	#backgroundFooterHandlers:
		| {
				prevInterruptPriority: (() => boolean) | undefined;
		  }
		| undefined;

	installBackgroundFooterPanelHandlers(): boolean {
		if (this.#toolFocus) {
			this.ctx.showStatus("Exit tool focus before opening background panel");
			return false;
		}
		if (this.#backgroundFooterHandlers) return true;
		const editor = this.ctx.editor;
		const prevInterruptPriority = editor.onInterruptPriority;
		this.#backgroundFooterHandlers = { prevInterruptPriority };
		editor.setCustomKeyHandler("up", () => {
			if (editor.getText().trim()) return false; // let editor handle if typing
			return this.ctx.handleBackgroundFooterPanelKey("up");
		});
		editor.setCustomKeyHandler("down", () => {
			if (editor.getText().trim()) return false;
			return this.ctx.handleBackgroundFooterPanelKey("down");
		});
		editor.setCustomKeyHandler("enter", () => {
			if (editor.getText().trim()) {
				// User typed something — collapse panel, remove handlers, let editor re-process Enter
				this.ctx.handleBackgroundFooterPanelKey("escape");
				// Panel handlers are now removed; re-dispatch Enter to the editor's normal path
				editor.handleInput("\n");
				return;
			}
			this.ctx.handleBackgroundFooterPanelKey("enter");
		});
		editor.onInterruptPriority = () => {
			if (this.ctx.isBackgroundFooterDetailOpen()) {
				this.ctx.closeBackgroundFooterDetail();
				return true;
			}
			if (this.ctx.handleBackgroundFooterPanelKey("escape")) {
				return true;
			}
			return prevInterruptPriority?.() ?? false;
		};
		return true;
	}

	removeBackgroundFooterPanelHandlers(): void {
		const handlers = this.#backgroundFooterHandlers;
		if (!handlers) return;
		this.#backgroundFooterHandlers = undefined;
		const editor = this.ctx.editor;
		editor.removeCustomKeyHandler("up");
		editor.removeCustomKeyHandler("down");
		editor.removeCustomKeyHandler("enter");
		editor.onInterruptPriority = handlers.prevInterruptPriority;
	}
	// =========================================================================
	// Tool focus mode (083.1 pattern B): ctrl+up enters / moves up, ↑↓ navigate,
	// enter toggles the focused tool's expansion, esc or typing exits.
	// =========================================================================

	#toolFocus:
		| {
				tools: ToolExecutionComponent[];
				index: number;
				prevOnChange: ((text: string) => void) | undefined;
				prevInterruptPriority: (() => boolean) | undefined;
		  }
		| undefined;

	enterOrMoveToolFocus(): void {
		if (this.#toolFocus) {
			this.#moveToolFocus(-1);
			return;
		}
		const tools = this.ctx.chatContainer.children.filter(
			(child): child is ToolExecutionComponent => !child.committed && child instanceof ToolExecutionComponent,
		);
		if (tools.length === 0) {
			this.ctx.showStatus("No tool blocks to focus");
			return;
		}
		const editor = this.ctx.editor;
		const prevOnChange = editor.onChange;
		this.#toolFocus = {
			tools,
			index: tools.length - 1,
			prevOnChange,
			prevInterruptPriority: editor.onInterruptPriority,
		};
		// Esc exits focus mode before any other interrupt handling (btw-panel pattern).
		editor.onInterruptPriority = () => {
			this.#exitToolFocus();
			return true;
		};
		// Typing drops focus so the prompt stays fluent.
		editor.onChange = (text: string) => {
			this.#exitToolFocus();
			prevOnChange?.(text);
		};
		editor.setCustomKeyHandler("up", () => this.#moveToolFocus(-1));
		editor.setCustomKeyHandler("down", () => this.#moveToolFocus(1));
		editor.setCustomKeyHandler("enter", () => this.#toggleFocusedTool());
		tools[this.#toolFocus.index].setFocused(true);
		this.ctx.showStatus("tool focus: ↑↓ move · enter open/close · esc exit");
		this.ctx.ui.requestRender();
	}

	#exitToolFocus(): void {
		const focus = this.#toolFocus;
		if (!focus) return;
		this.#toolFocus = undefined;
		focus.tools[focus.index]?.setFocused(false);
		const editor = this.ctx.editor;
		editor.removeCustomKeyHandler("up");
		editor.removeCustomKeyHandler("down");
		editor.removeCustomKeyHandler("enter");
		editor.onChange = focus.prevOnChange;
		editor.onInterruptPriority = focus.prevInterruptPriority;
		this.ctx.ui.requestRender();
	}

	#moveToolFocus(delta: number): void {
		const focus = this.#toolFocus;
		if (!focus) return;
		const next = focus.index + delta;
		if (next < 0 || next >= focus.tools.length) return;
		focus.tools[focus.index].setFocused(false);
		focus.index = next;
		focus.tools[next].setFocused(true);
		this.ctx.ui.requestRender();
	}

	#toggleFocusedTool(): void {
		const focus = this.#toolFocus;
		if (!focus) return;
		const tool = focus.tools[focus.index];
		tool.setExpanded(!tool.expanded);
		this.ctx.ui.requestRender();
	}

	/** 083.1 pattern A: full tool transcript in a scrollable overlay (alt+t). */
	showToolTranscript(): void {
		this.#exitToolFocus();
		const tools = this.ctx.chatContainer.children.filter(
			(child): child is ToolExecutionComponent => child instanceof ToolExecutionComponent,
		);
		if (tools.length === 0) {
			this.ctx.showStatus("No tool blocks to show");
			return;
		}
		const close = () => {
			this.ctx.editorContainer.clear();
			this.ctx.editorContainer.addChild(this.ctx.editor);
			this.ctx.ui.setFocus(this.ctx.editor);
			this.ctx.ui.requestRender();
		};
		const overlay = new ToolTranscriptOverlayComponent(tools, {
			close,
			requestRender: () => this.ctx.ui.requestRender(),
		});
		this.ctx.editorContainer.clear();
		this.ctx.editorContainer.addChild(overlay);
		this.ctx.ui.setFocus(overlay.getFocus());
		this.ctx.ui.requestRender();
	}

	showFullTranscript(): void {
		this.#exitToolFocus();
		const liveToolItems = uncommitted([...this.ctx.liveToolContainer.children]);
		const componentItems = [...this.ctx.chatContainer.children, ...liveToolItems];
		if (this.ctx.streamingComponent && !componentItems.includes(this.ctx.streamingComponent)) {
			componentItems.push(this.ctx.streamingComponent);
		}
		const sessionContext = this.ctx.session.buildDisplaySessionContext();
		const historicalItems =
			sessionContext.messages.length > 0
				? buildSessionTranscriptComponents(
						sessionContext,
						{
							ui: this.ctx.ui,
							cwd: this.ctx.sessionManager.getCwd(),
							hideThinkingBlock: this.ctx.hideThinkingBlock,
							toolOutputExpanded: this.ctx.toolOutputExpanded,
							retryAttempt: this.ctx.session.retryAttempt,
							getToolByName: name => this.ctx.session.getToolByName(name),
							getUserMessageText: message => this.ctx.getUserMessageText(message as Message),
							getMessageRenderer: customType => this.ctx.session.extensionRunner?.getMessageRenderer(customType),
							requestRender: () => this.ctx.ui.requestRender(),
							showImages: this.ctx.settings.get("terminal.showImages"),
							readToolResultPreview: true,
							editFuzzyThreshold: this.ctx.settings.get("edit.fuzzyThreshold"),
							editAllowFuzzy: this.ctx.settings.get("edit.fuzzyMatch"),
							hashlineAutoDropPureInsertDuplicates: this.ctx.settings.get(
								"edit.hashlineAutoDropPureInsertDuplicates",
							),
						},
						{ mode: "transcript" },
					)
				: [];
		const sessionLiveItems: typeof componentItems =
			sessionContext.messages.length > 0
				? [
						// Session replay already rebuilds chatContainer history/current completed
						// chat from persisted messages. Appending live chat components here
						// duplicates exactly the ctrl+o-eligible range at the bottom, hiding
						// the expanded historical replay above it. Only append truly
						// out-of-band live surfaces, plus a chat fallback when replay yields no
						// renderable history (e.g. hidden-only display context).
						...(historicalItems.length === 0
							? uncommitted(this.ctx.chatContainer.children.filter(isLiveToggleEligible))
							: []),
						...liveToolItems,
						...(this.ctx.streamingComponent && !isCommittedComponent(this.ctx.streamingComponent)
							? [this.ctx.streamingComponent]
							: []),
					]
				: [];
		if (componentItems.length === 0 && sessionContext.messages.length === 0) {
			this.ctx.showStatus("No transcript to show");
			return;
		}
		const source =
			sessionContext.messages.length > 0
				? {
						kind: "session" as const,
						historicalItems,
						liveItems: sessionLiveItems,
						itemCount: historicalItems.length + sessionLiveItems.length,
					}
				: { kind: "components" as const, items: componentItems };
		let overlayHandle: OverlayHandle | undefined;
		const close = () => {
			overlayHandle?.hide();
			overlayHandle = undefined;
		};
		const overlay = new FullTranscriptOverlayComponent(source, {
			close,
			requestRender: () => this.ctx.ui.requestRender(),
		});
		overlayHandle = this.ctx.ui.showOverlay(overlay, {
			anchor: "bottom-center",
			width: "100%",
			maxHeight: "100%",
			margin: 0,
		});
		this.ctx.ui.setFocus(overlay.getFocus());
	}

	toggleToolOutputExpansion(): void {
		// ctrl+o toggles the current live turn only. Historical/rebuilt transcript
		// components are intentionally ineligible because committed scrollback pixels
		// cannot be made globally reversible.
		const expanded = !this.ctx.toolOutputExpanded;
		this.ctx.thinkingExpanded = expanded;
		this.setToolsExpanded(expanded);
		// 083.7 §10 / 99.20.03 표면 7: bulk collapse shrinks the frame in the
		// overflow zone — compact the gap right away (user-initiated, jump ok).
		this.ctx.ui.compactViewportFill();
		this.ctx.showStatus(`Current turn output: ${expanded ? "expanded" : "collapsed"}`);
	}

	#currentTurnToggleTargets(): unknown[] {
		const start = Math.max(0, Math.min(this.ctx.currentTurnStartIndex, this.ctx.chatContainer.children.length));
		const targets = new Set<unknown>();
		for (const child of this.ctx.chatContainer.children.slice(start)) {
			targets.add(child);
		}
		for (const child of this.ctx.liveToolContainer.children) {
			targets.add(child);
		}
		if (this.ctx.streamingComponent) targets.add(this.ctx.streamingComponent);
		return [...targets];
	}

	setToolsExpanded(expanded: boolean): void {
		this.ctx.toolOutputExpanded = expanded;
		const activeTools = new Set<unknown>(this.ctx.pendingTools.values());
		const liveTools = new Set<unknown>(this.ctx.liveToolContainer.children);
		for (const child of this.#currentTurnToggleTargets()) {
			if (isExpandable(child)) {
				child.setExpanded(expanded);
			}
			if (!expanded && isMinimizable(child) && !activeTools.has(child) && !liveTools.has(child)) {
				child.setMinimized(true);
			}
		}
		this.ctx.streamingComponent?.setThinkingExpanded(expanded);
		this.ctx.ui.requestRender(!expanded, expanded ? "tools expand" : "tools collapse");
	}

	toggleThinkingBlockVisibility(): void {
		// Legacy escape hatch: if thinking blocks were fully hidden via the
		// hideThinkingBlock setting, the first custom thinking-toggle press brings
		// them back as collapsed summaries instead of toggling a state the user
		// cannot see.
		if (this.ctx.hideThinkingBlock) {
			this.ctx.hideThinkingBlock = false;
			settings.set("hideThinkingBlock", false);
			this.ctx.session.agent.hideThinkingSummary = false;
			this.ctx.thinkingExpanded = false;
			this.ctx.chatContainer.clear();
			this.ctx.rebuildChatFromMessages();
			if (this.ctx.streamingComponent && this.ctx.streamingMessage) {
				this.ctx.streamingComponent.setHideThinkingBlock(false);
				this.ctx.streamingComponent.updateContent(this.ctx.streamingMessage);
				this.ctx.chatContainer.addChild(this.ctx.streamingComponent);
			}
			this.ctx.showStatus("Thinking blocks: collapsed");
			return;
		}

		// Custom-binding compatibility only: the default ctrl+t mapping opens the
		// full transcript overlay. Use the same live eligibility boundary as ctrl+o.
		const expanded = !this.ctx.thinkingExpanded;
		this.ctx.thinkingExpanded = expanded;
		for (const child of this.ctx.chatContainer.children) {
			if (!isLiveToggleEligible(child)) continue;
			if (child instanceof AssistantMessageComponent) {
				child.setThinkingExpanded(expanded);
			}
		}
		this.ctx.streamingComponent?.setThinkingExpanded(expanded);
		this.ctx.ui.requestRender();
		// 083.7 §10 / 99.20.03 표면 7: same as ctrl+o — clear the collapse gap.
		this.ctx.ui.compactViewportFill();
		this.ctx.showStatus(`Thinking blocks: ${expanded ? "expanded" : "collapsed"}`);
	}

	#getEditorTerminalPath(): string | null {
		if (process.platform === "win32") {
			return null;
		}
		return "/dev/tty";
	}

	async #openEditorTerminalHandle(): Promise<fs.FileHandle | null> {
		const terminalPath = this.#getEditorTerminalPath();
		if (!terminalPath) {
			return null;
		}
		try {
			return await fs.open(terminalPath, "r+");
		} catch {
			return null;
		}
	}

	async openExternalEditor(): Promise<void> {
		const editorCmd = getEditorCommand();
		if (!editorCmd) {
			this.ctx.showWarning("No editor configured. Set $VISUAL or $EDITOR environment variable.");
			return;
		}

		const currentText = this.ctx.editor.getExpandedText?.() ?? this.ctx.editor.getText();

		let ttyHandle: fs.FileHandle | null = null;
		try {
			ttyHandle = await this.#openEditorTerminalHandle();
			this.ctx.ui.stop();

			const stdio: [number | "inherit", number | "inherit", number | "inherit"] = ttyHandle
				? [ttyHandle.fd, ttyHandle.fd, ttyHandle.fd]
				: ["inherit", "inherit", "inherit"];

			const result = await openInEditor(editorCmd, currentText, { extension: ".jwc.md", stdio });
			if (result !== null) {
				this.ctx.editor.setText(result);
			}
		} catch (error) {
			this.ctx.showWarning(
				`Failed to open external editor: ${error instanceof Error ? error.message : String(error)}`,
			);
		} finally {
			if (ttyHandle) {
				await ttyHandle.close();
			}

			this.ctx.ui.start();
			this.ctx.ui.requestRender();
		}
	}

	registerExtensionShortcuts(): void {
		const runner = this.ctx.session.extensionRunner;
		if (!runner) return;

		const shortcuts = runner.getShortcuts();
		for (const [keyId, shortcut] of shortcuts) {
			this.ctx.editor.setCustomKeyHandler(keyId, () => {
				const ctx = runner.createCommandContext();
				try {
					shortcut.handler(ctx);
				} catch (err) {
					runner.emitError({
						extensionPath: shortcut.extensionPath,
						event: "shortcut",
						error: err instanceof Error ? err.message : String(err),
						stack: err instanceof Error ? err.stack : undefined,
					});
				}
			});
		}
	}
}
