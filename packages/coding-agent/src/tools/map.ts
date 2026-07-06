import * as path from "node:path";
import type { AgentTool, AgentToolContext, AgentToolResult, AgentToolUpdateCallback } from "@jawcode-dev/agent-core";
import { repoMap } from "@jawcode-dev/natives";
import * as z from "zod/v4";
import type { ToolSession } from ".";
import type { OutputMeta } from "./output-meta";
import { resolveToolSearchScope } from "./path-utils";
import { ToolError } from "./tool-errors";
import { toolResult } from "./tool-result";

const mapSchema = z.object({
	path: z.string().describe("file or directory to map"),
	budget: z.number().describe("approximate output token budget").optional(),
});

export interface MapToolDetails {
	scopePath: string;
	budget?: number;
	meta?: OutputMeta;
}

export class MapTool implements AgentTool<typeof mapSchema, MapToolDetails> {
	readonly name = "map";
	readonly label = "Map";
	readonly summary = "Ranked structure map of a directory";
	readonly description =
		"Ranked structure map of a directory (tree-sitter defs ranked by reference gravity). Run before deep grep in unfamiliar code; works on subtrees.";
	readonly parameters = mapSchema;
	readonly strict = true;
	readonly loadMode = "discoverable";

	constructor(private readonly session: ToolSession) {}

	async execute(
		_toolCallId: string,
		params: z.infer<typeof mapSchema>,
		signal?: AbortSignal,
		_onUpdate?: AgentToolUpdateCallback<MapToolDetails>,
		_context?: AgentToolContext,
	): Promise<AgentToolResult<MapToolDetails>> {
		const rawPath = params.path.trim();
		if (rawPath.length === 0) {
			throw new ToolError("`path` must be a non-empty file or directory");
		}
		const budget = params.budget === undefined ? undefined : Math.floor(params.budget);
		if (budget !== undefined && (!Number.isFinite(budget) || budget <= 0)) {
			throw new ToolError("budget must be a positive number");
		}
		const scope = await resolveToolSearchScope({
			rawPaths: [rawPath],
			cwd: this.session.cwd,
			getArtifactsDir: this.session.getArtifactsDir,
			internalUrlAction: "read",
		});
		if (scope.multiTargets || scope.globFilter) {
			throw new ToolError("map accepts one file or directory path, not a glob or multi-path scope");
		}
		const searchPath = path.resolve(scope.searchPath);
		const text = await repoMap({ path: searchPath, budget, signal });
		return toolResult<MapToolDetails>({ scopePath: scope.scopePath, budget }).text(text).done();
	}
}
