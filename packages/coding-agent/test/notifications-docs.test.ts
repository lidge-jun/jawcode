import { describe, expect, it } from "bun:test";
import * as path from "node:path";

const DOCS = ["docs/notifications-sdk.md", "docs/telegram-onboarding.md"] as const;

async function readDoc(file: string): Promise<string> {
	return await Bun.file(path.join(import.meta.dir, "..", "..", "..", file)).text();
}

describe("notification docs", () => {
	it("uses JWC commands and state paths without stale public GJC examples", async () => {
		for (const doc of DOCS) {
			const text = await readDoc(doc);
			expect(text).toContain("jwc notify");
			expect(text).toContain(".jwc/state/notifications/");
			expect(text).not.toMatch(/\bgjc notify\b/i);
			expect(text).not.toContain(".gjc/state");
		}
	});

	it("does not include raw-looking Telegram bot tokens", async () => {
		const tokenLike = /\b\d{6,}:[A-Za-z0-9_-]{20,}\b/;
		for (const doc of DOCS) {
			const text = await readDoc(doc);
			expect(text).toContain("<bot-token>");
			expect(text).not.toMatch(tokenLike);
		}
	});

	it("does not claim unsupported adapters or live Telegram runtime", async () => {
		for (const doc of DOCS) {
			const text = await readDoc(doc).then(value => value.toLowerCase());
			expect(text).not.toContain("discord is supported");
			expect(text).not.toContain("slack is supported");
			expect(text).not.toContain("telegram polling is supported");
			expect(text).toContain("deferred");
		}
	});
});
