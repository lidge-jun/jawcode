import { describe, expect, it } from "bun:test";
import { type AskBridgeServer, bridgeAsk } from "../src/notifications/ask-bridge";

class FakeBridgeServer implements AskBridgeServer {
	readonly enqueued: Array<{
		actionId: string;
		prompt: string;
		options?: readonly string[];
		allowFreeText?: boolean;
	}> = [];
	readonly resolvedLocal: string[] = [];
	#callback: ((actionId: string, value: string) => void) | undefined;

	enqueueAction(draft: {
		actionId: string;
		prompt: string;
		options?: readonly string[];
		allowFreeText?: boolean;
	}): unknown {
		this.enqueued.push(draft);
		return draft;
	}
	resolveLocal(actionId: string): unknown {
		this.resolvedLocal.push(actionId);
		return actionId;
	}
	setOnRemoteResolved(callback: (actionId: string, value: string) => void): void {
		this.#callback = callback;
	}
	fireRemote(actionId: string, value: string): void {
		this.#callback?.(actionId, value);
	}
}

describe("ask bridge", () => {
	it("returns the local answer and resolves locally when local wins", async () => {
		const server = new FakeBridgeServer();
		const dismiss = new AbortController();
		const result = await bridgeAsk(server, {
			actionId: "a1",
			prompt: "Deploy?",
			options: ["yes", "no"],
			local: Promise.resolve("yes"),
			dismiss,
			onRemote: value => `remote:${value}`,
		});
		expect(result).toBe("yes");
		expect(server.resolvedLocal).toEqual(["a1"]);
		expect(server.enqueued[0]).toMatchObject({ actionId: "a1", prompt: "Deploy?", options: ["yes", "no"] });
		expect(dismiss.signal.aborted).toBe(false);
	});

	it("returns the mapped remote answer and dismisses local when remote wins", async () => {
		const server = new FakeBridgeServer();
		const dismiss = new AbortController();
		const local = new Promise<string>((_resolve, reject) => {
			dismiss.signal.addEventListener("abort", () => reject(new Error("dismissed")));
		});
		const pending = bridgeAsk(server, {
			actionId: "a2",
			prompt: "Q",
			local,
			dismiss,
			onRemote: value => `remote:${value}`,
		});
		server.fireRemote("mismatch", "ignored"); // wrong actionId must not resolve
		server.fireRemote("a2", "ok");
		const result = await pending;
		expect(result).toBe("remote:ok");
		expect(dismiss.signal.aborted).toBe(true);
		expect(server.resolvedLocal).toEqual([]); // remote win does not resolveLocal
	});

	it("propagates a local rejection and still marks resolved", async () => {
		const server = new FakeBridgeServer();
		const dismiss = new AbortController();
		await expect(
			bridgeAsk(server, {
				actionId: "a3",
				prompt: "Q",
				local: Promise.reject(new Error("cancelled")),
				dismiss,
				onRemote: value => value,
			}),
		).rejects.toThrow("cancelled");
		expect(server.resolvedLocal).toEqual(["a3"]);
	});
});
