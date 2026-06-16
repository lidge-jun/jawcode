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

export function registerInspectTools(server: McpServer, session: SessionState) {
	server.registerTool(
		"inspect",
		{
			description:
				"AX hit-test: inspect the UI element at given coordinates. Returns role, title, description, available actions. Use before clicking to verify what is under the point.",
			inputSchema: z.object({
				coordinate: z.tuple([z.number(), z.number()]).describe("(x, y) in screenshot pixel coordinates."),
			}),
		},
		async ({ coordinate }) => {
			const tierError = await enforcePreAction(session, "mouse");
			if (tierError) return fail(tierError);
			const { x, y } = resolveCoordinate(coordinate[0], coordinate[1], session);
			const pointError = await enforcePointUnderClick(session, x, y, "mouse");
			if (pointError) return fail(pointError);
			try {
				const result = await native.inspect(x, y);
				return ok(JSON.stringify(result, null, 2));
			} catch (err: any) {
				return fail(`Inspect failed: ${err.message ?? err}`);
			}
		},
	);

	server.registerTool(
		"ax_press",
		{
			description:
				"Semantic press: perform the AX press action on the element at given coordinates. Prefer this over click for buttons and controls.",
			inputSchema: z.object({
				coordinate: z.tuple([z.number(), z.number()]).describe("(x, y) in screenshot pixel coordinates."),
			}),
		},
		async ({ coordinate }) => {
			const tierError = await enforcePreAction(session, "mouse_full");
			if (tierError) return fail(tierError);
			const { x, y } = resolveCoordinate(coordinate[0], coordinate[1], session);
			const pointError = await enforcePointUnderClick(session, x, y, "mouse_full");
			if (pointError) return fail(pointError);
			try {
				const result = await native.inspect(x, y, true);
				if (result?.pressed) {
					return ok(`Pressed element: ${result?.inspect?.role ?? "unknown"} "${result?.inspect?.title ?? ""}"`);
				}
				return fail(
					`AX press failed at (${x}, ${y}). Element: ${result?.inspect?.role ?? "unknown"} "${result?.inspect?.title ?? ""}". Actions: ${(result?.inspect?.actions ?? []).join(", ")}`,
				);
			} catch (err: any) {
				return fail(`AX press failed: ${err.message ?? err}`);
			}
		},
	);
}
