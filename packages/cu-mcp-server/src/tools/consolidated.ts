/**
 * Consolidated single-tool registration — replaces 29 individual tools with
 * one `computer_use` tool using an `action` discriminator (hermes pattern).
 * Token savings: ~33K → ~3K (91%).
 *
 * Activated via `--consolidated` flag or `CU_MCP_MODE=consolidated` env.
 */

import { execFile as execFileCb } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveCoordinate } from "../coordinates.js";
import { native } from "../native.js";
import { type ActionCategory, enforcePointUnderClick, enforcePreAction } from "../safety/enforcement.js";
import { categoryToTier, getAppCategory, isFullTierOverride, isSystemKeyCombo } from "../safety/tiers.js";
import type { SessionState } from "../session.js";

const execFile = promisify(execFileCb);

// ── Types ──────────────────────────────────────────────────────────

type TextContent = { type: "text"; text: string };
type ImageContent = { type: "image"; data: string; mimeType: "image/jpeg" };
type Content = TextContent | ImageContent;
type ToolResponse = { content: Content[]; isError?: boolean };

type DisplayInfo = {
	id: number;
	originX: number;
	originY: number;
	width: number;
	height: number;
	isMain: boolean;
	name?: string;
};
type CaptureResult = {
	image: string;
	width: number;
	height: number;
	displayWidth: number;
	displayHeight: number;
	originX: number;
	originY: number;
};
type GrantTier = "full" | "click" | "read";
type GrantedApp = { bundleId: string; displayName: string; grantedAt: number; tier: GrantTier };
type SPDisplay = { _name?: string; _spdisplays_resolution?: string };
type SPGpu = { spdisplays_ndrvs?: SPDisplay[] };

// ── Helpers ─────────────────────────────────────────────────────────

function ok(t: string): ToolResponse {
	return { content: [{ type: "text", text: t }] };
}
function fail(t: string): ToolResponse {
	return { content: [{ type: "text", text: t }], isError: true };
}
function img(base64: string): ImageContent {
	return { type: "image", data: base64, mimeType: "image/jpeg" };
}

const SCREENSHOT_DIR = join("/tmp", "cu-mcp-screenshots");
async function saveImage(base64: string): Promise<string> {
	await mkdir(SCREENSHOT_DIR, { recursive: true });
	const p = join(SCREENSHOT_DIR, `${randomUUID()}.jpg`);
	await writeFile(p, Buffer.from(base64, "base64"));
	return p;
}

let cachedDisplayNames: Map<string, string> | null = null;
async function getDisplayNames(): Promise<Map<string, string>> {
	if (cachedDisplayNames) return cachedDisplayNames;
	const map = new Map<string, string>();
	try {
		const { stdout } = await execFile("system_profiler", ["SPDisplaysDataType", "-json"], { timeout: 5000 });
		const data = JSON.parse(stdout) as { SPDisplaysDataType?: SPGpu[] };
		for (const gpu of data.SPDisplaysDataType ?? []) {
			for (const d of gpu.spdisplays_ndrvs ?? []) {
				const name = d._name;
				const res = d._spdisplays_resolution;
				if (name && res) {
					const m = res.match(/^(\d+)\s*x\s*(\d+)/);
					if (m) map.set(`${m[1]}x${m[2]}`, name);
				}
			}
		}
		cachedDisplayNames = map;
	} catch {}
	return map;
}

async function enrichDisplays(displays: DisplayInfo[]): Promise<DisplayInfo[]> {
	const names = await getDisplayNames();
	return displays.map(d => ({
		...d,
		name: names.get(`${d.width}x${d.height}`) ?? (d.isMain ? "Main Display" : `Display ${d.id}`),
	}));
}

async function autoDisplayId(session: SessionState): Promise<number | undefined> {
	if (session.selectedDisplayId !== "auto") return session.selectedDisplayId;
	try {
		const displays = (await native.displayList()) as DisplayInfo[];
		if (displays.length <= 1) return undefined;
		const frontmost = (await native.appsFrontmost()) as { bundleId: string } | null;
		if (frontmost) {
			for (const d of displays) {
				try {
					const app = (await native.appsUnderPoint(d.originX + d.width / 2, d.originY + d.height / 2)) as {
						bundleId: string;
					} | null;
					if (app && app.bundleId === frontmost.bundleId) return d.id;
				} catch {}
			}
		}
		const mouse = (await native.mouseLocation()) as { x: number; y: number };
		for (const d of displays) {
			if (
				mouse.x >= d.originX &&
				mouse.x < d.originX + d.width &&
				mouse.y >= d.originY &&
				mouse.y < d.originY + d.height
			)
				return d.id;
		}
	} catch {}
	return undefined;
}

// ── Schema ──────────────────────────────────────────────────────────

const ACTIONS = [
	"capture",
	"click",
	"drag",
	"mouse_move",
	"mouse_down",
	"mouse_up",
	"scroll",
	"type",
	"key",
	"hold_key",
	"wait",
	"cursor_position",
	"switch_display",
	"inspect",
	"ax_press",
	"open_app",
	"request_access",
	"list_apps",
	"clipboard_read",
	"clipboard_write",
] as const;

const BATCH_ACTIONS = [
	"click",
	"drag",
	"mouse_move",
	"mouse_down",
	"mouse_up",
	"scroll",
	"type",
	"key",
	"hold_key",
	"wait",
	"cursor_position",
	"capture",
] as const;

const coordinate = () =>
	z
		.tuple([z.number(), z.number()])
		.describe(
			"(x, y): Horizontal pixel position read directly from the most recent screenshot image, measured from the left edge. The server handles all scaling.",
		);

const batchActionSchema = z.object({
	action: z.enum(BATCH_ACTIONS),
	coordinate: coordinate().optional(),
	start_coordinate: coordinate().optional(),
	text: z.string().optional().describe("type: text to type."),
	keys: z.string().optional().describe("key/hold_key: key combo e.g. 'cmd+s', 'return'."),
	modifiers: z.string().optional().describe("Modifier keys held during click, e.g. 'shift'."),
	button: z.enum(["left", "right", "middle"]).optional(),
	count: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
	scroll_direction: z.enum(["up", "down", "left", "right"]).optional(),
	scroll_amount: z.number().int().min(0).max(100).optional(),
	duration: z.number().min(0).max(100).optional(),
	repeat: z.number().int().min(1).max(100).optional(),
	save_to_disk: z.boolean().optional(),
});

const inputSchema = z.object({
	action: z
		.enum([...ACTIONS, "batch"])
		.describe(
			"Which action to perform. Preferred workflow: capture → inspect or read screenshot → click/type. " +
				"ALWAYS call capture before any click — read pixel coordinates from the screenshot image, then " +
				"pass them to click(coordinate=[x,y]).",
		),
	// capture
	mode: z
		.enum(["screenshot", "zoom"])
		.optional()
		.describe("capture: 'screenshot' (default) or 'zoom' for region crop."),
	region: z
		.tuple([z.number(), z.number(), z.number(), z.number()])
		.optional()
		.describe("capture mode=zoom: [x0,y0,x1,y1] from last screenshot."),
	save_to_disk: z.boolean().optional().describe("capture: save image to /tmp and return path."),
	// click/drag/scroll/inspect
	coordinate: coordinate().optional(),
	start_coordinate: coordinate().optional().describe("drag: start point. Omit to drag from cursor."),
	button: z.enum(["left", "right", "middle"]).optional().describe("click: mouse button. Default left."),
	count: z
		.union([z.literal(1), z.literal(2), z.literal(3)])
		.optional()
		.describe("click: 1=single, 2=double, 3=triple."),
	modifiers: z.string().optional().describe("Modifier keys held during click, e.g. 'shift' or 'ctrl+shift'."),
	// scroll
	scroll_direction: z.enum(["up", "down", "left", "right"]).optional(),
	scroll_amount: z.number().int().min(0).max(100).optional(),
	// type/key
	text: z.string().optional().describe("type: text to type. clipboard_write: text to write."),
	keys: z.string().optional().describe("key/hold_key: key combo, e.g. 'cmd+s', 'return', 'escape'."),
	duration: z.number().min(0).max(100).optional().describe("hold_key/wait: seconds."),
	repeat: z.number().int().min(1).max(100).optional().describe("key: repeat count."),
	// switch_display
	display: z.string().optional().describe('switch_display: monitor name or "auto".'),
	// app/access
	app: z.string().optional().describe("open_app: display name or bundle ID."),
	apps: z.array(z.string()).optional().describe("request_access: apps to grant."),
	reason: z.string().optional().describe("request_access: one-sentence task explanation."),
	clipboard_read: z.boolean().optional().describe("request_access: also grant clipboard read."),
	clipboard_write: z.boolean().optional().describe("request_access: also grant clipboard write."),
	system_key_combos: z.boolean().optional().describe("request_access: also grant system key combos."),
	// batch
	actions: z.array(batchActionSchema).optional().describe("batch: ordered list of sub-actions."),
});

type Input = z.infer<typeof inputSchema>;

// ── Handlers ────────────────────────────────────────────────────────

async function handleCapture(input: Input, session: SessionState): Promise<ToolResponse> {
	if (input.mode === "zoom") {
		if (!session.lastScreenshot) return fail("Take a screenshot first.");
		if (!input.region) return fail("zoom requires region [x0,y0,x1,y1].");
		const meta = session.lastScreenshot;
		const [rawX0, rawY0, rawX1, rawY1] = input.region;
		const x0 = Math.min(rawX0, rawX1),
			y0 = Math.min(rawY0, rawY1);
		const x1 = Math.max(rawX0, rawX1),
			y1 = Math.max(rawY0, rawY1);
		const scaleX = meta.displayWidth / meta.width,
			scaleY = meta.displayHeight / meta.height;
		const result = (await native.screenshotRegion({
			displayId: await autoDisplayId(session),
			allowedBundleIds: [...session.allowedApps.keys()],
			x: meta.originX + x0 * scaleX,
			y: meta.originY + y0 * scaleY,
			width: Math.max(1, (x1 - x0) * scaleX),
			height: Math.max(1, (y1 - y0) * scaleY),
			outWidth: 1200,
			outHeight: 900,
			quality: 0.85,
		})) as CaptureResult;
		const content: Content[] = [img(result.image)];
		if (input.save_to_disk) content.push({ type: "text", text: `Saved to: ${await saveImage(result.image)}` });
		return { content };
	}

	// default: screenshot
	if (session.allowedApps.size === 0) return fail("No apps in allowlist. Call request_access first.");
	const result = (await native.screenshot({
		displayId: await autoDisplayId(session),
		allowedBundleIds: [...session.allowedApps.keys()],
		quality: 0.75,
		maxWidth: 1568,
		maxHeight: 1568,
	})) as CaptureResult;
	session.lastScreenshot = {
		width: result.width,
		height: result.height,
		displayWidth: result.displayWidth,
		displayHeight: result.displayHeight,
		originX: result.originX,
		originY: result.originY,
	};

	const content: Content[] = [img(result.image)];
	const rawDisplays = (await native.displayList()) as DisplayInfo[];
	if (rawDisplays.length > 1) {
		const displays = await enrichDisplays(rawDisplays);
		const captured = displays.find(d => d.originX === result.originX && d.originY === result.originY);
		const others = displays
			.filter(d => d !== captured)
			.map(d => `"${d.name}"`)
			.join(", ");
		const note = captured
			? `Multi-monitor: captured "${captured.name}" (${captured.width}x${captured.height}). Other monitors: [${others}]. Use switch_display with a monitor name.`
			: `Multi-monitor: available monitors: [${displays.map(d => `"${d.name}"`).join(", ")}].`;
		content.push({ type: "text", text: note });
	}
	if (input.save_to_disk) content.push({ type: "text", text: `Saved to: ${await saveImage(result.image)}` });
	return { content };
}

async function handleClick(input: Input, session: SessionState): Promise<ToolResponse> {
	if (!input.coordinate) return fail("click requires coordinate.");
	const button = input.button ?? "left";
	const count = input.count ?? 1;
	const category: ActionCategory = button !== "left" || input.modifiers ? "mouse_full" : "mouse";
	const tierError = await enforcePreAction(session, category);
	if (tierError) return fail(tierError);
	const { x, y } = resolveCoordinate(input.coordinate[0], input.coordinate[1], session);
	const pointError = await enforcePointUnderClick(session, x, y, category === "mouse_full" ? "mouse_full" : "mouse");
	if (pointError) return fail(pointError);
	await native.click(x, y, button, count, input.modifiers);
	return ok("Clicked.");
}

async function handleDrag(input: Input, session: SessionState): Promise<ToolResponse> {
	if (!input.coordinate) return fail("drag requires coordinate (end point).");
	const tierError = await enforcePreAction(session, "mouse_full");
	if (tierError) return fail(tierError);
	if (input.start_coordinate) {
		const start = resolveCoordinate(input.start_coordinate[0], input.start_coordinate[1], session);
		const startErr = await enforcePointUnderClick(session, start.x, start.y, "mouse_full");
		if (startErr) return fail(startErr);
		await native.mouseMove(start.x, start.y, true);
	}
	const end = resolveCoordinate(input.coordinate[0], input.coordinate[1], session);
	const pointError = await enforcePointUnderClick(session, end.x, end.y, "mouse_full");
	if (pointError) return fail(pointError);
	try {
		await native.mouseDown();
		session.mouseButtonHeld = true;
		await native.mouseMove(end.x, end.y, true);
		await native.mouseUp();
	} finally {
		session.mouseButtonHeld = false;
	}
	return ok("Dragged.");
}

async function handleMouseMove(input: Input, session: SessionState): Promise<ToolResponse> {
	if (!input.coordinate) return fail("mouse_move requires coordinate.");
	const tierError = await enforcePreAction(session, "mouse");
	if (tierError) return fail(tierError);
	const { x, y } = resolveCoordinate(input.coordinate[0], input.coordinate[1], session);
	const pointError = await enforcePointUnderClick(session, x, y, "mouse");
	if (pointError) return fail(pointError);
	await native.mouseMove(x, y, true);
	return ok("Moved.");
}

async function handleMouseDown(session: SessionState): Promise<ToolResponse> {
	if (session.mouseButtonHeld) return fail("Mouse button is already held.");
	const tierError = await enforcePreAction(session, "mouse");
	if (tierError) return fail(tierError);
	await native.mouseDown();
	session.mouseButtonHeld = true;
	return ok("Mouse button held.");
}

async function handleMouseUp(session: SessionState): Promise<ToolResponse> {
	const tierError = await enforcePreAction(session, "mouse");
	if (tierError) return fail(tierError);
	await native.mouseUp();
	session.mouseButtonHeld = false;
	return ok("Mouse button released.");
}

async function handleScroll(input: Input, session: SessionState): Promise<ToolResponse> {
	if (!input.coordinate || !input.scroll_direction) return fail("scroll requires coordinate and scroll_direction.");
	const tierError = await enforcePreAction(session, "mouse");
	if (tierError) return fail(tierError);
	const { x, y } = resolveCoordinate(input.coordinate[0], input.coordinate[1], session);
	const pointError = await enforcePointUnderClick(session, x, y, "mouse");
	if (pointError) return fail(pointError);
	const amount = input.scroll_amount ?? 3;
	const dx = input.scroll_direction === "left" ? amount : input.scroll_direction === "right" ? -amount : 0;
	const dy = input.scroll_direction === "up" ? amount : input.scroll_direction === "down" ? -amount : 0;
	await native.scroll(x, y, dx, dy);
	return ok("Scrolled.");
}

async function handleType(input: Input, session: SessionState): Promise<ToolResponse> {
	if (!input.text) return fail("type requires text.");
	const tierError = await enforcePreAction(session, "keyboard");
	if (tierError) return fail(tierError);
	const viaClipboard = (input.text.includes("\n") || input.text.includes("\r")) && session.grantFlags.clipboardWrite;
	await native.type(input.text, viaClipboard);
	const graphemes = [...new Intl.Segmenter().segment(input.text)].length;
	return ok(`Typed ${graphemes} grapheme(s).`);
}

async function handleKey(input: Input, session: SessionState): Promise<ToolResponse> {
	if (!input.keys) return fail("key requires keys (e.g. 'cmd+s', 'return').");
	const tierError = await enforcePreAction(session, "keyboard");
	if (tierError) return fail(tierError);
	if (isSystemKeyCombo(input.keys) && !session.grantFlags.systemKeyCombos) {
		return fail(`"${input.keys}" is a system-level shortcut. Request the systemKeyCombos grant.`);
	}
	await native.key(input.keys, input.repeat ?? 1);
	return ok("Key pressed.");
}

async function handleHoldKey(input: Input, session: SessionState): Promise<ToolResponse> {
	if (!input.keys || input.duration == null) return fail("hold_key requires keys and duration.");
	const tierError = await enforcePreAction(session, "keyboard");
	if (tierError) return fail(tierError);
	if (isSystemKeyCombo(input.keys) && !session.grantFlags.systemKeyCombos) {
		return fail(`"${input.keys}" is a system-level shortcut. Request the systemKeyCombos grant.`);
	}
	await native.holdKey(input.keys, input.duration);
	return ok("Key held.");
}

async function handleWait(input: Input): Promise<ToolResponse> {
	const duration = input.duration ?? 1;
	await new Promise(resolve => setTimeout(resolve, duration * 1000));
	return ok(`Waited ${duration} seconds.`);
}

async function handleCursorPosition(session: SessionState): Promise<ToolResponse> {
	const loc = (await native.mouseLocation()) as { x: number; y: number };
	const meta = session.lastScreenshot;
	if (meta) {
		return ok(
			JSON.stringify({
				x: (loc.x - meta.originX) * (meta.width / meta.displayWidth),
				y: (loc.y - meta.originY) * (meta.height / meta.displayHeight),
			}),
		);
	}
	return ok(JSON.stringify(loc));
}

async function handleSwitchDisplay(input: Input, session: SessionState): Promise<ToolResponse> {
	if (!input.display) return fail("switch_display requires display (monitor name or 'auto').");
	if (input.display === "auto") {
		session.selectedDisplayId = "auto";
		return ok("Returned to automatic monitor selection. Call capture to continue.");
	}
	const rawDisplays = (await native.displayList()) as DisplayInfo[];
	const displays = await enrichDisplays(rawDisplays);
	const q = input.display.toLowerCase();
	const match =
		displays.find(d => d.name?.toLowerCase() === q) ?? displays.find(d => d.name?.toLowerCase().includes(q));
	if (!match) {
		const names = displays.map(d => `"${d.name}"`).join(", ");
		return fail(`Monitor "${input.display}" not found. Available: [${names}].`);
	}
	session.selectedDisplayId = match.id;
	return ok(`Switched to "${match.name}" (${match.width}x${match.height}). Call capture to see it.`);
}

async function handleInspect(input: Input, session: SessionState): Promise<ToolResponse> {
	if (!input.coordinate) return fail("inspect requires coordinate.");
	const tierError = await enforcePreAction(session, "mouse");
	if (tierError) return fail(tierError);
	const { x, y } = resolveCoordinate(input.coordinate[0], input.coordinate[1], session);
	const pointError = await enforcePointUnderClick(session, x, y, "mouse");
	if (pointError) return fail(pointError);
	try {
		const result = await native.inspect(x, y);
		return ok(JSON.stringify(result, null, 2));
	} catch (err: any) {
		return fail(`Inspect failed: ${err.message ?? err}`);
	}
}

async function handleAxPress(input: Input, session: SessionState): Promise<ToolResponse> {
	if (!input.coordinate) return fail("ax_press requires coordinate.");
	const tierError = await enforcePreAction(session, "mouse_full");
	if (tierError) return fail(tierError);
	const { x, y } = resolveCoordinate(input.coordinate[0], input.coordinate[1], session);
	const pointError = await enforcePointUnderClick(session, x, y, "mouse_full");
	if (pointError) return fail(pointError);
	try {
		const result = await native.inspect(x, y, true);
		if (result?.pressed) {
			return ok(`Pressed element: ${result?.inspect?.role ?? "unknown"} "${result?.inspect?.title ?? ""}"`);
		}
		return fail(`AX press failed at (${x}, ${y}).`);
	} catch (err: any) {
		return fail(`AX press failed: ${err.message ?? err}`);
	}
}

async function handleOpenApp(input: Input, session: SessionState): Promise<ToolResponse> {
	if (!input.app) return fail("open_app requires app name or bundle ID.");
	const resolved = (await native.appsResolve([input.app])) as Array<{
		name: string;
		bundleId: string | null;
		installed: boolean;
	}>;
	const target = resolved[0];
	if (!target?.installed || !target.bundleId) return fail(`Application "${input.app}" not found.`);
	if (!session.allowedApps.has(target.bundleId))
		return fail(`"${target.name}" is not granted. Call request_access first.`);
	await native.appsOpen(target.bundleId);
	return ok(`Opened "${target.name}".`);
}

async function handleRequestAccess(input: Input, session: SessionState): Promise<ToolResponse> {
	if (!input.apps || !input.reason) return fail("request_access requires apps and reason.");
	const resolved = (await native.appsResolve(input.apps)) as Array<{
		name: string;
		bundleId: string | null;
		installed: boolean;
	}>;
	const grantedAt = Date.now();
	const granted: Array<{ bundleId: string; displayName: string; grantedAt: number; tier: string }> = [];
	const denied: Array<{ bundleId: string; reason: string }> = [];
	for (const entry of resolved) {
		if (!entry.installed || !entry.bundleId) {
			denied.push({ bundleId: entry.bundleId ?? entry.name, reason: "not_installed" });
			continue;
		}
		const category = getAppCategory(entry.bundleId);
		const tier = categoryToTier(category);
		if (!tier) {
			denied.push({ bundleId: entry.bundleId, reason: "media_blocked" });
			continue;
		}
		const grant = { bundleId: entry.bundleId, displayName: entry.name, grantedAt, tier } satisfies GrantedApp;
		session.allowedApps.set(entry.bundleId, grant);
		granted.push(grant);
	}
	session.grantFlags.clipboardRead = session.grantFlags.clipboardRead || Boolean(input.clipboard_read);
	session.grantFlags.clipboardWrite = session.grantFlags.clipboardWrite || Boolean(input.clipboard_write);
	session.grantFlags.systemKeyCombos = session.grantFlags.systemKeyCombos || Boolean(input.system_key_combos);
	const tierGuidance = isFullTierOverride()
		? "CU_TIER_OVERRIDE=full active — all apps granted full tier (personal-use)"
		: "browser=read, terminal=click, other=full, media=blocked";
	return ok(JSON.stringify({ granted, denied, tierGuidance }, null, 2));
}

async function handleListApps(session: SessionState): Promise<ToolResponse> {
	const granted = [...session.allowedApps.values()];
	return ok(
		JSON.stringify({ granted, grantFlags: session.grantFlags, coordinateMode: session.coordinateMode }, null, 2),
	);
}

async function handleClipboardRead(session: SessionState): Promise<ToolResponse> {
	if (!session.grantFlags.clipboardRead) return fail("clipboardRead grant required.");
	const result = (await native.clipboardRead()) as { text: string };
	return ok(result.text);
}

async function handleClipboardWrite(input: Input, session: SessionState): Promise<ToolResponse> {
	if (!session.grantFlags.clipboardWrite) return fail("clipboardWrite grant required.");
	if (!input.text) return fail("clipboard_write requires text.");
	await native.clipboardWrite(input.text);
	return ok("Written to clipboard.");
}

async function handleBatch(input: Input, session: SessionState): Promise<ToolResponse> {
	if (!input.actions || input.actions.length === 0) return fail("batch requires a non-empty actions array.");
	const completed: Array<{ action: string; ok: boolean; output: string }> = [];
	let latestImage: string | undefined;

	for (const sub of input.actions) {
		try {
			const mapped: Input = {
				action: sub.action as Input["action"],
				coordinate: sub.coordinate,
				start_coordinate: sub.start_coordinate,
				text: sub.text,
				keys: sub.keys,
				modifiers: sub.modifiers,
				button: sub.button,
				count: sub.count,
				scroll_direction: sub.scroll_direction,
				scroll_amount: sub.scroll_amount,
				duration: sub.duration,
				repeat: sub.repeat,
				save_to_disk: sub.save_to_disk,
			};
			const result = await dispatch(mapped, session);
			const textContent = result.content.find(c => c.type === "text") as TextContent | undefined;
			const imageContent = result.content.find(c => c.type === "image") as ImageContent | undefined;
			if (imageContent) latestImage = imageContent.data;
			if (result.isError) throw new Error(textContent?.text ?? "Action failed.");
			completed.push({ action: sub.action, ok: true, output: textContent?.text ?? "" });
		} catch (error) {
			completed.push({
				action: sub.action,
				ok: false,
				output: error instanceof Error ? error.message : String(error),
			});
			const content: Content[] = [{ type: "text", text: JSON.stringify({ completed }) }];
			if (latestImage) content.push(img(latestImage));
			return { content, isError: true };
		}
	}

	const content: Content[] = [{ type: "text", text: JSON.stringify({ completed }) }];
	if (latestImage) content.push(img(latestImage));
	return { content };
}

// ── Dispatch ────────────────────────────────────────────────────────

async function dispatch(input: Input, session: SessionState): Promise<ToolResponse> {
	switch (input.action) {
		case "capture":
			return handleCapture(input, session);
		case "click":
			return handleClick(input, session);
		case "drag":
			return handleDrag(input, session);
		case "mouse_move":
			return handleMouseMove(input, session);
		case "mouse_down":
			return handleMouseDown(session);
		case "mouse_up":
			return handleMouseUp(session);
		case "scroll":
			return handleScroll(input, session);
		case "type":
			return handleType(input, session);
		case "key":
			return handleKey(input, session);
		case "hold_key":
			return handleHoldKey(input, session);
		case "wait":
			return handleWait(input);
		case "cursor_position":
			return handleCursorPosition(session);
		case "switch_display":
			return handleSwitchDisplay(input, session);
		case "inspect":
			return handleInspect(input, session);
		case "ax_press":
			return handleAxPress(input, session);
		case "open_app":
			return handleOpenApp(input, session);
		case "request_access":
			return handleRequestAccess(input, session);
		case "list_apps":
			return handleListApps(session);
		case "clipboard_read":
			return handleClipboardRead(session);
		case "clipboard_write":
			return handleClipboardWrite(input, session);
		case "batch":
			return handleBatch(input, session);
		default:
			return fail(`Unknown action: ${(input as any).action}`);
	}
}

// ── Registration ────────────────────────────────────────────────────

export function registerConsolidatedTool(server: McpServer, session: SessionState) {
	server.registerTool(
		"computer_use",
		{
			description:
				"Drive the macOS desktop — screenshots, mouse, keyboard, scroll, app management. " +
				"Preferred workflow: capture → visually locate target in screenshot → click(coordinate=[x,y]). " +
				"ALWAYS call capture before click. For batch sequences, use action='batch' with an actions array.",
			inputSchema,
		},
		async args => dispatch(args as unknown as Input, session),
	);
}
