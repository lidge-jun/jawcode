import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveCoordinate } from "../coordinates.js";
import { native } from "../native.js";
import { enforcePointUnderClick, enforcePreAction } from "../safety/enforcement.js";
import type { SessionState } from "../session.js";

// Factory (not a shared const): reusing one zod instance across two properties
// makes the JSON-schema serializer emit a `$ref` for the second, and the tuple
// `$ref` (`.../items/0`) is unresolvable under `prefixItems` — provider tool
// APIs (OpenAI, xAI) reject it with a 400 schema-validation error. A fresh
// instance per property inlines the schema and avoids the bad `$ref`.
const coordinateSchema = () =>
	z
		.tuple([z.number(), z.number()])
		.describe(
			"(x, y): Horizontal pixel position read directly from the most recent screenshot image, measured from the left edge. The server handles all scaling.",
		);

function ok(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

function fail(text: string) {
	return { content: [{ type: "text" as const, text }], isError: true };
}

type ClickConfig = {
	button: "left" | "right" | "middle";
	count: 1 | 2 | 3;
	category: "mouse" | "mouse_full";
	description: string;
};

function registerClickTool(server: McpServer, session: SessionState, name: string, config: ClickConfig) {
	server.registerTool(
		name,
		{
			description: config.description,
			inputSchema: z.object({
				coordinate: coordinateSchema(),
				text: z.string().optional().describe('Modifier keys to hold, e.g. "shift" or "ctrl+shift".'),
			}),
		},
		async ({ coordinate, text }) => {
			const category = text && text.trim().length > 0 ? "mouse_full" : config.category;
			const tierError = await enforcePreAction(session, category);
			if (tierError) {
				return fail(tierError);
			}

			const [rawX, rawY] = coordinate;
			const { x, y } = resolveCoordinate(rawX, rawY, session);
			const pointError = await enforcePointUnderClick(session, x, y, category);
			if (pointError) {
				return fail(pointError);
			}

			await native.click(x, y, config.button, config.count, text);
			return ok("Clicked.");
		},
	);
}

export function registerMouseTools(server: McpServer, session: SessionState) {
	registerClickTool(server, session, "left_click", {
		button: "left",
		count: 1,
		category: "mouse",
		description:
			"Left-click at the given (x, y) pixel coordinates. " +
			"PREFERRED over keyboard navigation for UI interaction: " +
			"take a screenshot first, locate the target element visually, " +
			"read its pixel position from the image, then call this tool " +
			"with coordinate=[x, y]. Use this for buttons, links, menus, " +
			"tabs, icons, and any clickable UI element.",
	});

	registerClickTool(server, session, "double_click", {
		button: "left",
		count: 2,
		category: "mouse",
		description: "Double-click at the given coordinates.",
	});

	registerClickTool(server, session, "triple_click", {
		button: "left",
		count: 3,
		category: "mouse",
		description: "Triple-click at the given coordinates.",
	});

	registerClickTool(server, session, "right_click", {
		button: "right",
		count: 1,
		category: "mouse_full",
		description: "Right-click at the given coordinates.",
	});

	registerClickTool(server, session, "middle_click", {
		button: "middle",
		count: 1,
		category: "mouse_full",
		description: "Middle-click at the given coordinates.",
	});

	server.registerTool(
		"left_click_drag",
		{
			description: "Press, drag, and release the left mouse button.",
			inputSchema: z.object({
				coordinate: coordinateSchema().describe("(x, y) drag end point."),
				start_coordinate: coordinateSchema()
					.optional()
					.describe("(x, y) drag start point. Omit to drag from the cursor."),
			}),
		},
		async ({ coordinate, start_coordinate }) => {
			const tierError = await enforcePreAction(session, "mouse_full");
			if (tierError) {
				return fail(tierError);
			}

			if (start_coordinate) {
				const start = resolveCoordinate(start_coordinate[0], start_coordinate[1], session);
				const startPointError = await enforcePointUnderClick(session, start.x, start.y, "mouse_full");
				if (startPointError) return fail(startPointError);
				await native.mouseMove(start.x, start.y, true);
			}

			const end = resolveCoordinate(coordinate[0], coordinate[1], session);
			const pointError = await enforcePointUnderClick(session, end.x, end.y, "mouse_full");
			if (pointError) return fail(pointError);

			await native.mouseDown();
			session.mouseButtonHeld = true;
			await native.mouseMove(end.x, end.y, true);
			await native.mouseUp();
			session.mouseButtonHeld = false;

			return ok("Dragged.");
		},
	);

	server.registerTool(
		"mouse_move",
		{
			description: "Move the mouse cursor without clicking.",
			inputSchema: z.object({
				coordinate: coordinateSchema(),
			}),
		},
		async ({ coordinate }) => {
			const tierError = await enforcePreAction(session, "mouse");
			if (tierError) {
				return fail(tierError);
			}

			const { x, y } = resolveCoordinate(coordinate[0], coordinate[1], session);
			const pointError = await enforcePointUnderClick(session, x, y, "mouse");
			if (pointError) return fail(pointError);
			await native.mouseMove(x, y, true);
			return ok("Moved.");
		},
	);

	server.registerTool(
		"left_mouse_down",
		{
			description: "Press and hold the left mouse button.",
			inputSchema: z.object({}),
		},
		async () => {
			if (session.mouseButtonHeld) {
				return fail("Mouse button is already held. Call left_mouse_up first.");
			}

			const tierError = await enforcePreAction(session, "mouse");
			if (tierError) {
				return fail(tierError);
			}

			await native.mouseDown();
			session.mouseButtonHeld = true;
			return ok("Mouse button held.");
		},
	);

	server.registerTool(
		"left_mouse_up",
		{
			description: "Release the left mouse button.",
			inputSchema: z.object({}),
		},
		async () => {
			const tierError = await enforcePreAction(session, "mouse");
			if (tierError) {
				return fail(tierError);
			}

			await native.mouseUp();
			session.mouseButtonHeld = false;
			return ok("Mouse button released.");
		},
	);
}
