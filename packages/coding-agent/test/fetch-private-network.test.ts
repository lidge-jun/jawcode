import { describe, expect, it } from "bun:test";
import { hookFetch } from "@jawcode-dev/utils";
import { loadPage } from "../src/web/scrapers/types";
import { fetchBinary } from "../src/web/scrapers/utils";

describe("public fetch private-network redirects", () => {
	it("does not follow loadPage redirects into loopback hosts", async () => {
		const seen: string[] = [];
		using _hook = hookFetch(input => {
			const url = String(input);
			seen.push(url);
			if (url === "https://example.com/start") {
				return new Response("", {
					status: 302,
					headers: { Location: "http://127.0.0.1/private" },
				});
			}
			return new Response("private", { status: 200 });
		});

		const result = await loadPage("https://example.com/start");

		expect(result.ok).toBe(false);
		expect(result.status).toBe(310);
		expect(seen).toEqual(["https://example.com/start"]);
	});

	it("does not follow fetchBinary redirects into link-local hosts", async () => {
		const seen: string[] = [];
		using _hook = hookFetch(input => {
			const url = String(input);
			seen.push(url);
			if (url === "https://example.com/file") {
				return new Response("", {
					status: 302,
					headers: { Location: "http://169.254.169.254/latest/meta-data" },
				});
			}
			return new Response("private", { status: 200 });
		});

		const result = await fetchBinary("https://example.com/file");

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected fetchBinary to reject a private-network redirect");
		expect(result.error).toContain("private or local network");
		expect(seen).toEqual(["https://example.com/file"]);
	});
});
