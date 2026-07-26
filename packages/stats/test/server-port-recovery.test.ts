import { afterEach, describe, expect, it } from "bun:test";
import { startServer } from "../src/server";

const rawServers: Bun.Server<unknown>[] = [];
const ownedStops: Array<() => void> = [];

afterEach(async () => {
	for (const stop of ownedStops.splice(0)) stop();
	for (const server of rawServers.splice(0)) server.stop(true);
	await Bun.sleep(10);
});

describe("stats server occupied-port recovery", () => {
	it("reuses a real JWC dashboard through its private ownership handshake", async () => {
		const existing = await startServer(0);
		ownedStops.push(existing.stop);

		const recovered = await startServer(existing.port);
		expect(recovered.port).toBe(existing.port);
		recovered.stop();
		expect((await fetch(`http://127.0.0.1:${existing.port}/api/stats/models`)).status).toBe(200);
	});

	it("rejects a foreign listener even when it spoofs the old header and JSON shape", async () => {
		const foreign = Bun.serve({
			hostname: "127.0.0.1",
			port: 0,
			fetch: () => Response.json([], { headers: { "x-jwc-stats-dashboard": "1" } }),
		});
		rawServers.push(foreign);

		await expect(startServer(foreign.port)).rejects.toThrow(/ownership could not be proven/);
		expect((await fetch(`http://127.0.0.1:${foreign.port}`)).status).toBe(200);
	});
});
