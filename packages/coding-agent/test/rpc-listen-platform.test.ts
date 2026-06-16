import { describe, expect, test } from "bun:test";
import { assertRpcListenSupported } from "../src/modes/rpc/rpc-mode";

describe("rpc --listen platform guard", () => {
	test("rejects unsupported Windows platform with stable error", () => {
		expect(() => assertRpcListenSupported("win32")).toThrow("RPC --listen requires Unix-domain socket support");
	});

	test("accepts Unix-like platforms", () => {
		expect(() => assertRpcListenSupported("darwin")).not.toThrow();
		expect(() => assertRpcListenSupported("linux")).not.toThrow();
	});
});
