import { describe, expect, it } from "bun:test";
import type {
	RpcHostToolCallRequest,
	RpcHostToolCancelRequest,
	RpcHostToolResult,
	RpcHostToolUpdate,
} from "../../src/modes/rpc/rpc-types";
import { RpcHostToolBridge } from "../../src/modes/shared/agent-wire/host-tool-bridge";

type HostToolFrame = RpcHostToolCallRequest | RpcHostToolCancelRequest;

function textResult(text: string): RpcHostToolResult["result"] {
	return { content: [{ type: "text", text }] };
}

function createHostToolBridge() {
	const frames: HostToolFrame[] = [];
	const bridge = new RpcHostToolBridge(frame => {
		frames.push(frame);
	});
	const [tool] = bridge.setTools([
		{
			name: "host_read",
			label: "Host Read",
			description: "Reads from the host process",
			parameters: {
				type: "object",
				properties: {
					path: { type: "string" },
				},
				required: ["path"],
				additionalProperties: false,
			},
		},
	]);
	return { bridge, frames, tool };
}

function expectHostToolCall(frame: HostToolFrame | undefined): RpcHostToolCallRequest {
	if (frame?.type !== "host_tool_call") {
		throw new Error("Expected host_tool_call frame");
	}
	return frame;
}

describe("agent-wire host tool bridge correlation", () => {
	it("emits host_tool_call frames with caller toolCallId and resolves only matching result ids", async () => {
		const { bridge, frames, tool } = createHostToolBridge();

		const execution = tool.execute("tc-1", { path: "README.md" });
		const request = expectHostToolCall(frames[0]);

		expect(request).toMatchObject({
			type: "host_tool_call",
			toolCallId: "tc-1",
			toolName: "host_read",
			arguments: { path: "README.md" },
		});
		expect(typeof request.id).toBe("string");
		expect(request.id).not.toBe("tc-1");

		expect(
			bridge.handleResult({
				type: "host_tool_result",
				id: "unrelated",
				result: textResult("wrong"),
			}),
		).toBe(false);

		expect(
			bridge.handleResult({
				type: "host_tool_result",
				id: request.id,
				result: textResult("ok"),
			}),
		).toBe(true);
		await expect(execution).resolves.toEqual(textResult("ok"));
		expect(
			bridge.handleResult({
				type: "host_tool_result",
				id: request.id,
				result: textResult("late"),
			}),
		).toBe(false);
	});

	it("routes host_tool_update by generated request id without settling the call", async () => {
		const { bridge, frames, tool } = createHostToolBridge();
		const updates: RpcHostToolUpdate["partialResult"][] = [];

		const execution = tool.execute("tc-2", { path: "package.json" }, undefined, update => {
			updates.push(update);
		});
		const request = expectHostToolCall(frames[0]);

		expect(
			bridge.handleUpdate({
				type: "host_tool_update",
				id: "unrelated",
				partialResult: textResult("ignored"),
			}),
		).toBe(false);
		expect(updates).toEqual([]);

		expect(
			bridge.handleUpdate({
				type: "host_tool_update",
				id: request.id,
				partialResult: textResult("working"),
			}),
		).toBe(true);
		expect(updates).toEqual([textResult("working")]);

		expect(
			bridge.handleResult({
				type: "host_tool_result",
				id: request.id,
				result: textResult("done"),
			}),
		).toBe(true);
		await expect(execution).resolves.toEqual(textResult("done"));
	});

	it("emits host_tool_cancel with targetId and ignores late frames after abort", async () => {
		const { bridge, frames, tool } = createHostToolBridge();
		const controller = new AbortController();

		const execution = tool.execute("tc-3", { path: "secret.txt" }, controller.signal);
		const request = expectHostToolCall(frames[0]);

		controller.abort();

		expect(frames[1]).toMatchObject({
			type: "host_tool_cancel",
			targetId: request.id,
		});
		await expect(execution).rejects.toThrow('Host tool "host_read" was aborted');
		expect(
			bridge.handleResult({
				type: "host_tool_result",
				id: request.id,
				result: textResult("late"),
			}),
		).toBe(false);
		expect(
			bridge.handleUpdate({
				type: "host_tool_update",
				id: request.id,
				partialResult: textResult("late update"),
			}),
		).toBe(false);
	});

	it("rejects all pending host tool calls without accepting later frames", async () => {
		const { bridge, frames, tool } = createHostToolBridge();

		const first = tool.execute("tc-4", { path: "a.txt" });
		const second = tool.execute("tc-5", { path: "b.txt" });
		const firstRequest = expectHostToolCall(frames[0]);
		const secondRequest = expectHostToolCall(frames[1]);

		bridge.rejectAllPending("bridge closed");

		await expect(first).rejects.toThrow("bridge closed");
		await expect(second).rejects.toThrow("bridge closed");
		for (const request of [firstRequest, secondRequest]) {
			expect(
				bridge.handleResult({
					type: "host_tool_result",
					id: request.id,
					result: textResult("late"),
				}),
			).toBe(false);
		}
	});
});
