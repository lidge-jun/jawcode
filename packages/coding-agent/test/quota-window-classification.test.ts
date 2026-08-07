/**
 * The status line's quota rows must match how limits are actually produced.
 *
 * It compared `windowId === "5h" && !tier`. Three ways that silently dropped
 * rows it should have shown:
 *
 * 1. **Case** — the usage layer compares with `windowId?.toLowerCase()`; the
 *    status line did not.
 * 2. **Duration** — `openai-codex` derives its window id from reported
 *    seconds, so a five-hour window can call itself something else. The usage
 *    layer already falls back to `durationMs`.
 * 3. **Tier** — `openai-codex` ALWAYS sets `scope.tier` (plan type or slug),
 *    so `!tier` rejected every codex limit and its quota never rendered at all.
 */
import { describe, expect, it } from "bun:test";
import { classifyQuotaWindow } from "@jawcode-dev/coding-agent/modes/components/quota-window";

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

describe("quota window classification", () => {
	it("matches the plain anthropic account-wide rows", () => {
		// The existing behavior, which must keep working.
		expect(classifyQuotaWindow("5h", FIVE_HOURS_MS, undefined)).toBe("5h");
		expect(classifyQuotaWindow("7d", SEVEN_DAYS_MS, undefined)).toBe("7d");
	});

	it("still excludes anthropic per-model rows", () => {
		// `anthropic:7d:opus` and `:sonnet` are per-model, not account-wide.
		expect(classifyQuotaWindow("7d", SEVEN_DAYS_MS, "opus")).toBeNull();
		expect(classifyQuotaWindow("7d", SEVEN_DAYS_MS, "sonnet")).toBeNull();
	});

	it("accepts a codex row despite its plan tier", () => {
		// This is the regression: openai-codex sets tier to the plan type, so the
		// old `!tier` guard rejected the account-wide row too.
		expect(classifyQuotaWindow("5h", FIVE_HOURS_MS, "pro")).toBe("5h");
		expect(classifyQuotaWindow("7d", SEVEN_DAYS_MS, "plus")).toBe("7d");
	});

	it("is case-insensitive like the usage layer", () => {
		expect(classifyQuotaWindow("5H", undefined, undefined)).toBe("5h");
		expect(classifyQuotaWindow(" 7D ", undefined, undefined)).toBe("7d");
	});

	it("falls back to duration when the id does not name the window", () => {
		// A five-hour window reported as `1h` still is a five-hour window.
		expect(classifyQuotaWindow("1h", FIVE_HOURS_MS, undefined)).toBe("5h");
		expect(classifyQuotaWindow("primary", SEVEN_DAYS_MS, undefined)).toBe("7d");
	});

	it("tolerates small duration drift but not a different window", () => {
		expect(classifyQuotaWindow("primary", FIVE_HOURS_MS - 30_000, undefined)).toBe("5h");
		// One hour is a real window in its own right and must not be claimed.
		expect(classifyQuotaWindow("primary", 60 * 60 * 1000, undefined)).toBeNull();
	});

	it("returns null for windows the status line does not display", () => {
		expect(classifyQuotaWindow("quota", undefined, undefined)).toBeNull();
		expect(classifyQuotaWindow(undefined, undefined, undefined)).toBeNull();
	});

	it("filters per-model rows by modelId in the status line", async () => {
		// `tier` cannot carry that meaning for codex, so the caller uses modelId.
		const source = await Bun.file(new URL("../src/modes/components/status-line.ts", import.meta.url).pathname).text();
		expect(source).toContain("if (l.scope?.modelId) continue;");
		expect(source).toContain("classifyQuotaWindow(");
	});
});
