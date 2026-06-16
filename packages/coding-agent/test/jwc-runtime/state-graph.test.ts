import { describe, expect, it } from "bun:test";
import { renderStateGraph } from "@gajae-code/coding-agent/jwc-runtime/state-graph";
import { runNativeStateCommand } from "@gajae-code/coding-agent/jwc-runtime/state-runtime";

describe("GJC state graph rendering", () => {
	it("renders one skill as ascii", () => {
		const output = renderStateGraph("jaw-interview", "ascii");

		expect(output).toContain("jaw-interview (Jaw Interview)");
		expect(output).toContain("states:");
		expect(output).toContain("  - interviewing (initial)");
		expect(output).toContain("transitions:");
		expect(output).toContain("  - interviewing -> handoff [write-spec]");
	});

	it("renders one skill as mermaid", () => {
		const output = renderStateGraph("jaw-interview", "mermaid");

		expect(output).toContain("stateDiagram-v2");
		expect(output).toContain('state "Jaw Interview" as jaw-interview {');
		expect(output).toContain("[*] --> interviewing");
		expect(output).toContain("interviewing --> handoff: write-spec");
	});

	it("renders one skill as dot", () => {
		const output = renderStateGraph("jaw-interview", "dot");

		expect(output).toContain("digraph gjc_state {");
		expect(output).toContain('subgraph "cluster_jaw-interview"');
		expect(output).toContain('"jaw-interview:interviewing" [label="interviewing", shape=circle];');
		expect(output).toContain('"jaw-interview:interviewing" -> "jaw-interview:handoff" [label="write-spec"];');
	});

	it("returns exit 2 for invalid CLI graph format", async () => {
		const result = await runNativeStateCommand(["graph", "--skill", "jaw-interview", "--format", "svg"]);

		expect(result.status).toBe(2);
		expect(result.stderr).toContain("Invalid graph format: svg");
	});
});
