import { describe, expect, it } from "bun:test";
import { mapH2TransportError } from "../src/providers/cursor";

const BASE_URL = "https://cursor-bridge.example.test";

describe("mapH2TransportError", () => {
	it("maps Bun's HTTP/2 ALPN failure to an actionable Cursor provider error", () => {
		const raw = Object.assign(new Error("h2 is not supported"), { code: "ERR_HTTP2_ERROR" });
		const mapped = mapH2TransportError(raw, BASE_URL);
		expect(mapped).toBeInstanceOf(Error);
		if (!(mapped instanceof Error)) throw new Error("Expected Error");
		expect(mapped.name).toBe("CursorTransportError");
		expect(mapped.message).toContain(BASE_URL);
		expect(mapped.message).toContain("ALPN");
		expect(mapped.message).toContain("providers.cursor.baseUrl");
		expect(mapped.cause).toBe(raw);
	});

	it("matches the negotiation message case-insensitively", () => {
		const raw = Object.assign(new Error("H2 Is Not Supported"), { code: "ERR_HTTP2_ERROR" });
		expect(mapH2TransportError(raw, BASE_URL)).toBeInstanceOf(Error);
	});

	it("passes through unrelated transport errors", () => {
		const raw = Object.assign(new Error("stream reset"), { code: "ERR_HTTP2_ERROR" });
		expect(mapH2TransportError(raw, BASE_URL)).toBe(raw);
	});
});
