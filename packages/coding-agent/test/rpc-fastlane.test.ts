import { describe, expect, test } from "bun:test";
import type { AgentMessage } from "@jawcode-dev/agent-core";
import {
	createRpcCommandScheduler,
	isFastLaneRpcCommand,
	RPC_CANCELLATION_COMMANDS,
	RPC_SAFE_READ_CONTROL_COMMANDS,
} from "@jawcode-dev/coding-agent/modes/rpc/rpc-mode";
import type { RpcCommand, RpcResponse } from "@jawcode-dev/coding-agent/modes/rpc/rpc-types";
import {
	dispatchRpcCommand,
	type RpcCommandDispatchContext,
} from "@jawcode-dev/coding-agent/modes/shared/agent-wire/command-dispatch";

const FAST_LANE_COMMANDS: RpcCommand["type"][] = [
	"abort",
	"abort_bash",
	"abort_retry",
	"get_state",
	"get_session_stats",
	"get_available_models",
	"get_branch_messages",
	"get_last_assistant_text",
	"get_messages",
	"get_login_providers",
];

const ORDERED_COMMANDS: RpcCommand["type"][] = [
	"prompt",
	"steer",
	"follow_up",
	"abort_and_prompt",
	"new_session",
	"switch_session",
	"branch",
	"bash",
	"compact",
	"handoff",
	"login",
	"set_model",
	"cycle_model",
	"set_todos",
	"set_session_name",
	"set_host_tools",
	"set_host_uri_schemes",
	"export_html",
	"negotiate_unattended",
	"workflow_gate_response",
	"set_thinking_level",
	"cycle_thinking_level",
	"set_steering_mode",
	"set_follow_up_mode",
	"set_interrupt_mode",
	"set_auto_compaction",
	"set_auto_retry",
];

const flushMicrotasks = async (): Promise<void> => {
	for (let i = 0; i < 8; i++) await Promise.resolve();
};

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve!: () => void;
	const promise = new Promise<void>(res => {
		resolve = res;
	});
	return { promise, resolve };
}

function dispatchContext(messages: AgentMessage[]): RpcCommandDispatchContext {
	const session = {
		messages,
	} as unknown as RpcCommandDispatchContext["session"];

	return {
		session,
		output: () => undefined,
		hostToolRegistry: { setTools: () => [] },
		hostUriRegistry: { setSchemes: () => [] },
		createUiContext: () => ({ notify: () => undefined }),
	};
}

describe("RPC fast-lane classification", () => {
	test("recognizes cancellation and safe read commands as fast-lane", () => {
		expect([...RPC_CANCELLATION_COMMANDS]).toEqual(["abort", "abort_bash", "abort_retry"]);
		expect([...RPC_SAFE_READ_CONTROL_COMMANDS]).toEqual([
			"get_state",
			"get_session_stats",
			"get_available_models",
			"get_branch_messages",
			"get_last_assistant_text",
			"get_messages",
			"get_login_providers",
		]);
		for (const type of FAST_LANE_COMMANDS) {
			expect(isFastLaneRpcCommand(type)).toBe(true);
		}
	});

	test("keeps mutating and async commands ordered", () => {
		for (const type of ORDERED_COMMANDS) {
			expect(isFastLaneRpcCommand(type)).toBe(false);
		}
	});
});

describe("RPC fast-lane scheduler", () => {
	test("runs a fast-lane read while an ordered command is pending", async () => {
		const first = deferred();
		const seen: string[] = [];
		const tasks: Promise<void>[] = [];
		const scheduler = createRpcCommandScheduler(
			async command => {
				seen.push(`start:${command.type}`);
				if (command.type === "bash") await first.promise;
				seen.push(`finish:${command.type}`);
			},
			task => tasks.push(task),
		);

		scheduler.dispatch({ type: "bash", command: "sleep 10" });
		await flushMicrotasks();
		scheduler.dispatch({ type: "get_state" });
		await flushMicrotasks();

		expect(seen).toEqual(["start:bash", "start:get_state", "finish:get_state"]);
		first.resolve();
		await Promise.all(tasks);
		expect(seen).toEqual(["start:bash", "start:get_state", "finish:get_state", "finish:bash"]);
	});

	test("keeps later ordered commands behind an earlier ordered command", async () => {
		const first = deferred();
		const seen: string[] = [];
		const tasks: Promise<void>[] = [];
		const scheduler = createRpcCommandScheduler(
			async command => {
				seen.push(`start:${command.type}`);
				if (command.type === "bash") await first.promise;
				seen.push(`finish:${command.type}`);
			},
			task => tasks.push(task),
		);

		scheduler.dispatch({ type: "bash", command: "sleep 10" });
		await flushMicrotasks();
		scheduler.dispatch({ type: "set_model", provider: "test", modelId: "model" });
		await flushMicrotasks();

		expect(seen).toEqual(["start:bash"]);
		first.resolve();
		await Promise.all(tasks);
		expect(seen).toEqual(["start:bash", "finish:bash", "start:set_model", "finish:set_model"]);
	});
});

describe("RPC fast-lane read snapshots", () => {
	test("get_messages returns a defensive array snapshot", async () => {
		const messages = [{ type: "user", content: "first" }] as unknown as AgentMessage[];
		const response = (await dispatchRpcCommand({ type: "get_messages" }, dispatchContext(messages))) as Extract<
			RpcResponse,
			{ command: "get_messages"; success: true }
		>;

		expect(response.success).toBe(true);
		expect(response.data.messages).toEqual(messages);
		expect(response.data.messages).not.toBe(messages);

		messages.push({ type: "assistant", content: "later" } as unknown as AgentMessage);
		expect(response.data.messages).toHaveLength(1);
	});
});
