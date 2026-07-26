import { afterEach, describe, expect, it } from "bun:test";
import { startServer } from "../src/server";

const servers: Bun.Server<unknown>[] = [];

afterEach(() => {
	for (const server of servers.splice(0)) server.stop(true);
});

describe("stats server occupied-port recovery", () => {
	it("reuses an occupied port only when the responder has dashboard identity", async () => {
		const existing = Bun.serve({
			hostname: "127.0.0.1",
			port: 0,
			fetch: () =>
				Response.json([], {
					headers: { "x-jwc-stats-dashboard": "1" },
				}),
		});
		servers.push(existing);

		const recovered = await startServer(existing.port);
		expect(recovered.port).toBe(existing.port);
		recovered.stop();
		expect((await fetch(`http://127.0.0.1:${existing.port}/api/stats/models`)).status).toBe(200);
	});

	it("rejects a mismatched dashboard identity instead of reusing a foreign responder", async () => {
		const foreign = Bun.serve({
			hostname: "127.0.0.1",
			port: 0,
			fetch: () => new Response("SPA fallback", { status: 200, headers: { "content-type": "text/html" } }),
		});
		servers.push(foreign);

		await expect(startServer(foreign.port)).rejects.toThrow(/held by the current process/);
	});
});
