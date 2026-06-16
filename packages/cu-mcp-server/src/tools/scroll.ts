import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveCoordinate } from "../coordinates.js";
import { native } from "../native.js";
import { enforcePointUnderClick, enforcePreAction } from "../safety/enforcement.js";
import type { SessionState } from "../session.js";

function ok(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

function fail(text: string) {
	return { content: [{ type: "text" as const, text }], isError: true };
}

export function registerScrollTool(server: McpServer, session: SessionState) {
	server.registerTool(
		"scroll",
		{
			description: "Scroll at the given coordinate.",
			inputSchema: z.object({
				coordinate: z.tuple([z.number(), z.number()]),
				scroll_direction: z.enum(["up", "down", "left", "right"]),
				scroll_amount: z.number().int().min(0).max(100),
			}),
		},
		async ({ coordinate, scroll_direction, scroll_amount }) => {
			const tierError = await enforcePreAction(session, "mouse");
			if (tierError) {
				return fail(tierError);
			}

			const { x, y } = resolveCoordinate(coordinate[0], coordinate[1], session);
			const pointError = await enforcePointUnderClick(session, x, y, "mouse");
			if (pointError) return fail(pointError);

			const dx = scroll_direction === "left" ? scroll_amount : scroll_direction === "right" ? -scroll_amount : 0;
			const dy = scroll_direction === "up" ? scroll_amount : scroll_direction === "down" ? -scroll_amount : 0;

			await native.scroll(x, y, dx, dy);
			return ok("Scrolled.");
		},
	);
}
