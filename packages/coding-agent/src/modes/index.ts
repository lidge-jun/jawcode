import { emergencyTerminalRestore } from "@jawcode-dev/tui";
import { postmortem } from "@jawcode-dev/utils";
import { disposeTerminalTitleState } from "../utils/title-generator";

/**
 * Run modes for the coding agent.
 */
export { runAcpMode } from "./acp";
export { runBridgeMode } from "./bridge/bridge-mode";
export { InteractiveMode, type InteractiveModeOptions } from "./interactive-mode";
export { type PrintModeOptions, runPrintMode } from "./print-mode";
export {
	defineRpcClientTool,
	type ModelInfo,
	RpcClient,
	type RpcClientCustomTool,
	type RpcClientOptions,
	type RpcClientToolContext,
	type RpcClientToolResult,
	type RpcEventListener,
} from "./rpc/rpc-client";
export { runRpcMode } from "./rpc/rpc-mode";
export type {
	RpcCommand,
	RpcHostToolCallRequest,
	RpcHostToolCancelRequest,
	RpcHostToolDefinition,
	RpcHostToolResult,
	RpcHostToolUpdate,
	RpcResponse,
	RpcSessionState,
} from "./rpc/rpc-types";

postmortem.register("terminal-restore", () => {
	// Stop the run-state spinner FIRST: emergency restore hands the terminal back,
	// and a pending interval tick would repaint an OSC title over the restored shell.
	disposeTerminalTitleState();
	emergencyTerminalRestore();
});
