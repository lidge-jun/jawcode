/**
 * Codex discovery context-window normalization. The backend reports the
 * default window in `context_window` and the full session capacity in
 * `max_context_window` (live probe 260613: gpt-5.5 → 272000/272000,
 * gpt-5.4 → 272000/1000000). Discovery must surface the capacity so the HUD
 * and compaction thresholds reflect what a session can actually hold.
 */
import { describe, expect, it } from "bun:test";
import { fetchCodexModels } from "../src/utils/discovery/codex";

async function discover(models: unknown[]): Promise<Map<string, number>> {
	const fetchFn = (async () =>
		new Response(JSON.stringify({ models }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})) as unknown as typeof fetch;
	const result = await fetchCodexModels({
		accessToken: "test-token",
		clientVersion: "0.139.0",
		fetchFn,
	});
	return new Map(result?.models.map(model => [model.id, model.contextWindow]) ?? []);
}

describe("codex discovery context windows", () => {
	it("uses max_context_window when it exceeds the default context_window", async () => {
		const windows = await discover([
			{ slug: "gpt-5.4", context_window: 272000, max_context_window: 1000000 },
			{ slug: "gpt-5.5", context_window: 272000, max_context_window: 272000 },
		]);
		expect(windows.get("gpt-5.4")).toBe(1000000);
		expect(windows.get("gpt-5.5")).toBe(272000);
	});

	it("falls back to context_window, then the 272K default", async () => {
		const windows = await discover([
			{ slug: "gpt-5.3-codex-spark", context_window: 128000 },
			{ slug: "codex-auto-review" },
		]);
		expect(windows.get("gpt-5.3-codex-spark")).toBe(128000);
		expect(windows.get("codex-auto-review")).toBe(272000);
	});

	it("keeps supported_in_api=false models — the flag gates the API platform, not this transport", async () => {
		const windows = await discover([
			{ slug: "gpt-5.3-codex-spark", context_window: 128000, supported_in_api: false },
			{ slug: "gpt-5.5", context_window: 272000, supported_in_api: true },
		]);
		expect(windows.has("gpt-5.3-codex-spark")).toBe(true);
		expect(windows.has("gpt-5.5")).toBe(true);
	});

	it("tags codex-auto-review as unlisted (picker-hidden, cli-jaw precedent)", async () => {
		const fetchFn = (async () =>
			new Response(JSON.stringify({ models: [{ slug: "codex-auto-review" }, { slug: "gpt-5.5" }] }), {
				status: 200,
			})) as unknown as typeof fetch;
		const result = await fetchCodexModels({ accessToken: "t", clientVersion: "0.139.0", fetchFn });
		const byId = new Map(result?.models.map(model => [model.id, model]) ?? []);
		expect(byId.get("codex-auto-review")?.unlisted).toBe(true);
		expect(byId.get("gpt-5.5")?.unlisted).toBeUndefined();
	});
});
