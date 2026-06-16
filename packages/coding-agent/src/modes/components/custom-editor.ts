import { Editor, isKittyProtocolActive, type KeyId, matchesKey, parseKittySequence } from "@gajae-code/tui";
import { BracketedPasteHandler } from "@gajae-code/tui/bracketed-paste";
import type { AppKeybinding } from "../../config/keybindings";

type ConfigurableEditorAction = Extract<
	AppKeybinding,
	| "app.interrupt"
	| "app.clear"
	| "app.exit"
	| "app.suspend"
	| "app.thinking.cycle"
	| "app.model.cycleForward"
	| "app.model.cycleBackward"
	| "app.model.select"
	| "app.model.selectTemporary"
	| "app.tools.expand"
	| "app.thinking.toggle"
	| "app.transcript.full"
	| "app.editor.external"
	| "app.history.search"
	| "app.message.dequeue"
	| "app.clipboard.pasteImage"
	| "app.clipboard.copyPrompt"
>;

const DEFAULT_ACTION_KEYS: Record<ConfigurableEditorAction, KeyId[]> = {
	"app.interrupt": ["escape"],
	"app.clear": ["ctrl+c"],
	"app.exit": ["ctrl+d"],
	"app.suspend": ["ctrl+z"],
	"app.thinking.cycle": ["shift+tab"],
	"app.model.cycleForward": ["ctrl+p"],
	"app.model.cycleBackward": ["shift+ctrl+p"],
	"app.model.select": ["ctrl+l"],
	"app.model.selectTemporary": ["alt+p"],
	"app.tools.expand": ["ctrl+o"],
	"app.thinking.toggle": [],
	"app.transcript.full": ["ctrl+t"],
	"app.editor.external": ["ctrl+g"],
	"app.history.search": ["ctrl+r"],
	"app.message.dequeue": ["alt+up"],
	"app.clipboard.pasteImage": ["ctrl+v"],
	"app.clipboard.copyPrompt": ["alt+shift+c"],
};

const PASTE_DECISION_TIMEOUT_MS = 5_000;
const PENDING_PASTE_INPUT_MAX = 64;
// Two Escapes within this window trigger the IME-independent exit safety net.
// 800ms aligns with Claude Code's double-press window (devlog 99.20.06 W1).
const DOUBLE_ESCAPE_EXIT_WINDOW_MS = 800;

// A bare jamo only counts as a swallowed Ctrl chord when it arrives ISOLATED:
// nothing typed in the preceding window (mid-word Hangul typing produces a
// steady keystroke stream) and nothing in the following window (the deferred
// hint is cancelled by any further input). A chord attempt is a lone keypress;
// ordinary typing is not.
const HANGUL_HINT_ISOLATION_MS = 400;
const HANGUL_HINT_DEFER_MS = 250;

// Dubeolsik (two-set) Hangul layout: compatibility jamo → the QWERTY key on the
// same physical position. Used to detect a likely Ctrl-chord attempt while the
// Hangul IME is active: legacy terminals deliver Ctrl+ㅊ as the bare jamo (no
// control byte), so the chord can never match — but we can recognize the jamo
// sitting on a bound Ctrl key and surface a hint instead of silently inserting
// text. Detection only — the action is never fired from a bare jamo, because a
// bare jamo is indistinguishable from ordinary Hangul typing (devlog 082.1).
const DUBEOLSIK_JAMO_TO_QWERTY: Record<string, string> = {
	ㅂ: "q",
	ㅃ: "q",
	ㅈ: "w",
	ㅉ: "w",
	ㄷ: "e",
	ㄸ: "e",
	ㄱ: "r",
	ㄲ: "r",
	ㅅ: "t",
	ㅆ: "t",
	ㅛ: "y",
	ㅕ: "u",
	ㅑ: "i",
	ㅐ: "o",
	ㅒ: "o",
	ㅔ: "p",
	ㅖ: "p",
	ㅁ: "a",
	ㄴ: "s",
	ㅇ: "d",
	ㄹ: "f",
	ㅎ: "g",
	ㅗ: "h",
	ㅓ: "j",
	ㅏ: "k",
	ㅣ: "l",
	ㅋ: "z",
	ㅌ: "x",
	ㅊ: "c",
	ㅍ: "v",
	ㅠ: "b",
	ㅜ: "n",
	ㅡ: "m",
};

type PastePendingClearReason = "timeout" | "queue-limit";

/**
 * Custom editor that handles configurable app-level shortcuts for coding-agent.
 */
export class CustomEditor extends Editor {
	onEscape?: () => void;
	/**
	 * Optional high-priority interrupt consumer. Invoked when the interrupt key
	 * is pressed, before `onEscape`. Returning `true` consumes the keystroke.
	 * Used so a transient UI (e.g. the btw panel) stays dismissable even while
	 * another controller has temporarily installed its own `onEscape` handler.
	 */
	onInterruptPriority?: () => boolean;
	shouldBypassAutocompleteOnEscape?: () => boolean;
	onClear?: () => void;
	onExit?: () => void;
	/**
	 * Immediate-exit consumer for the double-Escape safety net (082.1). Kept
	 * separate from `onExit` so the configured exit chord (ctrl+d) can adopt
	 * double-press semantics (99.20.06 W2) without breaking the net's
	 * guaranteed single-step exit. Falls back to `onExit` when unset.
	 */
	onForcedExit?: () => void;
	/**
	 * Fired when the first Escape arms the double-press exit net (99.20.06).
	 * Advisory only — the host may surface a "press esc again to exit" notice.
	 */
	onExitPending?: () => void;
	onCycleThinkingLevel?: () => void;
	onCycleModelForward?: () => void;
	onCycleModelBackward?: () => void;
	onSelectModel?: () => void;
	onExpandTools?: () => void;
	onToggleThinking?: () => void;
	onFullTranscript?: () => void;
	onExternalEditor?: () => void;
	onHistorySearch?: () => void;
	onSuspend?: () => void;
	onShowHotkeys?: () => void;
	onSelectModelTemporary?: () => void;
	/** Called when the configured copy-prompt shortcut is pressed. */
	onCopyPrompt?: () => void;
	/** Called when the configured image-paste shortcut is pressed. */
	onPasteImage?: () => Promise<boolean>;
	/** Called before bracketed paste content is inserted. Return true to consume it. */
	onPasteText?: (text: string) => boolean | Promise<boolean>;
	/** Called when async paste handling drops queued input instead of replaying it. */
	onPastePendingInputCleared?: (reason: PastePendingClearReason, droppedInputCount: number) => void;
	/** Called when the configured dequeue shortcut is pressed. */
	onDequeue?: () => void;
	/** Called when Caps Lock is pressed. */
	onCapsLock?: () => void;
	/**
	 * Called when a bare Hangul jamo arrives on a key position that has a Ctrl
	 * chord bound (e.g. ㅊ on the ctrl+c key while the Hangul IME is active).
	 * The chord is NOT fired — the jamo is still inserted as text — this is a
	 * hint hook only (devlog 082.1: bare jamo ≡ ordinary Hangul typing).
	 */
	onHangulCtrlChordHint?: (jamo: string, chord: KeyId) => void;

	/** Custom key handlers from extensions and non-built-in app actions. */
	#customKeyHandlers = new Map<KeyId, () => void>();
	#actionKeys = new Map<ConfigurableEditorAction, KeyId[]>(
		Object.entries(DEFAULT_ACTION_KEYS).map(([action, keys]) => [action as ConfigurableEditorAction, [...keys]]),
	);
	#pasteHandler = new BracketedPasteHandler();
	/** Timestamp of the last lone-Escape press, for the double-Escape exit safety net. */
	#lastEscapeAt = 0;
	#lastInputAt = 0;
	#hangulHintTimer: NodeJS.Timeout | undefined;
	#pasteDecisionPending = false;
	#pasteDecisionToken = 0;
	#pasteDecisionTimeout: NodeJS.Timeout | undefined;
	#pendingPasteInput: string[] = [];

	setActionKeys(action: ConfigurableEditorAction, keys: KeyId[]): void {
		this.#actionKeys.set(action, [...keys]);
	}

	#matchesAction(data: string, action: ConfigurableEditorAction): boolean {
		const keys = this.#actionKeys.get(action);
		if (!keys) return false;
		for (const key of keys) {
			if (matchesKey(data, key)) return true;
		}
		return false;
	}

	/**
	 * If `data` is a single bare Hangul jamo whose dubeolsik key position has a
	 * Ctrl chord bound (action keys or extension shortcuts), return that chord.
	 */
	#hangulCtrlChordFor(data: string): KeyId | undefined {
		if (data.length !== 1) return undefined;
		const letter = DUBEOLSIK_JAMO_TO_QWERTY[data];
		if (!letter) return undefined;
		const isCtrlChordOnLetter = (key: KeyId): boolean => {
			const parts = key.split("+");
			return parts.includes("ctrl") && parts[parts.length - 1] === letter;
		};
		for (const keys of this.#actionKeys.values()) {
			const match = keys.find(isCtrlChordOnLetter);
			if (match) return match;
		}
		for (const key of this.#customKeyHandlers.keys()) {
			if (isCtrlChordOnLetter(key)) return key;
		}
		return undefined;
	}

	/**
	 * Register a custom key handler. Extensions use this for shortcuts.
	 */
	setCustomKeyHandler(key: KeyId, handler: () => void): void {
		this.#customKeyHandlers.set(key, handler);
	}

	/**
	 * Remove a custom key handler.
	 */
	removeCustomKeyHandler(key: KeyId): void {
		this.#customKeyHandlers.delete(key);
	}

	/**
	 * Clear all custom key handlers.
	 */
	clearCustomKeyHandlers(): void {
		this.#customKeyHandlers.clear();
	}

	#clearPasteDecisionTimeout(): void {
		if (this.#pasteDecisionTimeout) {
			clearTimeout(this.#pasteDecisionTimeout);
			this.#pasteDecisionTimeout = undefined;
		}
	}

	#clearPendingPasteState(): number {
		this.#clearPasteDecisionTimeout();
		this.#pasteDecisionPending = false;
		this.#pasteDecisionToken += 1;
		const droppedInputCount = this.#pendingPasteInput.length;
		this.#pendingPasteInput = [];
		return droppedInputCount;
	}

	#startPasteDecisionTimeout(token: number): void {
		this.#clearPasteDecisionTimeout();
		this.#pasteDecisionTimeout = setTimeout(() => {
			if (token !== this.#pasteDecisionToken) return;
			const droppedInputCount = this.#clearPendingPasteState();
			this.onPastePendingInputCleared?.("timeout", droppedInputCount);
		}, PASTE_DECISION_TIMEOUT_MS);
		this.#pasteDecisionTimeout.unref?.();
	}

	dispose(): void {
		this.#clearPendingPasteState();
		this.#pasteHandler = new BracketedPasteHandler();
	}

	#drainPendingPasteInput(initialInput?: string): void {
		if (initialInput && initialInput.length > 0) {
			this.handleInput(initialInput);
		}
		while (!this.#pasteDecisionPending) {
			const nextInput = this.#pendingPasteInput.shift();
			if (nextInput === undefined) break;
			this.handleInput(nextInput);
		}
	}

	#handleBracketedPaste(pasteContent: string, remaining: string): void {
		const applyPasteResult = (token: number, handled: boolean | undefined) => {
			if (token !== this.#pasteDecisionToken) return;
			this.#clearPasteDecisionTimeout();
			if (!handled) {
				super.handleInput(`\x1b[200~${pasteContent}\x1b[201~`);
			}
			this.#pasteDecisionPending = false;
			this.#drainPendingPasteInput(remaining);
		};
		const pasteResult = this.onPasteText?.(pasteContent);

		if (pasteResult instanceof Promise) {
			const token = this.#pasteDecisionToken + 1;
			this.#pasteDecisionToken = token;
			this.#pasteDecisionPending = true;
			this.#startPasteDecisionTimeout(token);
			void pasteResult.then(
				handled => applyPasteResult(token, handled),
				() => applyPasteResult(token, false),
			);
		} else {
			applyPasteResult(this.#pasteDecisionToken, pasteResult);
		}
	}

	handleInput(data: string): void {
		// Any further keystroke means a pending jamo hint was ordinary typing,
		// not a swallowed chord — cancel it before it surfaces.
		if (this.#hangulHintTimer) {
			clearTimeout(this.#hangulHintTimer);
			this.#hangulHintTimer = undefined;
		}
		const prevInputAt = this.#lastInputAt;
		this.#lastInputAt = Date.now();

		if (this.#pasteDecisionPending) {
			this.#pendingPasteInput.push(data);
			if (this.#pendingPasteInput.length > PENDING_PASTE_INPUT_MAX) {
				const droppedInputCount = this.#clearPendingPasteState();
				this.onPastePendingInputCleared?.("queue-limit", droppedInputCount);
			}
			return;
		}

		const parsed = parseKittySequence(data);
		if (parsed && (parsed.modifier & 64) !== 0 && this.onCapsLock) {
			// Caps Lock is modifier bit 64
			this.onCapsLock();
			return;
		}

		if (this.onPasteText) {
			const paste = this.#pasteHandler.process(data);
			if (paste.handled) {
				if (paste.pasteContent !== undefined) {
					this.#handleBracketedPaste(paste.pasteContent, paste.remaining);
				}
				return;
			}
		}
		// Intercept configured image paste (async - fires and handles result)
		if (this.#matchesAction(data, "app.clipboard.pasteImage") && this.onPasteImage) {
			void this.onPasteImage();
			return;
		}

		// Intercept configured external editor shortcut
		if (this.#matchesAction(data, "app.editor.external") && this.onExternalEditor) {
			this.onExternalEditor();
			return;
		}

		// Intercept configured temporary model selector shortcut
		if (this.#matchesAction(data, "app.model.selectTemporary") && this.onSelectModelTemporary) {
			this.onSelectModelTemporary();
			return;
		}

		// Intercept configured suspend shortcut
		if (this.#matchesAction(data, "app.suspend") && this.onSuspend) {
			this.onSuspend();
			return;
		}

		// Intercept configured full transcript shortcut before legacy thinking toggles.
		if (this.#matchesAction(data, "app.transcript.full") && this.onFullTranscript) {
			this.onFullTranscript();
			return;
		}
		// Intercept configured thinking block visibility toggle
		if (this.#matchesAction(data, "app.thinking.toggle") && this.onToggleThinking) {
			this.onToggleThinking();
			return;
		}

		// Intercept configured model selector shortcut
		if (this.#matchesAction(data, "app.model.select") && this.onSelectModel) {
			this.onSelectModel();
			return;
		}

		// Intercept configured history search shortcut
		if (this.#matchesAction(data, "app.history.search") && this.onHistorySearch) {
			this.onHistorySearch();
			return;
		}

		// Intercept configured tool output expansion shortcut
		if (this.#matchesAction(data, "app.tools.expand") && this.onExpandTools) {
			this.onExpandTools();
			return;
		}

		// Intercept configured backward model cycling (check before forward cycling)
		if (this.#matchesAction(data, "app.model.cycleBackward") && this.onCycleModelBackward) {
			this.onCycleModelBackward();
			return;
		}

		// Intercept configured forward model cycling
		if (this.#matchesAction(data, "app.model.cycleForward") && this.onCycleModelForward) {
			this.onCycleModelForward();
			return;
		}

		// Intercept configured thinking level cycling
		if (this.#matchesAction(data, "app.thinking.cycle") && this.onCycleThinkingLevel) {
			this.onCycleThinkingLevel();
			return;
		}

		// IME-independent exit safety net (devlog 082.1): Escape is always 0x1b
		// regardless of the active input source, so a double-press is a guaranteed
		// way out even when Ctrl chords (ctrl+c / ctrl+d) are swallowed by a Hangul
		// IME on legacy terminals. The first Escape keeps its normal interrupt/dismiss
		// behavior below; only the second within the window exits.
		if (matchesKey(data, "escape")) {
			const now = Date.now();
			const exitNow = this.onForcedExit ?? this.onExit;
			if (this.#lastEscapeAt !== 0 && now - this.#lastEscapeAt <= DOUBLE_ESCAPE_EXIT_WINDOW_MS && exitNow) {
				this.#lastEscapeAt = 0;
				exitNow();
				return;
			}
			this.#lastEscapeAt = now;
			this.onExitPending?.();
		} else {
			this.#lastEscapeAt = 0;
		}

		// Intercept configured interrupt shortcut.
		// Default behavior keeps autocomplete dismissal, but parent can prioritize global interrupt handling.
		if (this.#matchesAction(data, "app.interrupt")) {
			if (!this.isShowingAutocomplete() || this.shouldBypassAutocompleteOnEscape?.()) {
				// A priority interrupt consumer (e.g. an open btw panel) must win over any
				// transient onEscape handler other controllers install (auto-compaction,
				// auto-retry, manual compaction, etc.) so dismissal stays wired regardless
				// of which handler currently owns onEscape.
				if (this.onInterruptPriority?.()) {
					return;
				}
				if (this.onEscape) {
					this.onEscape();
					return;
				}
			}
		}

		// Intercept configured clear shortcut
		if (this.#matchesAction(data, "app.clear") && this.onClear) {
			this.onClear();
			return;
		}

		// Intercept configured exit shortcut. Always consume the shortcut so it
		// never reaches the parent handler; firing onExit is the controller's
		// chance to snapshot the current text as a draft before shutting down.
		if (this.#matchesAction(data, "app.exit")) {
			this.onExit?.();
			return;
		}

		// Intercept configured dequeue shortcut (restore queued message to editor)
		if (this.#matchesAction(data, "app.message.dequeue") && this.onDequeue) {
			this.onDequeue();
			return;
		}

		// Intercept configured copy-prompt shortcut
		if (this.#matchesAction(data, "app.clipboard.copyPrompt") && this.onCopyPrompt) {
			this.onCopyPrompt();
			return;
		}

		// Intercept ? when editor is empty to show hotkeys
		if (data === "?" && this.getText().length === 0 && this.onShowHotkeys) {
			this.onShowHotkeys();
			return;
		}

		// Check custom key handlers (extensions)
		for (const [keyId, handler] of this.#customKeyHandlers) {
			if (matchesKey(data, keyId)) {
				handler();
				return;
			}
		}

		// Hangul IME chord hint (devlog 082.1): a bare jamo landing on a bound
		// Ctrl key position is likely a swallowed Ctrl chord (legacy terminals
		// strip the modifier under a Hangul IME). Never fire the action — a bare
		// jamo is indistinguishable from ordinary Hangul typing — but let the
		// parent surface a "switch to English / esc" hint. The jamo still falls
		// through and is inserted as text.
		//
		// Kitty-protocol terminals don't need the heuristic at all: flag 4
		// (report alternate keys) delivers Ctrl+ㅊ as CSI-u with the base-layout
		// key, so the real ctrl+c chord already matched above.
		//
		// On legacy terminals, only an ISOLATED jamo qualifies: a quiet window
		// before it (see prevInputAt) and a deferred fire that any follow-up
		// keystroke cancels — mid-sentence Hangul typing never surfaces the hint.
		if (this.onHangulCtrlChordHint && !isKittyProtocolActive()) {
			const chord = this.#hangulCtrlChordFor(data);
			if (chord && this.#lastInputAt - prevInputAt > HANGUL_HINT_ISOLATION_MS) {
				const surfaceHint = this.onHangulCtrlChordHint;
				this.#hangulHintTimer = setTimeout(() => {
					this.#hangulHintTimer = undefined;
					surfaceHint(data, chord);
				}, HANGUL_HINT_DEFER_MS);
				this.#hangulHintTimer.unref?.();
			}
		}

		// Pass to parent for normal handling
		super.handleInput(data);
	}
}
