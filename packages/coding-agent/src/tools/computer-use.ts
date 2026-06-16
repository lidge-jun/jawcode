import type { AgentTool, AgentToolResult } from "@jawcode-dev/agent-core";
import { prompt } from "@jawcode-dev/utils";
import * as z from "zod/v4";
import computerUseDescription from "../prompts/tools/computer-use.md" with { type: "text" };
import type { MCPToolCallResult } from "../runtime-mcp/types";
import type { ToolSession } from ".";
import { LazyCuaDriverBackend } from "./computer-use-backend";
import { ToolAbortError, throwIfAborted } from "./tool-errors";

const COMPUTER_USE_CLEANUP_NAME = "computer_use.lazy_cua_driver";

const computerUseActionSchema = z.enum([
	"start_session",
	"list_apps",
	"observe",
	"window_state",
	"click",
	"type_text",
	"press_key",
	"scroll",
	"end_session",
]);

const computerUseSchema = z.object({
	action: computerUseActionSchema,
	session: z.string().optional(),
	app: z.string().optional(),
	pid: z.number().optional(),
	window_id: z.number().optional(),
	element_index: z.number().optional(),
	x: z.number().optional(),
	y: z.number().optional(),
	text: z.string().optional(),
	key: z.string().optional(),
	dx: z.number().optional(),
	dy: z.number().optional(),
});

type ComputerUseParams = z.infer<typeof computerUseSchema>;
type ComputerUseAction = z.infer<typeof computerUseActionSchema>;

export type ComputerUseEnvelope =
	| {
			ok: true;
			action: ComputerUseAction;
			backend: "cua-driver";
			result: MCPToolCallResult;
	  }
	| {
			ok: false;
			action: ComputerUseAction;
			backend: "cua-driver";
			error: string;
	  };

export interface ComputerUseToolDetails {
	action: ComputerUseAction;
	backend: "cua-driver";
	ok: boolean;
}

function rethrowIfAborted(error: unknown, signal?: AbortSignal): void {
	if (error instanceof ToolAbortError) throw error;
	if (error instanceof Error && error.name === "AbortError") throw new ToolAbortError();
	if (signal?.aborted) throw new ToolAbortError();
}

function requireString(value: string | undefined, name: string): string {
	if (!value?.trim()) throw new Error(`Missing required parameter '${name}'.`);
	return value;
}

function requireNumber(value: number | undefined, name: string): number {
	if (value === undefined || !Number.isFinite(value)) throw new Error(`Missing required parameter '${name}'.`);
	return value;
}

function omitUndefined(args: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(args)) {
		if (value !== undefined) out[key] = value;
	}
	return out;
}

function buildBackendCall(params: ComputerUseParams): { toolName: string; args: Record<string, unknown> } {
	switch (params.action) {
		case "start_session":
			return { toolName: "start_session", args: { session: requireString(params.session, "session") } };
		case "list_apps":
			return { toolName: "list_apps", args: omitUndefined({ session: params.session }) };
		case "observe":
		case "window_state":
			return {
				toolName: "get_window_state",
				args: omitUndefined({
					session: params.session,
					pid: requireNumber(params.pid, "pid"),
					window_id: requireNumber(params.window_id, "window_id"),
				}),
			};
		case "click": {
			const pid = requireNumber(params.pid, "pid");
			if (params.element_index !== undefined) {
				return {
					toolName: "click",
					args: omitUndefined({
						session: params.session,
						pid,
						window_id: params.window_id,
						element_index: params.element_index,
					}),
				};
			}
			if (params.x === undefined || params.y === undefined) {
				throw new Error("Action 'click' requires either 'element_index' or both 'x' and 'y'.");
			}
			return {
				toolName: "click",
				args: omitUndefined({
					session: params.session,
					pid,
					window_id: params.window_id,
					x: requireNumber(params.x, "x"),
					y: requireNumber(params.y, "y"),
				}),
			};
		}
		case "type_text":
			return {
				toolName: "type_text",
				args: omitUndefined({
					session: params.session,
					pid: requireNumber(params.pid, "pid"),
					text: requireString(params.text, "text"),
				}),
			};
		case "press_key":
			return {
				toolName: "press_key",
				args: omitUndefined({
					session: params.session,
					pid: requireNumber(params.pid, "pid"),
					key: requireString(params.key, "key"),
				}),
			};
		case "scroll": {
			const pid = requireNumber(params.pid, "pid");
			if (params.dx === undefined && params.dy === undefined) {
				throw new Error("Action 'scroll' requires at least one of 'dx' or 'dy'.");
			}
			return {
				toolName: "scroll",
				args: omitUndefined({
					session: params.session,
					pid,
					window_id: params.window_id,
					dx: params.dx,
					dy: params.dy,
				}),
			};
		}
		case "end_session":
			return { toolName: "end_session", args: { session: requireString(params.session, "session") } };
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function contentForEnvelope(envelope: ComputerUseEnvelope): string {
	return JSON.stringify(envelope, null, 2);
}

export class ComputerUseTool implements AgentTool<typeof computerUseSchema, ComputerUseToolDetails> {
	readonly name = "computer_use";
	readonly label = "ComputerUse";
	readonly summary = "Control desktop apps through lazy cua-driver backend";
	readonly loadMode = "discoverable";
	readonly description = prompt.render(computerUseDescription);
	readonly parameters = computerUseSchema;
	readonly strict = true;
	readonly #backend = new LazyCuaDriverBackend();

	constructor(session: ToolSession) {
		session.registerSessionCleanup?.(COMPUTER_USE_CLEANUP_NAME, () => this.#backend.dispose());
	}

	async execute(
		_toolCallId: string,
		params: ComputerUseParams,
		signal?: AbortSignal,
	): Promise<AgentToolResult<ComputerUseToolDetails>> {
		throwIfAborted(signal);
		try {
			const backendCall = buildBackendCall(params);
			const result = await this.#backend.call(backendCall.toolName, backendCall.args, signal);
			const envelope: ComputerUseEnvelope = {
				ok: true,
				action: params.action,
				backend: "cua-driver",
				result,
			};
			return {
				content: [{ type: "text", text: contentForEnvelope(envelope) }],
				details: { action: params.action, backend: "cua-driver", ok: true },
			};
		} catch (error) {
			rethrowIfAborted(error, signal);
			const envelope: ComputerUseEnvelope = {
				ok: false,
				action: params.action,
				backend: "cua-driver",
				error: errorMessage(error),
			};
			return {
				content: [{ type: "text", text: contentForEnvelope(envelope) }],
				details: { action: params.action, backend: "cua-driver", ok: false },
				isError: true,
			};
		}
	}
}

export const __computerUseInternals = {
	buildBackendCall,
};
