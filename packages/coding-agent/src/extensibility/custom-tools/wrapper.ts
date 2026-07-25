/**
 * CustomToolAdapter wraps CustomTool instances into AgentTool for use with the agent.
 */
import type { AgentTool, AgentToolUpdateCallback } from "@jawcode-dev/agent-core";
import type { Static, TSchema } from "@jawcode-dev/ai";
import { toolWireSchema } from "@jawcode-dev/ai/utils/schema";
import type { Theme } from "../../modes/theme/theme";
import { allowedToolArgKeysFromWireSchema, rejectUnknownToolArgs, requireRecordToolArgs } from "../../tools/jtd-utils";
import { applyToolProxy } from "../tool-proxy";
import type { CustomTool, CustomToolContext } from "./types";

export class CustomToolAdapter<TParams extends TSchema = TSchema, TDetails = any, TTheme extends Theme = Theme>
	implements AgentTool<TParams, TDetails, TTheme>
{
	declare name: string;
	declare label: string;
	declare description: string;
	declare parameters: TParams;
	readonly strict: boolean | undefined;

	constructor(
		private tool: CustomTool<TParams, TDetails>,
		private getContext: () => CustomToolContext,
	) {
		applyToolProxy(tool, this);
		this.strict = tool.strict;
	}

	execute(
		toolCallId: string,
		params: Static<TParams>,
		signal?: AbortSignal,
		onUpdate?: AgentToolUpdateCallback<TDetails, TParams>,
		context?: CustomToolContext,
	) {
		const recordArgs = requireRecordToolArgs(params, this.name);
		if (this.strict) {
			const allowed = allowedToolArgKeysFromWireSchema(toolWireSchema(this.tool));
			if (allowed) rejectUnknownToolArgs(recordArgs, allowed, this.name);
		}
		const args = recordArgs as Static<TParams>;
		return this.tool.execute(toolCallId, args, onUpdate, context ?? this.getContext(), signal);
	}

	/**
	 * Backward-compatible export of factory function for existing callers.
	 * Prefer CustomToolAdapter constructor directly.
	 */
	static wrap<TParams extends TSchema = TSchema, TDetails = any, TTheme extends Theme = Theme>(
		tool: CustomTool<TParams, TDetails>,
		getContext: () => CustomToolContext,
	): AgentTool<TParams, TDetails, TTheme> {
		return new CustomToolAdapter(tool, getContext);
	}
}
