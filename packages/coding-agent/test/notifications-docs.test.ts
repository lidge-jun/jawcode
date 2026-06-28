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

	it("keeps Telegram media and file transfer documented as unsupported", async () => {
		const text = await readDoc("docs/telegram-onboarding.md");
		const lower = text.toLowerCase();

		expect(lower).toContain("media/file transfer is not implemented yet");
		expect(lower).toContain("workspace path-confinement");
		expect(lower).toContain("active authorized telegram sink");
		expect(lower).toContain("mime and size policy");
		expect(lower).toContain("logs never include raw file contents");
		expect(lower).not.toContain("telegram_send is supported");
		expect(lower).not.toContain("sendphoto is supported");
		expect(lower).not.toContain("senddocument is supported");
		expect(lower).not.toContain("inbound telegram media injection is supported");
	});

	it("documents private-chat-only pairing and Threaded Mode fallback", async () => {
		const text = (await readDoc("docs/telegram-onboarding.md")).toLowerCase();
		expect(text).toContain("jwc notify verify");
		expect(text).toContain("private");
		expect(text).toContain("threaded mode");
		expect(text).toContain("supergroup");
		expect(text).toContain("rejected");
	});
});
