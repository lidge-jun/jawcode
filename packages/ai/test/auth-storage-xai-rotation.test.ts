import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { type AuthCredentialStore, AuthStorage, SqliteAuthCredentialStore } from "../src/auth-storage";
import { isUsageLimitError } from "../src/rate-limit-utils";
import { withEnv } from "./helpers";

const SUPPRESS_XAI_ENV = { XAI_API_KEY: undefined } as const;
const SUPERGROK_EXHAUSTION =
	"403 You have run out of credits or need a Grok subscription. (type=personal-team-blocked:spending-limit)";

describe("AuthStorage xAI credit-exhaustion rotation", () => {
	let tempDir = "";
	let store: AuthCredentialStore | undefined;
	let authStorage: AuthStorage | undefined;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-ai-xai-rotation-"));
		store = await SqliteAuthCredentialStore.open(path.join(tempDir, "agent.db"));
		authStorage = new AuthStorage(store);
	});

	afterEach(async () => {
		store?.close();
		store = undefined;
		authStorage = undefined;
		if (tempDir) {
			await fs.rm(tempDir, { recursive: true, force: true });
			tempDir = "";
		}
	});

	test("classified SuperGrok exhaustion blocks the sticky account and selects its sibling", async () => {
		if (!authStorage) throw new Error("test setup failed");
		const sessionId = "xai-supergrok-rotation";
		const expires = Date.now() + 60 * 60_000;
		await authStorage.set("xai", [
			{ type: "oauth", access: "xai-access-a", refresh: "xai-refresh-a", expires },
			{ type: "oauth", access: "xai-access-b", refresh: "xai-refresh-b", expires },
		]);

		await withEnv(SUPPRESS_XAI_ENV, async () => {
			const first = await authStorage?.getApiKey("xai", sessionId);
			expect(first).toMatch(/^xai-access-[ab]$/);
			expect(isUsageLimitError(SUPERGROK_EXHAUSTION)).toBe(true);

			const switched = await authStorage?.markUsageLimitReached("xai", sessionId, { retryAfterMs: 30 * 60_000 });
			expect(switched).toBe(true);
			expect(await authStorage?.getApiKey("xai", sessionId)).not.toBe(first);
		});
	});
});
