/**
 * Discovery must not believe an implausibly small context window.
 *
 * `toPositiveInt` accepts anything above zero, so a backend returning a
 * degraded, truncated or placeholder window was trusted verbatim. A reported
 * `1` produced a one-token session — it cannot hold even the system prompt —
 * and silently poisoned compaction thresholds and the HUD. The user sees a
 * model that appears broken, with nothing pointing at discovery.
 *
 * The floor sits far below the smallest real model on this transport
 * (`gpt-5.3-codex-spark`, 128K), so it rejects nonsense without ever clamping
 * a legitimate value.
 */
import { describe, expect, it } from "bun:test";
import { fetchCodexModels } from "../src/utils/discovery/codex";

async function discover(models: unknown[]): Promise<Map<string, { contextWindow: number; maxTokens: number }>> {
	const fetchFn = (async () =>
		new Response(JSON.stringify({ models }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})) as unknown as typeof fetch;
	const result = await fetchCodexModels({ accessToken: "test-token", clientVersion: "0.139.0", fetchFn });
	return new Map(
		result?.models.map(model => [model.id, { contextWindow: model.contextWindow, maxTokens: model.maxTokens }]) ?? [],
	);
}

describe("codex discovery context-window floor", () => {
	it("ignores a one-token window instead of creating an unusable session", async () => {
		const windows = await discover([{ slug: "gpt-5.5", context_window: 1 }]);
		expect(windows.get("gpt-5.5")?.contextWindow).toBe(272_000);
	});

	it("ignores a degraded window reported in both fields", async () => {
		const windows = await discover([{ slug: "gpt-5.4", context_window: 1000, max_context_window: 1000 }]);
		expect(windows.get("gpt-5.4")?.contextWindow).toBe(272_000);
	});

	it("uses the model-specific default when falling back", async () => {
		// gpt-5.6 has its own larger default; the floor must not flatten it.
		const windows = await discover([{ slug: "gpt-5.6", context_window: 500, max_context_window: 400 }]);
		expect(windows.get("gpt-5.6")?.contextWindow).toBe(372_000);
	});

	it("still trusts every legitimate reported window", async () => {
		const windows = await discover([
			// The smallest real model on this transport.
			{ slug: "gpt-5.3-codex-spark", context_window: 128_000, max_context_window: 128_000 },
			{ slug: "gpt-5.4", context_window: 272_000, max_context_window: 1_000_000 },
		]);

		expect(windows.get("gpt-5.3-codex-spark")?.contextWindow).toBe(128_000);
		expect(windows.get("gpt-5.4")?.contextWindow).toBe(1_000_000);
	});

	it("keeps maxTokens consistent with the corrected window", async () => {
		// maxTokens is derived from the window, so a bogus window used to drag it
		// down too — a 1-token cap on output.
		const windows = await discover([{ slug: "gpt-5.5", context_window: 1 }]);
		expect(windows.get("gpt-5.5")?.maxTokens).toBe(128_000);
	});
});
