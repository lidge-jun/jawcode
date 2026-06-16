import { callTool, connectToServer, disconnectServer, listTools } from "../runtime-mcp/client";
import type { MCPServerConfig, MCPServerConnection, MCPToolCallResult } from "../runtime-mcp/types";
import { ToolAbortError, throwIfAborted } from "./tool-errors";

const CUA_DRIVER_SERVER_NAME = "cua-driver";

const CUA_DRIVER_CONFIG: MCPServerConfig = {
	type: "stdio",
	command: "cua-driver",
	args: ["mcp"],
};

function rethrowIfAborted(error: unknown, signal?: AbortSignal): void {
	if (error instanceof ToolAbortError) throw error;
	if (error instanceof Error && error.name === "AbortError") throw new ToolAbortError();
	if (signal?.aborted) throw new ToolAbortError();
}

export class LazyCuaDriverBackend {
	#connection: MCPServerConnection | undefined;
	#connectPromise: Promise<MCPServerConnection> | undefined;
	#toolNames = new Set<string>();

	async call(rawToolName: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<MCPToolCallResult> {
		throwIfAborted(signal);
		const connection = await this.#ensureConnection(signal);
		throwIfAborted(signal);
		if (!this.#toolNames.has(rawToolName)) {
			throw new Error(`cua-driver backend tool not found: ${rawToolName}`);
		}
		return await callTool(connection, rawToolName, args, { signal });
	}

	async dispose(): Promise<void> {
		const connection = this.#connection;
		this.#connection = undefined;
		this.#connectPromise = undefined;
		this.#toolNames.clear();
		if (connection) {
			await disconnectServer(connection);
		}
	}

	async #ensureConnection(signal?: AbortSignal): Promise<MCPServerConnection> {
		if (this.#connection) return this.#connection;
		if (this.#connectPromise) return await this.#connectPromise;

		this.#connectPromise = this.#connect(signal);
		try {
			return await this.#connectPromise;
		} catch (error) {
			rethrowIfAborted(error, signal);
			this.#connectPromise = undefined;
			throw error;
		}
	}

	async #connect(signal?: AbortSignal): Promise<MCPServerConnection> {
		throwIfAborted(signal);
		let connection: MCPServerConnection | undefined;
		try {
			connection = await connectToServer(CUA_DRIVER_SERVER_NAME, CUA_DRIVER_CONFIG, { signal });
			const tools = await listTools(connection, { signal });
			this.#toolNames = new Set(tools.map(tool => tool.name));
			this.#connection = connection;
			return connection;
		} catch (error) {
			rethrowIfAborted(error, signal);
			if (connection) {
				await disconnectServer(connection).catch(() => undefined);
			}
			throw error;
		}
	}
}
