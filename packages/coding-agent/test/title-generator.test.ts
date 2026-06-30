import { afterEach, describe, expect, it, vi } from "bun:test";
import * as ai from "@jawcode-dev/ai";
import { type Api, getBundledModel, type Model } from "@jawcode-dev/ai";
import { generateSessionTitle, reconcileTitleCasing } from "../src/utils/title-generator";

function getModelOrThrow(id: string): Model<Api> {
	const model = getBundledModel("anthropic", id);
	if (!model) throw new Error(`Expected model ${id}`);
	return model;
}

function createSettings(model: Model<Api>) {
	return {
		getModelRole(role: string) {
			return role === "default" ? `${model.provider}/${model.id}` : undefined;
		},
		getStorage() {
			return undefined;
		},
	} as never;
}

function createRegistry(model: Model<Api>) {
	return {
		getAvailable: () => [model],
		getApiKey: async () => "test-key",
	} as never;
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("title generator", () => {
	it("returns the title from a forced set_title tool call", async () => {
		const model = getModelOrThrow("claude-sonnet-4-5");
		const completeSimpleMock = vi.spyOn(ai, "completeSimple").mockResolvedValue({
			stopReason: "stop",
			content: [
				{
					type: "toolCall",
					id: "call-title",
					name: "set_title",
					arguments: { title: "Structured Title" },
				},
			],
		} as never);

		const title = await generateSessionTitle(
			"Investigate the resolver",
			createRegistry(model),
			createSettings(model),
		);

		expect(title).toBe("Structured Title");
		expect(completeSimpleMock.mock.calls[0]?.[1]).toMatchObject({
			tools: [expect.objectContaining({ name: "set_title" })],
		});
		expect(completeSimpleMock.mock.calls[0]?.[2]).toMatchObject({
			disableReasoning: true,
			toolChoice: { type: "tool", name: "set_title" },
		});
	});

	it("falls back to text content when no set_title tool call is returned", async () => {
		const model = getModelOrThrow("claude-sonnet-4-5");
		vi.spyOn(ai, "completeSimple").mockResolvedValue({
			stopReason: "stop",
			content: [{ type: "text", text: "Text Title" }],
		} as never);

		const title = await generateSessionTitle(
			"Investigate the resolver",
			createRegistry(model),
			createSettings(model),
		);

		expect(title).toBe("Text Title");
	});

	it("uses a reasoning-safe output budget for reasoning models", async () => {
		const model = getModelOrThrow("claude-sonnet-4-5");
		const completeSimpleMock = vi.spyOn(ai, "completeSimple").mockResolvedValue({
			stopReason: "stop",
			content: [
				{
					type: "toolCall",
					id: "call-title",
					name: "set_title",
					arguments: { title: "Budget Title" },
				},
			],
		} as never);

		const title = await generateSessionTitle(
			"Investigate the resolver",
			createRegistry(model),
			createSettings(model),
		);
		const maxTokens = (completeSimpleMock.mock.calls[0]?.[2] as { maxTokens?: number } | undefined)?.maxTokens;

		expect(title).toBe("Budget Title");
		expect(maxTokens).toBeGreaterThanOrEqual(1024);
	});
});

describe("reconcileTitleCasing", () => {
	it("keeps tokens the user typed verbatim and restores distinctive casing", () => {
		// "tinyvmm" -> "TinyVMM" (distinctive restore); "daemon" verbatim kept;
		// "fix" verbatim kept.
		const out = reconcileTitleCasing("tinyvmm daemon fix", "fix TinyVMM daemon crash");
		expect(out).toBe("TinyVMM daemon fix");
	});

	it("restores distinctive proper-noun casing from the message", () => {
		const out = reconcileTitleCasing("ios api client", "Build iOS API client");
		expect(out).toBe("iOS API client");
	});

	it("flattens camelCase artifacts not present in the message", () => {
		const out = reconcileTitleCasing("Start dAemon process", "start a background process");
		expect(out).toBe("Start daemon process");
	});

	it("preserves model-cased proper nouns absent from the message", () => {
		const out = reconcileTitleCasing("GitHub OAuth setup", "set up login");
		expect(out).toBe("GitHub OAuth setup");
	});

	it("does not force ordinary sentence words to title case", () => {
		const out = reconcileTitleCasing("refactor the parser for speed", "refactor the parser for speed");
		expect(out).toBe("refactor the parser for speed");
	});
});
