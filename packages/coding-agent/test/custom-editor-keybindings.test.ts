import { afterEach, describe, expect, it, vi } from "bun:test";
import { setKittyProtocolActive } from "@gajae-code/tui";
import { defaultEditorTheme } from "../../tui/test/test-themes";
import { CustomEditor } from "../src/modes/components/custom-editor";

function ctrl(key: string): string {
	return String.fromCharCode(key.toLowerCase().charCodeAt(0) & 31);
}

function createEditor() {
	return new CustomEditor(defaultEditorTheme);
}

afterEach(() => {
	vi.useRealTimers();
});

describe("CustomEditor temporary model selector keybinding", () => {
	it("triggers the temporary selector from a remapped action key instead of Alt+P", () => {
		const editor = createEditor();
		const onSelectModelTemporary = vi.fn();
		editor.onSelectModelTemporary = onSelectModelTemporary;
		editor.setActionKeys("app.model.selectTemporary", ["ctrl+y"]);

		editor.handleInput(ctrl("y"));
		expect(onSelectModelTemporary).toHaveBeenCalledTimes(1);

		editor.handleInput("\x1bp");
		expect(onSelectModelTemporary).toHaveBeenCalledTimes(1);
	});

	it("removes the default Alt+P shortcut when the action is disabled", () => {
		const editor = createEditor();
		const onSelectModelTemporary = vi.fn();
		editor.onSelectModelTemporary = onSelectModelTemporary;

		editor.handleInput("\x1bp");
		expect(onSelectModelTemporary).toHaveBeenCalledTimes(1);

		editor.setActionKeys("app.model.selectTemporary", []);
		editor.handleInput("\x1bp");
		expect(onSelectModelTemporary).toHaveBeenCalledTimes(1);
	});
});

describe("CustomEditor transcript keybinding priority", () => {
	it("prefers full transcript over legacy thinking toggle when both bind ctrl+t", () => {
		const editor = createEditor();
		const onFullTranscript = vi.fn();
		const onToggleThinking = vi.fn();
		editor.onFullTranscript = onFullTranscript;
		editor.onToggleThinking = onToggleThinking;
		editor.setActionKeys("app.transcript.full", ["ctrl+t"]);
		editor.setActionKeys("app.thinking.toggle", ["ctrl+t"]);

		editor.handleInput(ctrl("t"));

		expect(onFullTranscript).toHaveBeenCalledTimes(1);
		expect(onToggleThinking).toHaveBeenCalledTimes(0);
	});
});

describe("CustomEditor double-Escape exit safety net", () => {
	const ESC = "\x1b";

	it("exits on a second Escape within the window (IME-independent escape hatch)", () => {
		const editor = createEditor();
		const onExit = vi.fn();
		const onEscape = vi.fn();
		editor.onExit = onExit;
		editor.onEscape = onEscape;

		editor.handleInput(ESC); // first Escape: normal interrupt/dismiss, no exit
		expect(onExit).toHaveBeenCalledTimes(0);
		expect(onEscape).toHaveBeenCalledTimes(1);

		editor.handleInput(ESC); // second Escape within window: exits
		expect(onExit).toHaveBeenCalledTimes(1);
		// The exiting Escape is consumed and must not also fire interrupt again.
		expect(onEscape).toHaveBeenCalledTimes(1);
	});

	it("does not exit on a single Escape", () => {
		const editor = createEditor();
		const onExit = vi.fn();
		editor.onExit = onExit;

		editor.handleInput(ESC);
		expect(onExit).toHaveBeenCalledTimes(0);
	});

	it("resets the double-Escape tracker when a non-Escape key is pressed in between", () => {
		const editor = createEditor();
		const onExit = vi.fn();
		editor.onExit = onExit;

		editor.handleInput(ESC);
		editor.handleInput("a");
		editor.handleInput(ESC);
		expect(onExit).toHaveBeenCalledTimes(0);
	});

	it("exits after the window lapses between Escapes", () => {
		vi.useFakeTimers();
		const editor = createEditor();
		const onExit = vi.fn();
		editor.onExit = onExit;

		editor.handleInput(ESC);
		vi.advanceTimersByTime(900); // beyond the 800ms window (99.20.06 W1)
		editor.handleInput(ESC);
		expect(onExit).toHaveBeenCalledTimes(0); // treated as a fresh first Escape
	});

	it("prefers onForcedExit over onExit for the net's immediate exit (99.20.06 W2 decoupling)", () => {
		const editor = createEditor();
		const onExit = vi.fn();
		const onForcedExit = vi.fn();
		editor.onExit = onExit;
		editor.onForcedExit = onForcedExit;

		editor.handleInput(ESC);
		editor.handleInput(ESC);
		expect(onForcedExit).toHaveBeenCalledTimes(1);
		expect(onExit).toHaveBeenCalledTimes(0); // chord handler (double-press) must not fire
	});

	it("fires onExitPending when the first Escape arms the net (99.20.06 footer notice)", () => {
		const editor = createEditor();
		const onExitPending = vi.fn();
		editor.onForcedExit = vi.fn();
		editor.onExitPending = onExitPending;

		editor.handleInput(ESC);
		expect(onExitPending).toHaveBeenCalledTimes(1);

		editor.handleInput(ESC); // exiting press does not re-arm
		expect(onExitPending).toHaveBeenCalledTimes(1);
	});
});

describe("CustomEditor Hangul IME Ctrl-chord hint", () => {
	// The hint is deferred so a follow-up keystroke can cancel it; tests must
	// wait out the window before asserting it fired.
	const HINT_DEFER_WAIT_MS = 300;

	it("hints on an isolated bare jamo sitting on a bound Ctrl key without firing the action", async () => {
		const editor = createEditor();
		const onClear = vi.fn();
		const onHint = vi.fn();
		editor.onClear = onClear;
		editor.onHangulCtrlChordHint = onHint;

		editor.handleInput("ㅊ"); // dubeolsik position of "c" → ctrl+c (app.clear)
		await Bun.sleep(HINT_DEFER_WAIT_MS);

		expect(onClear).toHaveBeenCalledTimes(0); // never misfires the action
		expect(onHint).toHaveBeenCalledWith("ㅊ", "ctrl+c");
		expect(editor.getText()).toBe("ㅊ"); // jamo still inserted as ordinary text
	});

	it("hints for the exit chord position (ㅇ → ctrl+d)", async () => {
		const editor = createEditor();
		const onExit = vi.fn();
		const onHint = vi.fn();
		editor.onExit = onExit;
		editor.onHangulCtrlChordHint = onHint;

		editor.handleInput("ㅇ");
		await Bun.sleep(HINT_DEFER_WAIT_MS);

		expect(onExit).toHaveBeenCalledTimes(0);
		expect(onHint).toHaveBeenCalledWith("ㅇ", "ctrl+d");
	});

	it("follows remapped action keys", async () => {
		const editor = createEditor();
		const onHint = vi.fn();
		editor.onHangulCtrlChordHint = onHint;
		editor.setActionKeys("app.model.selectTemporary", ["ctrl+y"]);

		editor.handleInput("ㅛ"); // dubeolsik position of "y"
		await Bun.sleep(HINT_DEFER_WAIT_MS);

		expect(onHint).toHaveBeenCalledWith("ㅛ", "ctrl+y");
	});

	it("stays silent for jamo on unbound keys, syllables, latin letters, and multi-char chunks", async () => {
		const editor = createEditor();
		const onHint = vi.fn();
		editor.onHangulCtrlChordHint = onHint;

		editor.handleInput("ㅏ"); // "k" position — no ctrl+k binding by default
		editor.handleInput("차"); // composed syllable, not a bare jamo
		editor.handleInput("c"); // plain latin letter
		editor.handleInput("ㅊㅏ"); // multi-char chunk (committed composition)
		await Bun.sleep(HINT_DEFER_WAIT_MS);

		expect(onHint).toHaveBeenCalledTimes(0);
	});

	it("suppresses the hint when the jamo arrives mid-typing (preceding keystroke)", async () => {
		const editor = createEditor();
		const onHint = vi.fn();
		editor.onHangulCtrlChordHint = onHint;

		editor.handleInput("차"); // recent keystroke → next jamo is not isolated
		editor.handleInput("ㅊ");
		await Bun.sleep(HINT_DEFER_WAIT_MS);

		expect(onHint).toHaveBeenCalledTimes(0);
	});

	it("cancels a pending hint when a follow-up keystroke arrives", async () => {
		const editor = createEditor();
		const onHint = vi.fn();
		editor.onHangulCtrlChordHint = onHint;

		editor.handleInput("ㅊ"); // isolated → hint scheduled
		editor.handleInput("ㅏ"); // follow-up within the defer window → typing
		await Bun.sleep(HINT_DEFER_WAIT_MS);

		expect(onHint).toHaveBeenCalledTimes(0);
	});

	it("never hints when the Kitty keyboard protocol is active (real chords already match)", async () => {
		setKittyProtocolActive(true);
		try {
			const editor = createEditor();
			const onHint = vi.fn();
			editor.onHangulCtrlChordHint = onHint;

			editor.handleInput("ㅊ");
			await Bun.sleep(HINT_DEFER_WAIT_MS);

			expect(onHint).toHaveBeenCalledTimes(0);
		} finally {
			setKittyProtocolActive(false);
		}
	});
});

describe("CustomEditor bracketed paste interception", () => {
	it("lets coding-agent consume pasted content before the base editor stores it", async () => {
		const editor = createEditor();
		const onPasteText = vi.fn(() => true);
		editor.onPasteText = onPasteText;

		editor.handleInput("\x1b[200~/tmp/clipboard-2026-06-04-120441-CAC144E7.png\x1b[201~");
		await Bun.sleep(0);

		expect(onPasteText).toHaveBeenCalledWith("/tmp/clipboard-2026-06-04-120441-CAC144E7.png");
		expect(editor.getText()).toBe("");
	});

	it("falls back to normal paste handling when coding-agent does not consume it", async () => {
		const editor = createEditor();
		const onPasteText = vi.fn(() => false);
		editor.onPasteText = onPasteText;

		editor.handleInput("\x1b[200~hello\x1b[201~");
		await Bun.sleep(0);

		expect(onPasteText).toHaveBeenCalledWith("hello");
		expect(editor.getText()).toBe("hello");
	});

	it("keeps later input behind a pending async consumed paste", async () => {
		const editor = createEditor();
		const pasteDecision = Promise.withResolvers<boolean>();
		editor.onPasteText = vi.fn(() => pasteDecision.promise);

		editor.handleInput("before ");
		editor.handleInput("\x1b[200~/tmp/clipboard-2026-06-04-120441-CAC144E7.png\x1b[201~");
		editor.handleInput("after");

		expect(editor.getText()).toBe("before ");

		pasteDecision.resolve(true);
		await Bun.sleep(0);

		expect(editor.getText()).toBe("before after");
	});

	it("replays async unconsumed paste before later input", async () => {
		const editor = createEditor();
		const pasteDecision = Promise.withResolvers<boolean>();
		editor.onPasteText = vi.fn(() => pasteDecision.promise);

		editor.handleInput("before ");
		editor.handleInput("\x1b[200~middle \x1b[201~");
		editor.handleInput("after");

		expect(editor.getText()).toBe("before ");

		pasteDecision.resolve(false);
		await Bun.sleep(0);

		expect(editor.getText()).toBe("before middle after");
	});

	it("drops queued input and ignores late async paste decisions after timeout", async () => {
		vi.useFakeTimers();
		const editor = createEditor();
		const pasteDecision = Promise.withResolvers<boolean>();
		const onPastePendingInputCleared = vi.fn();
		editor.onPasteText = vi.fn(() => pasteDecision.promise);
		editor.onPastePendingInputCleared = onPastePendingInputCleared;

		editor.handleInput("before ");
		editor.handleInput("\x1b[200~middle \x1b[201~");
		editor.handleInput("after");

		expect(editor.getText()).toBe("before ");

		vi.advanceTimersByTime(5_000);
		expect(onPastePendingInputCleared).toHaveBeenCalledWith("timeout", 1);

		pasteDecision.resolve(false);
		await Promise.resolve();

		expect(editor.getText()).toBe("before ");
	});

	it("bounds the async paste input queue and clears pending state", async () => {
		const editor = createEditor();
		const pasteDecision = Promise.withResolvers<boolean>();
		const onPastePendingInputCleared = vi.fn();
		editor.onPasteText = vi.fn(() => pasteDecision.promise);
		editor.onPastePendingInputCleared = onPastePendingInputCleared;

		editor.handleInput("before ");
		editor.handleInput("\x1b[200~middle \x1b[201~");
		for (let index = 0; index < 65; index += 1) {
			editor.handleInput(`queued-${index} `);
		}

		expect(onPastePendingInputCleared).toHaveBeenCalledWith("queue-limit", 65);
		expect(editor.getText()).toBe("before ");

		pasteDecision.resolve(false);
		await Bun.sleep(0);

		expect(editor.getText()).toBe("before ");
	});

	it("clears pending async paste state when disposed", async () => {
		const editor = createEditor();
		const pasteDecision = Promise.withResolvers<boolean>();
		editor.onPasteText = vi.fn(() => pasteDecision.promise);

		editor.handleInput("before ");
		editor.handleInput("\x1b[200~middle \x1b[201~");
		editor.handleInput("after");
		editor.dispose();

		pasteDecision.resolve(false);
		await Bun.sleep(0);

		expect(editor.getText()).toBe("before ");
	});
});
