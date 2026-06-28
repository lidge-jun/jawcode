import { describe, expect, test } from "bun:test";
import { parseKiroPayload } from "./kiro";

// CodeWhisperer streams tool calls as a sequence where `name` + `toolUseId`
// are repeated on EVERY event (start, each input fragment, and stop). The
// parser must discriminate by `stop`/`input`, not by `name` — otherwise input
// fragments are misread as fresh tool_starts and arguments come back empty {}.
// Event shapes below are taken verbatim from a live JWC_KIRO_DEBUG capture.

const ev = (obj: unknown) => new TextEncoder().encode(JSON.stringify(obj));

describe("parseKiroPayload — tool event discrimination", () => {
	test("start event (name + toolUseId, no input) → tool_start", () => {
		const e = parseKiroPayload(ev({ name: "bash", toolUseId: "tooluse_X" }));
		expect(e?.type).toBe("tool_start");
		expect(e?.toolUseId).toBe("tooluse_X");
	});

	test("input fragment WITH name → tool_input (not tool_start)", () => {
		const e = parseKiroPayload(ev({ input: '{"com', name: "bash", toolUseId: "tooluse_X" }));
		expect(e?.type).toBe("tool_input");
		expect(e?.input).toBe('{"com');
	});

	test("stop event WITH name → tool_stop (not tool_start)", () => {
		const e = parseKiroPayload(ev({ name: "bash", stop: true, toolUseId: "tooluse_X" }));
		expect(e?.type).toBe("tool_stop");
	});

	test("content event → content", () => {
		const e = parseKiroPayload(ev({ content: "hi" }));
		expect(e?.type).toBe("content");
		expect(e?.data).toBe("hi");
	});

	test("full fragment sequence accumulates into valid JSON arguments", () => {
		// Reconstruct the captured bash tool call across fragmented input events.
		const events = [
			{ name: "bash", toolUseId: "t1" },
			{ input: "", name: "bash", toolUseId: "t1" },
			{ input: '{"command": "ec', name: "bash", toolUseId: "t1" },
			{ input: "ho hi", name: "bash", toolUseId: "t1" },
			{ input: '"}', name: "bash", toolUseId: "t1" },
			{ name: "bash", stop: true, toolUseId: "t1" },
		];
		let args = "";
		let started = false;
		let stopped = false;
		for (const raw of events) {
			const e = parseKiroPayload(ev(raw));
			if (e?.type === "tool_start") started = true;
			else if (e?.type === "tool_input") args += e.input ?? "";
			else if (e?.type === "tool_stop") stopped = true;
		}
		expect(started).toBe(true);
		expect(stopped).toBe(true);
		expect(JSON.parse(args)).toEqual({ command: "echo hi" });
	});
});
