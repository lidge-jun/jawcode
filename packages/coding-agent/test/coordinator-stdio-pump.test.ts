import { describe, expect, it } from "bun:test";
import { pumpCoordinatorMcpStream } from "../src/coordinator-mcp/server";

interface RpcFrame {
	jsonrpc: "2.0";
	id: number | null;
	method?: string;
	result?: unknown;
	error?: { code: number; message: string };
}

function request(id: number, method = "tools/call"): string {
	return `${JSON.stringify({ jsonrpc: "2.0", id, method })}\n`;
}

describe("coordinator stdio pump", () => {
	it("bounds data dispatch, answers ping, and rejects queue overflow", async () => {
		const first = Promise.withResolvers<void>();
		let active = 0;
		let maxActive = 0;
		const writes: RpcFrame[] = [];
		async function* input(): AsyncGenerator<string> {
			yield request(1);
			yield request(2);
			yield request(3);
			yield request(9, "ping");
		}

		const pump = pumpCoordinatorMcpStream(
			async rpc => {
				if (rpc.method !== "ping") {
					active++;
					maxActive = Math.max(maxActive, active);
					if (rpc.id === 1) await first.promise;
					active--;
				}
				return { jsonrpc: "2.0", id: rpc.id ?? null, result: {} };
			},
			input(),
			line => {
				writes.push(JSON.parse(line) as RpcFrame);
			},
			{ maxDataConcurrency: 1, maxQueueDepth: 1 },
		);

		await Bun.sleep(0);
		expect(writes.find(frame => frame.id === 9)?.result).toEqual({});
		expect(writes.find(frame => frame.id === 3)?.error?.message).toContain("server_busy");
		first.resolve();
		await pump;
		expect(maxActive).toBe(1);
		expect(writes.map(frame => frame.id).sort()).toEqual([1, 2, 3, 9]);
	});
});
