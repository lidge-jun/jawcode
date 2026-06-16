import { beforeAll, describe, expect, it } from "bun:test";
import { ComposerFooter } from "@jawcode-dev/coding-agent/modes/components/composer-footer";
import { InputController } from "@jawcode-dev/coding-agent/modes/controllers/input-controller";
import { getThemeByName, setThemeInstance } from "@jawcode-dev/coding-agent/modes/theme/theme";
import type { InteractiveModeContext } from "@jawcode-dev/coding-agent/modes/types";

beforeAll(async () => {
	const theme = await getThemeByName("red-claw");
	if (theme) setThemeInstance(theme);
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function renderText(footer: ComposerFooter, width = 80): string[] {
	return footer.render(width).map(line => Bun.stripANSI(line));
}

describe("ComposerFooter (99.20.06)", () => {
	it("always renders exactly one line while enabled — even with no content (083.7 row invariant)", () => {
		const footer = new ComposerFooter();
		expect(footer.render(80)).toEqual([""]);

		footer.setHint("? for shortcuts · /help for commands");
		expect(footer.render(80)).toHaveLength(1);

		footer.setTransient("press ctrl+c again to exit");
		expect(footer.render(80)).toHaveLength(1);

		footer.setMode("plan mode on");
		expect(footer.render(80)).toHaveLength(1);
	});

	it("renders zero lines when disabled (legacy frame byte-identical)", () => {
		const footer = new ComposerFooter();
		footer.setHint("? for shortcuts");
		footer.setTransient("press ctrl+c again to exit");
		footer.setEnabled(false);
		expect(footer.render(80)).toEqual([]);
	});

	it("resolves the priority stack: transient > mode > hint", () => {
		const footer = new ComposerFooter();
		footer.setHint("hint text");
		expect(renderText(footer)[0]).toContain("hint text");

		footer.setMode("mode text");
		expect(renderText(footer)[0]).toContain("mode text");

		footer.setTransient("transient text");
		expect(renderText(footer)[0]).toContain("transient text");

		footer.clearTransient();
		expect(renderText(footer)[0]).toContain("mode text");

		footer.setMode(undefined);
		expect(renderText(footer)[0]).toContain("hint text");
	});

	it("auto-expires the transient after durationMs and notifies the host", async () => {
		let renders = 0;
		const footer = new ComposerFooter(() => renders++);
		footer.setHint("idle hint");
		footer.setTransient("press esc again to exit", { durationMs: 30 });
		const rendersAfterSet = renders;
		expect(renderText(footer)[0]).toContain("press esc again to exit");

		await sleep(60);
		expect(renderText(footer)[0]).toContain("idle hint");
		expect(renders).toBeGreaterThan(rendersAfterSet);
	});

	it("latest transient wins and resets the expiry timer", async () => {
		const footer = new ComposerFooter();
		footer.setTransient("first", { durationMs: 40 });
		await sleep(25);
		footer.setTransient("second", { durationMs: 40 });
		await sleep(25); // first's original deadline has passed; second's has not
		expect(renderText(footer)[0]).toContain("second");
		await sleep(30);
		expect(renderText(footer)[0]).toBe("");
	});

	it("truncates to the terminal width", () => {
		const footer = new ComposerFooter();
		footer.setTransient("ctrl+c needs the English layout — switch to English (한/A) or press esc esc to exit");
		const [line] = renderText(footer, 24);
		expect(line).toBeDefined();
		expect(Bun.stringWidth(line!)).toBeLessThanOrEqual(24);
	});

	it("strips ANSI from notice text (sanitizeStatusText)", () => {
		const footer = new ComposerFooter();
		footer.setTransient("evil \x1b[31mred\x1b[0m text");
		// The component applies its own color; embedded sequences from the
		// message body must not survive into the plain content.
		expect(renderText(footer)[0]).toContain("evil red text");
	});

	it("dispose cancels the pending expiry timer", async () => {
		let renders = 0;
		const footer = new ComposerFooter(() => renders++);
		footer.setTransient("about to be disposed", { durationMs: 20 });
		const rendersAfterSet = renders;
		footer.dispose();
		await sleep(40);
		expect(renders).toBe(rendersAfterSet); // no post-dispose notification
		expect(renderText(footer)[0]).toBe("");
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Double-press exit wiring (99.20.06 W1/W2)
// ═══════════════════════════════════════════════════════════════════════════

function makeCtx(opts?: { footerEnabled?: boolean; editorText?: string }) {
	const footer = new ComposerFooter();
	footer.setEnabled(opts?.footerEnabled ?? true);
	const calls = { shutdown: 0, clearEditor: 0 };
	const ctx = {
		composerFooter: footer,
		lastSigintTime: 0,
		keybindings: { getKeys: (action: string) => (action === "app.clear" ? ["ctrl+c"] : ["ctrl+d"]) },
		editor: { getText: () => opts?.editorText ?? "" },
		shutdown: () => {
			calls.shutdown++;
			return Promise.resolve();
		},
		clearEditor: () => {
			calls.clearEditor++;
		},
	} as unknown as InteractiveModeContext;
	return { ctx, footer, calls };
}

describe("InputController double-press exit (99.20.06)", () => {
	it("ctrl+c: first press clears + arms notice; second within 800ms shuts down", () => {
		const { ctx, footer, calls } = makeCtx();
		const controller = new InputController(ctx);

		controller.handleCtrlC();
		expect(calls.clearEditor).toBe(1);
		expect(calls.shutdown).toBe(0);
		expect(renderText(footer)[0]).toContain("press ctrl+c again to exit");

		controller.handleCtrlC();
		expect(calls.shutdown).toBe(1);
		footer.dispose();
	});

	it("ctrl+c: window expiry re-arms instead of exiting", async () => {
		const { ctx, calls } = makeCtx();
		const controller = new InputController(ctx);

		controller.handleCtrlC();
		ctx.lastSigintTime = Date.now() - 1_000; // simulate the 800ms window passing
		controller.handleCtrlC();
		expect(calls.shutdown).toBe(0);
		expect(calls.clearEditor).toBe(2);
		ctx.composerFooter.dispose();
	});

	it("ctrl+d: double-press on an empty editor, no-op with text (CC guard)", () => {
		const withText = makeCtx({ editorText: "draft in progress" });
		new InputController(withText.ctx).handleCtrlD();
		expect(withText.calls.shutdown).toBe(0);
		expect(renderText(withText.footer)[0]).toBe("");
		withText.footer.dispose();

		const empty = makeCtx();
		const controller = new InputController(empty.ctx);
		controller.handleCtrlD();
		expect(empty.calls.shutdown).toBe(0);
		expect(renderText(empty.footer)[0]).toContain("press ctrl+d again to exit");
		controller.handleCtrlD();
		expect(empty.calls.shutdown).toBe(1);
		empty.footer.dispose();
	});

	it("ctrl+d: legacy single-press exit when the footer is disabled", () => {
		const { ctx, calls, footer } = makeCtx({ footerEnabled: false, editorText: "anything" });
		new InputController(ctx).handleCtrlD();
		expect(calls.shutdown).toBe(1);
		footer.dispose();
	});
});
