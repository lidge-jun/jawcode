import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveCoordinate } from "../coordinates.js";
import { native } from "../native.js";
import { type ActionCategory, enforcePointUnderClick, enforcePreAction } from "../safety/enforcement.js";
import { isSystemKeyCombo } from "../safety/tiers.js";
import type { ScreenshotMeta, SessionState } from "../session.js";

type BatchAction = z.infer<typeof actionSchema>;
type CaptureResult = {
	image: string;
	width: number;
	height: number;
	displayWidth: number;
	displayHeight: number;
	originX: number;
	originY: number;
};

const coordinateSchema = z.tuple([z.number(), z.number()]);
const actionSchema = z.object({
	action: z.enum([
		"key",
		"type",
		"mouse_move",
		"left_click",
		"left_click_drag",
		"right_click",
		"middle_click",
		"double_click",
		"triple_click",
		"scroll",
		"hold_key",
		"screenshot",
		"cursor_position",
		"left_mouse_down",
		"left_mouse_up",
		"wait",
	]),
	coordinate: coordinateSchema.optional(),
	start_coordinate: coordinateSchema.optional(),
	text: z.string().optional(),
	scroll_direction: z.enum(["up", "down", "left", "right"]).optional(),
	scroll_amount: z.number().int().min(0).max(100).optional(),
	duration: z.number().min(0).max(100).optional(),
	repeat: z.number().int().min(1).max(100).optional(),
});

function successResult(
	text: string,
	completed: Array<{ action: string; ok: boolean; output: string }>,
	image?: string,
) {
	const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: "image/jpeg" }> = [
		{ type: "text", text },
	];

	if (image) {
		content.push({ type: "image", data: image, mimeType: "image/jpeg" });
	}

	return {
		content,
		structuredContent: { completed },
	};
}

function errorResult(
	message: string,
	completed: Array<{ action: string; ok: boolean; output: string }>,
	image?: string,
) {
	const result = successResult(JSON.stringify({ completed }), completed, image);
	result.content.push({ type: "text", text: message });
	return { ...result, isError: true };
}

function basisState(session: SessionState, basis: ScreenshotMeta | null) {
	return { ...session, lastScreenshot: basis } as SessionState;
}

function displayIdFor(session: SessionState) {
	return session.selectedDisplayId === "auto" ? undefined : session.selectedDisplayId;
}

function convertCursorPosition(location: { x: number; y: number }, meta: ScreenshotMeta | null) {
	if (!meta) {
		return location;
	}

	return {
		x: (location.x - meta.originX) * (meta.width / meta.displayWidth),
		y: (location.y - meta.originY) * (meta.height / meta.displayHeight),
	};
}

function requireCoordinate(action: BatchAction) {
	if (!action.coordinate) {
		throw new Error(`Action "${action.action}" requires coordinate.`);
	}
	return action.coordinate;
}

function requireText(action: BatchAction) {
	if (action.text == null) {
		throw new Error(`Action "${action.action}" requires text.`);
	}
	return action.text;
}

function requireDuration(action: BatchAction) {
	if (action.duration == null) {
		throw new Error(`Action "${action.action}" requires duration.`);
	}
	return action.duration;
}

async function executeAction(
	action: BatchAction,
	session: SessionState,
	basis: ScreenshotMeta | null,
	latestScreenshot: { current: ScreenshotMeta | null; image?: string },
) {
	const frozenState = basisState(session, basis);

	switch (action.action) {
		case "key": {
			const tierError = await enforcePreAction(session, "keyboard");
			if (tierError) throw new Error(tierError);
			const text = requireText(action);
			if (isSystemKeyCombo(text) && !session.grantFlags.systemKeyCombos) {
				throw new Error(
					`"${text}" is a system-level shortcut. Request the \`systemKeyCombos\` grant via request_access to use it.`,
				);
			}
			await native.key(text, action.repeat ?? 1);
			return "Key pressed.";
		}
		case "type": {
			const tierError = await enforcePreAction(session, "keyboard");
			if (tierError) throw new Error(tierError);
			const text = requireText(action);
			const viaClipboard = (text.includes("\n") || text.includes("\r")) && session.grantFlags.clipboardWrite;
			await native.type(text, viaClipboard);
			const segmenter = new Intl.Segmenter();
			return `Typed ${[...segmenter.segment(text)].length} grapheme(s).`;
		}
		case "mouse_move": {
			const tierError = await enforcePreAction(session, "mouse");
			if (tierError) throw new Error(tierError);
			const coordinate = requireCoordinate(action);
			const resolved = resolveCoordinate(coordinate[0], coordinate[1], frozenState);
			const pointError = await enforcePointUnderClick(session, resolved.x, resolved.y, "mouse");
			if (pointError) throw new Error(pointError);
			await native.mouseMove(resolved.x, resolved.y, true);
			return "Moved.";
		}
		case "left_click":
		case "right_click":
		case "middle_click":
		case "double_click":
		case "triple_click": {
			const category: ActionCategory =
				action.action === "right_click" || action.action === "middle_click" || action.text ? "mouse_full" : "mouse";
			const tierError = await enforcePreAction(session, category);
			if (tierError) throw new Error(tierError);
			const coordinate = requireCoordinate(action);
			const resolved = resolveCoordinate(coordinate[0], coordinate[1], frozenState);
			const pointError = await enforcePointUnderClick(
				session,
				resolved.x,
				resolved.y,
				category === "mouse_full" ? "mouse_full" : "mouse",
			);
			if (pointError) throw new Error(pointError);
			const config =
				action.action === "left_click"
					? { button: "left", count: 1 as const }
					: action.action === "right_click"
						? { button: "right", count: 1 as const }
						: action.action === "middle_click"
							? { button: "middle", count: 1 as const }
							: action.action === "double_click"
								? { button: "left", count: 2 as const }
								: { button: "left", count: 3 as const };
			await native.click(resolved.x, resolved.y, config.button, config.count, action.text);
			return "Clicked.";
		}
		case "left_click_drag": {
			const tierError = await enforcePreAction(session, "mouse_full");
			if (tierError) throw new Error(tierError);
			if (action.start_coordinate) {
				const start = resolveCoordinate(action.start_coordinate[0], action.start_coordinate[1], frozenState);
				const startPointError = await enforcePointUnderClick(session, start.x, start.y, "mouse_full");
				if (startPointError) throw new Error(startPointError);
				await native.mouseMove(start.x, start.y, true);
			}

			const endCoordinate = requireCoordinate(action);
			const end = resolveCoordinate(endCoordinate[0], endCoordinate[1], frozenState);
			const pointError = await enforcePointUnderClick(session, end.x, end.y, "mouse_full");
			if (pointError) throw new Error(pointError);

			await native.mouseDown();
			session.mouseButtonHeld = true;
			await native.mouseMove(end.x, end.y, true);
			await native.mouseUp();
			session.mouseButtonHeld = false;
			return "Dragged.";
		}
		case "scroll": {
			const tierError = await enforcePreAction(session, "mouse");
			if (tierError) throw new Error(tierError);
			const coordinate = requireCoordinate(action);
			const resolved = resolveCoordinate(coordinate[0], coordinate[1], frozenState);
			const scrollPointError = await enforcePointUnderClick(session, resolved.x, resolved.y, "mouse");
			if (scrollPointError) throw new Error(scrollPointError);
			const amount = action.scroll_amount ?? 0;
			const dx = action.scroll_direction === "left" ? amount : action.scroll_direction === "right" ? -amount : 0;
			const dy = action.scroll_direction === "up" ? amount : action.scroll_direction === "down" ? -amount : 0;
			await native.scroll(resolved.x, resolved.y, dx, dy);
			return "Scrolled.";
		}
		case "hold_key": {
			const tierError = await enforcePreAction(session, "keyboard");
			if (tierError) throw new Error(tierError);
			const text = requireText(action);
			if (isSystemKeyCombo(text) && !session.grantFlags.systemKeyCombos) {
				throw new Error(
					`"${text}" is a system-level shortcut. Request the \`systemKeyCombos\` grant via request_access to use it.`,
				);
			}
			await native.holdKey(text, requireDuration(action));
			return "Key held.";
		}
		case "screenshot": {
			if (session.allowedApps.size === 0) {
				throw new Error("No apps in allowlist. Call request_access first.");
			}

			const result = (await native.screenshot({
				displayId: displayIdFor(session),
				allowedBundleIds: [...session.allowedApps.keys()],
				quality: 0.75,
				maxWidth: 1568,
				maxHeight: 1568,
			})) as CaptureResult;

			latestScreenshot.current = {
				width: result.width,
				height: result.height,
				displayWidth: result.displayWidth,
				displayHeight: result.displayHeight,
				originX: result.originX,
				originY: result.originY,
			};
			latestScreenshot.image = result.image;
			return "";
		}
		case "cursor_position": {
			const location = (await native.mouseLocation()) as { x: number; y: number };
			return JSON.stringify(convertCursorPosition(location, basis));
		}
		case "left_mouse_down": {
			const tierError = await enforcePreAction(session, "mouse");
			if (tierError) throw new Error(tierError);
			if (session.mouseButtonHeld) {
				throw new Error("Mouse button is already held. Call left_mouse_up first.");
			}
			await native.mouseDown();
			session.mouseButtonHeld = true;
			return "Mouse button held.";
		}
		case "left_mouse_up": {
			const tierError = await enforcePreAction(session, "mouse");
			if (tierError) throw new Error(tierError);
			await native.mouseUp();
			session.mouseButtonHeld = false;
			return "Mouse button released.";
		}
		case "wait": {
			const duration = requireDuration(action);
			await new Promise(resolve => setTimeout(resolve, duration * 1000));
			return `Waited ${duration} seconds.`;
		}
	}
}

export function registerBatchTool(server: McpServer, session: SessionState) {
	server.registerTool(
		"computer_batch",
		{
			description: "Execute a predictable sequence of computer-use actions in one tool call.",
			inputSchema: z.object({
				actions: z.array(actionSchema),
			}),
		},
		async ({ actions }) => {
			const completed: Array<{ action: string; ok: boolean; output: string }> = [];
			const frozenBasis = session.lastScreenshot;
			const latestScreenshot: { current: ScreenshotMeta | null; image?: string } = {
				current: frozenBasis,
			};

			for (const action of actions) {
				try {
					const output = await executeAction(action, session, frozenBasis, latestScreenshot);
					completed.push({ action: action.action, ok: true, output });
				} catch (error) {
					session.lastScreenshot = latestScreenshot.current;
					return errorResult(
						error instanceof Error ? error.message : String(error),
						completed,
						latestScreenshot.image,
					);
				}
			}

			session.lastScreenshot = latestScreenshot.current;
			return successResult(JSON.stringify({ completed }), completed, latestScreenshot.image);
		},
	);
}
