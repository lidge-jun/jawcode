import { describe, expect, it } from "bun:test";
import { decideTopicAction } from "../src/notifications/threaded-lifecycle";

describe("decideTopicAction", () => {
	it("falls back to flat delivery when forum topics are unsupported", () => {
		expect(decideTopicAction({ threadedSupported: false })).toEqual({
			action: "flat-fallback",
			needsIdentity: true,
		});
		expect(
			decideTopicAction({ threadedSupported: false, existing: { messageThreadId: 5, identitySent: true } }),
		).toEqual({ action: "flat-fallback", needsIdentity: false });
	});

	it("reuses an existing topic and sends identity only once", () => {
		expect(
			decideTopicAction({ threadedSupported: true, existing: { messageThreadId: 9, identitySent: false } }),
		).toEqual({ action: "reuse", messageThreadId: 9, needsIdentity: true });
		expect(
			decideTopicAction({ threadedSupported: true, existing: { messageThreadId: 9, identitySent: true } }),
		).toEqual({ action: "reuse", messageThreadId: 9, needsIdentity: false });
	});

	it("creates a new topic (always needs identity) when none exists", () => {
		expect(decideTopicAction({ threadedSupported: true })).toEqual({ action: "create", needsIdentity: true });
	});
});
