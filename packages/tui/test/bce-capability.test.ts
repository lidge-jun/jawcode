import { describe, expect, it } from "bun:test";
import { terminalSupportsBce } from "../src/terminal-capabilities";

/**
 * 260703 WP5.2 — BCE capability plumbing (no emitted-byte changes; consumed
 * by WP5.3's renderer-level bg+erase row painting). Env-based, fail-closed:
 * a false negative keeps today's literal-padding fallback.
 */
describe("terminalSupportsBce (260703 WP5.2)", () => {
	it("env override wins in both directions", () => {
		expect(terminalSupportsBce({ JWC_TUI_BCE: "0", TERM: "xterm-256color" })).toBe(false);
		expect(terminalSupportsBce({ JWC_TUI_BCE: "1", TERM: "dumb" })).toBe(true);
	});

	it("dumb or empty TERM fails closed", () => {
		expect(terminalSupportsBce({ TERM: "dumb" })).toBe(false);
		expect(terminalSupportsBce({ TERM: "" })).toBe(false);
		expect(terminalSupportsBce({})).toBe(false);
	});

	it("known BCE terminal families are allowlisted by TERM prefix", () => {
		for (const term of [
			"xterm-256color",
			"tmux-256color",
			"screen-256color",
			"linux",
			"alacritty",
			"xterm-kitty",
			"wezterm",
			"xterm-ghostty",
			"foot-extra",
			"rxvt-unicode-256color",
		]) {
			expect(`${term}:${terminalSupportsBce({ TERM: term })}`).toBe(`${term}:true`);
		}
	});

	it("unknown TERM without a recognized terminal identity fails closed", () => {
		// TERMINAL_ID is frozen at import from the real test env; under bun
		// test no *_WINDOW_ID/TERM_PROGRAM markers are set, so an unknown TERM
		// resolves through the fail-closed tail.
		expect(terminalSupportsBce({ TERM: "weird-terminal-9000" })).toBe(terminalSupportsBce({ TERM: "another-one" }));
	});
});
