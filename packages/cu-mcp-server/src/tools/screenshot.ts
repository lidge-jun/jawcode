import { execFile as execFileCb } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { native } from "../native.js";
import type { SessionState } from "../session.js";

const execFile = promisify(execFileCb);

type CaptureResult = {
	image: string;
	width: number;
	height: number;
	displayWidth: number;
	displayHeight: number;
	originX: number;
	originY: number;
};

function imageContent(base64: string) {
	return {
		type: "image" as const,
		data: base64,
		mimeType: "image/jpeg" as const,
	};
}

type TextContent = { type: "text"; text: string };
type ImageContent = { type: "image"; data: string; mimeType: "image/jpeg" };
type Content = TextContent | ImageContent;

function text(t: string): TextContent {
	return { type: "text", text: t };
}

function ok(t: string) {
	return { content: [text(t)] };
}

function fail(t: string) {
	return { content: [text(t)], isError: true };
}

type DisplayInfo = {
	id: number;
	originX: number;
	originY: number;
	width: number;
	height: number;
	isMain: boolean;
	name?: string;
};

type SPDisplay = { _name?: string; spdisplays_main?: string; _spdisplays_resolution?: string };
type SPGpu = { spdisplays_ndrvs?: SPDisplay[] };

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

function findDisplayByName(displays: DisplayInfo[], query: string): DisplayInfo | undefined {
	if (query === "auto") return undefined;
	const q = query.toLowerCase();
	return displays.find(d => d.name?.toLowerCase() === q) ?? displays.find(d => d.name?.toLowerCase().includes(q));
}

async function displayIdFor(session: SessionState): Promise<number | undefined> {
	if (session.selectedDisplayId !== "auto") return session.selectedDisplayId;

	try {
		const displays = (await native.displayList()) as DisplayInfo[];
		if (displays.length <= 1) return undefined;

		// Strategy 1: find which display the frontmost app is on
		const frontmost = (await native.appsFrontmost()) as { bundleId: string } | null;
		if (frontmost) {
			for (const d of displays) {
				const cx = d.originX + d.width / 2;
				const cy = d.originY + d.height / 2;
				try {
					const app = (await native.appsUnderPoint(cx, cy)) as { bundleId: string } | null;
					if (app && app.bundleId === frontmost.bundleId) return d.id;
				} catch {}
			}
		}

		// Strategy 2: fall back to mouse cursor position
		const mouse = (await native.mouseLocation()) as { x: number; y: number };
		for (const d of displays) {
			if (
				mouse.x >= d.originX &&
				mouse.x < d.originX + d.width &&
				mouse.y >= d.originY &&
				mouse.y < d.originY + d.height
			) {
				return d.id;
			}
		}
	} catch {}

	return undefined;
}

function allowedBundleIds(session: SessionState) {
	return [...session.allowedApps.keys()];
}

function updateScreenshotMeta(session: SessionState, result: CaptureResult) {
	session.lastScreenshot = {
		width: result.width,
		height: result.height,
		displayWidth: result.displayWidth,
		displayHeight: result.displayHeight,
		originX: result.originX,
		originY: result.originY,
	};
}

const SCREENSHOT_DIR = join("/tmp", "cu-mcp-screenshots");

async function saveImage(base64: string): Promise<string> {
	await mkdir(SCREENSHOT_DIR, { recursive: true });
	const filePath = join(SCREENSHOT_DIR, `${randomUUID()}.jpg`);
	await writeFile(filePath, Buffer.from(base64, "base64"));
	return filePath;
}

function regionToDisplaySpace(session: SessionState, region: [number, number, number, number]) {
	const meta = session.lastScreenshot;
	if (!meta) {
		throw new Error("Take a screenshot first.");
	}

	const [rawX0, rawY0, rawX1, rawY1] = region;
	const x0 = Math.min(rawX0, rawX1);
	const y0 = Math.min(rawY0, rawY1);
	const x1 = Math.max(rawX0, rawX1);
	const y1 = Math.max(rawY0, rawY1);
	const scaleX = meta.displayWidth / meta.width;
	const scaleY = meta.displayHeight / meta.height;

	return {
		x: meta.originX + x0 * scaleX,
		y: meta.originY + y0 * scaleY,
		width: Math.max(1, (x1 - x0) * scaleX),
		height: Math.max(1, (y1 - y0) * scaleY),
	};
}

export function registerScreenshotTools(server: McpServer, session: SessionState) {
	server.registerTool(
		"screenshot",
		{
			description:
				"Take a screenshot of the current display. " +
				"ALWAYS call this before left_click or any mouse action — " +
				"visually locate the target element in the returned image and " +
				"read its (x, y) pixel position to pass to left_click(coordinate=[x, y]). " +
				"Coordinates are relative to this image; the server handles scaling.",
			inputSchema: z.object({
				save_to_disk: z
					.boolean()
					.optional()
					.describe("Save the image to disk and return the path. Only set when sharing the image with the user."),
			}),
		},
		async ({ save_to_disk }) => {
			if (session.allowedApps.size === 0) {
				return fail("No apps in allowlist. Call request_access first.");
			}

			const result = (await native.screenshot({
				displayId: await displayIdFor(session),
				allowedBundleIds: allowedBundleIds(session),
				quality: 0.75,
				maxWidth: 1568,
				maxHeight: 1568,
			})) as CaptureResult;

			updateScreenshotMeta(session, result);

			const rawDisplays = (await native.displayList()) as DisplayInfo[];
			if (rawDisplays.length > 1) {
				const displays = await enrichDisplays(rawDisplays);
				const captured = displays.find(d => d.originX === result.originX && d.originY === result.originY);
				const others = displays
					.filter(d => d !== captured)
					.map(d => `"${d.name}"`)
					.join(", ");
				const note = captured
					? `Multi-monitor: captured "${captured.name}" (${captured.width}x${captured.height}). Other monitors: [${others}]. If the target app is not visible, use switch_display with a monitor name.`
					: `Multi-monitor: available monitors: [${displays.map(d => `"${d.name}"`).join(", ")}]. Use switch_display with a monitor name.`;
				const content: Content[] = [imageContent(result.image), text(note)];
				if (save_to_disk) {
					const path = await saveImage(result.image);
					content.push(text(`Saved to: ${path}`));
				}
				return { content };
			}

			const content: Content[] = [imageContent(result.image)];
			if (save_to_disk) {
				const path = await saveImage(result.image);
				content.push({ type: "text", text: `Saved to: ${path}` });
			}
			return { content };
		},
	);

	server.registerTool(
		"zoom",
		{
			description: "Take a higher-resolution screenshot of a region from the most recent screenshot.",
			inputSchema: z.object({
				region: z
					.tuple([z.number(), z.number(), z.number(), z.number()])
					.describe("(x0, y0, x1, y1) in the coordinate space of the most recent full screenshot."),
				save_to_disk: z
					.boolean()
					.optional()
					.describe("Save the image to disk and return the path. Only set when sharing the image with the user."),
			}),
		},
		async ({ region, save_to_disk }) => {
			if (!session.lastScreenshot) {
				return fail("Take a screenshot first.");
			}

			const mapped = regionToDisplaySpace(session, region);
			const result = (await native.screenshotRegion({
				displayId: await displayIdFor(session),
				allowedBundleIds: allowedBundleIds(session),
				x: mapped.x,
				y: mapped.y,
				width: mapped.width,
				height: mapped.height,
				outWidth: 1200,
				outHeight: 900,
				quality: 0.85,
			})) as CaptureResult;

			const content: Content[] = [imageContent(result.image)];
			if (save_to_disk) {
				const path = await saveImage(result.image);
				content.push({ type: "text", text: `Saved to: ${path}` });
			}
			return { content };
		},
	);

	server.registerTool(
		"switch_display",
		{
			description:
				"Switch which display future screenshots should capture. " +
				'Pass a monitor name from the screenshot note (e.g. "Color LCD", "S34CG50"), ' +
				'or "auto" to re-enable automatic selection (picks the display where the ' +
				"frontmost app is). If the target app is not visible in the screenshot, " +
				"it is on another display — switch to it by name.",
			inputSchema: z.object({
				display: z.string().describe('Monitor name from the screenshot metadata, or "auto".'),
			}),
		},
		async ({ display }) => {
			if (display === "auto") {
				session.selectedDisplayId = "auto";
				return ok("Returned to automatic monitor selection. Call screenshot to continue.");
			}

			const rawDisplays = (await native.displayList()) as DisplayInfo[];
			const displays = await enrichDisplays(rawDisplays);
			const match = findDisplayByName(displays, display);

			if (!match) {
				const names = displays.map(d => `"${d.name}"`).join(", ");
				return fail(
					`Monitor "${display}" not found. Available monitors: [${names}]. Pass the exact name from the screenshot note.`,
				);
			}

			session.selectedDisplayId = match.id;
			return ok(`Switched to "${match.name}" (${match.width}x${match.height}). Call screenshot to see it.`);
		},
	);
}
