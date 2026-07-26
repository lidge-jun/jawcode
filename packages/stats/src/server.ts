import type { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { $which } from "@jawcode-dev/utils";
import { $ } from "bun";
import {
	getBehaviorDashboardStats,
	getCostDashboardStats,
	getDashboardStats,
	getModelDashboardStats,
	getOverviewStats,
	getRecentErrors,
	getRecentRequests,
	getRequestDetails,
	getTotalMessageCount,
	syncAllSessions,
} from "./aggregator";
import embeddedClientArchiveTxt from "./embedded-client.generated.txt";

const getEmbeddedClientArchive = (() => {
	const txt = embeddedClientArchiveTxt.replaceAll(/[\s\r\n]/g, "").trim();
	if (!txt) return null;
	return () => Buffer.from(txt, "base64");
})();

const CLIENT_DIR = path.join(import.meta.dir, "client");
const STATIC_DIR = path.join(import.meta.dir, "..", "dist", "client");
const IS_BUN_COMPILED =
	Bun.env.PI_COMPILED ||
	import.meta.url.includes("$bunfs") ||
	import.meta.url.includes("~BUN") ||
	import.meta.url.includes("%7EBUN");

const COMPILED_CLIENT_DIR_ROOT = path.join(os.tmpdir(), "gjc-stats-client");
let compiledClientDirPromise: Promise<string> | null = null;
const STATS_DASHBOARD_HEADER = "x-jwc-stats-dashboard";
const STATS_PROBE_TIMEOUT_MS = 500;
const PROCESS_EXIT_POLL_MS = 50;
const PROCESS_EXIT_POLLS = 10;
const RECLAIMABLE_IMAGES = new Set(["bun", "node", "jwc", "jawcode"]);

interface PortHolder {
	pid: number;
	image: string;
}

async function probeStatsDashboard(port: number): Promise<boolean> {
	try {
		const response = await fetch(`http://localhost:${port}/api/stats/models`, {
			signal: AbortSignal.timeout(STATS_PROBE_TIMEOUT_MS),
		});
		if (response.status !== 200) {
			await response.body?.cancel();
			return false;
		}
		if (response.headers.get(STATS_DASHBOARD_HEADER)) {
			await response.body?.cancel();
			return true;
		}
		if (!(response.headers.get("content-type") ?? "").includes("application/json")) {
			await response.body?.cancel();
			return false;
		}
		return Array.isArray(await response.json());
	} catch {
		return false;
	}
}

async function findLinuxPortHolder(port: number): Promise<PortHolder | null> {
	const socketInodes = new Set<string>();
	for (const tablePath of ["/proc/net/tcp", "/proc/net/tcp6"]) {
		let table: string;
		try {
			table = await Bun.file(tablePath).text();
		} catch {
			continue;
		}
		for (const line of table.split("\n").slice(1)) {
			const fields = line.trim().split(/\s+/);
			const localAddress = fields[1];
			const state = fields[3];
			const inode = fields[9];
			if (!localAddress || state !== "0A" || !inode) continue;
			const encodedPort = localAddress.slice(localAddress.lastIndexOf(":") + 1);
			if (Number.parseInt(encodedPort, 16) === port) socketInodes.add(inode);
		}
	}
	if (socketInodes.size === 0) return null;

	let processes: Dirent[];
	try {
		processes = await fs.readdir("/proc", { withFileTypes: true });
	} catch {
		return null;
	}
	for (const entry of processes) {
		if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
		const pid = Number.parseInt(entry.name, 10);
		let descriptors: string[];
		try {
			descriptors = await fs.readdir(`/proc/${pid}/fd`);
		} catch {
			continue;
		}
		for (const descriptor of descriptors) {
			try {
				const target = await fs.readlink(`/proc/${pid}/fd/${descriptor}`);
				const match = /^socket:\[(\d+)]$/.exec(target);
				if (!match?.[1] || !socketInodes.has(match[1])) continue;
				try {
					return { pid, image: path.basename(await fs.readlink(`/proc/${pid}/exe`)) };
				} catch {
					const commandLine = await Bun.file(`/proc/${pid}/cmdline`).text();
					const executable = commandLine.split("\0", 1)[0];
					return { pid, image: executable ? path.basename(executable) : "unknown" };
				}
			} catch {}
		}
	}
	return null;
}

async function findMacPortHolder(port: number): Promise<PortHolder | null> {
	const lsof = $which("lsof") ?? ((await Bun.file("/usr/sbin/lsof").exists()) ? "/usr/sbin/lsof" : null);
	if (!lsof) return null;
	const selector = `-iTCP:${port}`;
	const result = await $`${lsof} -nP ${selector} -sTCP:LISTEN -Fpc`.quiet().nothrow();
	if (result.exitCode !== 0) return null;
	let pid: number | null = null;
	for (const line of result.text().split("\n")) {
		if (line.startsWith("p")) {
			const parsed = Number.parseInt(line.slice(1), 10);
			pid = Number.isSafeInteger(parsed) ? parsed : null;
		} else if (line.startsWith("c") && pid !== null) {
			return { pid, image: line.slice(1) || "unknown" };
		}
	}
	return null;
}

async function findWindowsPortHolder(port: number): Promise<PortHolder | null> {
	const netstat = $which("netstat");
	if (!netstat) return null;
	const result = await $`${netstat} -ano -p TCP`.quiet().nothrow();
	if (result.exitCode !== 0) return null;
	let pid: number | null = null;
	for (const line of result.text().split("\n")) {
		const fields = line.trim().split(/\s+/);
		if (fields[0]?.toUpperCase() !== "TCP" || fields[3]?.toUpperCase() !== "LISTENING") continue;
		const localAddress = fields[1];
		if (!localAddress || Number.parseInt(localAddress.slice(localAddress.lastIndexOf(":") + 1), 10) !== port)
			continue;
		const parsed = Number.parseInt(fields[4] ?? "", 10);
		if (Number.isSafeInteger(parsed)) {
			pid = parsed;
			break;
		}
	}
	if (pid === null) return null;
	const tasklist = $which("tasklist");
	if (!tasklist) return { pid, image: "unknown" };
	const filter = `PID eq ${pid}`;
	const task = await $`${tasklist} /FI ${filter} /FO CSV /NH`.quiet().nothrow();
	if (task.exitCode !== 0) return { pid, image: "unknown" };
	const imageMatch = /^"((?:[^"]|"")*)"/.exec(task.text().trim());
	return { pid, image: imageMatch?.[1]?.replaceAll('""', '"') || "unknown" };
}

async function findPortHolder(port: number): Promise<PortHolder | null> {
	if (process.platform === "linux") return findLinuxPortHolder(port);
	if (process.platform === "darwin") return findMacPortHolder(port);
	if (process.platform === "win32") return findWindowsPortHolder(port);
	return null;
}

async function terminatePortHolder(holder: PortHolder): Promise<void> {
	try {
		process.kill(holder.pid, "SIGTERM");
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ESRCH") return;
		throw new Error(`Failed to stop ${holder.image} (PID ${holder.pid})`, { cause: error });
	}
	for (let attempt = 0; attempt < PROCESS_EXIT_POLLS; attempt++) {
		await Bun.sleep(PROCESS_EXIT_POLL_MS);
		try {
			process.kill(holder.pid, 0);
		} catch (error) {
			if (error instanceof Error && "code" in error && error.code === "ESRCH") return;
			throw new Error(`Failed to inspect ${holder.image} (PID ${holder.pid})`, { cause: error });
		}
	}
	try {
		process.kill(holder.pid, "SIGKILL");
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ESRCH") return;
		throw new Error(`Failed to kill ${holder.image} (PID ${holder.pid})`, { cause: error });
	}
	await Bun.sleep(PROCESS_EXIT_POLL_MS);
}

async function recoverStatsPort(port: number): Promise<"retry" | "reuse"> {
	if (await probeStatsDashboard(port)) return "reuse";
	const holder = await findPortHolder(port);
	if (!holder) throw new Error(`Port ${port} is in use, but the listening process could not be identified.`);
	if (holder.pid === process.pid) {
		throw new Error(`Port ${port} is held by the current process (${holder.image}, PID ${holder.pid}).`);
	}
	const normalizedImage = holder.image
		.toLowerCase()
		.replace(/\.exe$/, "")
		.replace(/ \(deleted\)$/, "");
	if (!RECLAIMABLE_IMAGES.has(normalizedImage)) {
		throw new Error(`Port ${port} is in use by ${holder.image} (PID ${holder.pid}); refusing to stop it.`);
	}
	await terminatePortHolder(holder);
	return "retry";
}

function sanitizeArchivePath(archivePath: string): string | null {
	const normalized = archivePath.replaceAll("\\", "/").replace(/^\.\//, "");
	if (!normalized || normalized === ".") return null;
	if (normalized.includes("..") || path.isAbsolute(normalized)) return null;
	return normalized;
}

async function extractEmbeddedClientArchive(archiveBytes: Buffer, outputDir: string): Promise<void> {
	const archive = new Bun.Archive(archiveBytes);
	const files = await archive.files();
	const extractRoot = path.resolve(outputDir);

	for (const [archivePath, file] of files) {
		const sanitizedPath = sanitizeArchivePath(archivePath);
		if (!sanitizedPath) continue;
		const destinationPath = path.resolve(extractRoot, sanitizedPath);
		if (!destinationPath.startsWith(extractRoot + path.sep)) {
			throw new Error(`Archive entry escapes extraction directory: ${archivePath}`);
		}
		await Bun.write(destinationPath, file);
	}
}

async function getCompiledClientDir(): Promise<string> {
	if (!IS_BUN_COMPILED) return STATIC_DIR;
	if (compiledClientDirPromise) return compiledClientDirPromise;

	const archiveBytes = getEmbeddedClientArchive?.();
	if (!archiveBytes) {
		throw new Error("Compiled stats client bundle missing. Rebuild binary with embedded stats assets.");
	}

	compiledClientDirPromise = (async () => {
		const bundleHash = Bun.hash(archiveBytes).toString(16);
		const outputDir = path.join(COMPILED_CLIENT_DIR_ROOT, bundleHash);
		const markerPath = path.join(outputDir, "index.html");
		try {
			const marker = await fs.stat(markerPath);
			if (marker.isFile()) return outputDir;
		} catch {}

		await fs.rm(outputDir, { recursive: true, force: true });
		await fs.mkdir(outputDir, { recursive: true });
		await extractEmbeddedClientArchive(archiveBytes, outputDir);
		return outputDir;
	})();

	return compiledClientDirPromise;
}

async function getLatestMtime(dir: string): Promise<number> {
	const entries = await fs.readdir(dir, { withFileTypes: true });

	const promises = [];
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			promises.push(getLatestMtime(fullPath));
		} else if (entry.isFile()) {
			promises.push(fs.stat(fullPath).then(stats => stats.mtimeMs));
		}
	}

	let latest = 0;
	await Promise.allSettled(promises).then(results => {
		for (const result of results) {
			if (result.status === "fulfilled") {
				latest = Math.max(latest, result.value);
			}
		}
	});
	return latest;
}

const ensureClientBuild = async () => {
	if (IS_BUN_COMPILED) return;
	const indexPath = path.join(STATIC_DIR, "index.html");
	const cssPath = path.join(STATIC_DIR, "styles.css");
	const clientSourceMtime = await getLatestMtime(CLIENT_DIR);
	const tailwindConfigPath = path.join(import.meta.dir, "..", "tailwind.config.js");
	let tailwindConfigMtime = 0;
	try {
		const tailwindConfigStats = await fs.stat(tailwindConfigPath);
		tailwindConfigMtime = tailwindConfigStats.mtimeMs;
	} catch {}
	const sourceMtime = Math.max(clientSourceMtime, tailwindConfigMtime);
	let shouldBuild = true;
	try {
		const [indexStats, cssStats] = await Promise.all([fs.stat(indexPath), fs.stat(cssPath)]);
		if (
			indexStats.isFile() &&
			cssStats.isFile() &&
			indexStats.mtimeMs >= sourceMtime &&
			cssStats.mtimeMs >= sourceMtime
		) {
			shouldBuild = false;
		}
	} catch {
		shouldBuild = true;
	}

	if (!shouldBuild) return;

	await fs.rm(STATIC_DIR, { recursive: true, force: true });

	console.log("Building stats client...");
	const packageRoot = path.join(import.meta.dir, "..");
	const buildResult = await $`bun run build.ts`.cwd(packageRoot).quiet().nothrow();
	if (buildResult.exitCode !== 0) {
		const output = buildResult.text().trim();
		const details = output ? `\n${output}` : "";
		throw new Error(`Failed to build stats client (exit ${buildResult.exitCode})${details}`);
	}

	const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Usage Statistics</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div id="root"></div>
    <script src="index.js" type="module"></script>
</body>
</html>`;

	await Bun.write(path.join(STATIC_DIR, "index.html"), indexHtml);
};

/**
 * Handle API requests.
 */
async function handleApi(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const path = url.pathname;

	// Stats reads are DB-only; explicit /api/sync does the expensive session scan.
	const range = url.searchParams.get("range");

	if (path === "/api/stats") {
		const stats = await getDashboardStats(range);
		return Response.json(stats);
	}

	if (path === "/api/stats/overview") {
		const stats = await getOverviewStats(range);
		return Response.json(stats);
	}

	if (path === "/api/stats/model-dashboard") {
		const stats = await getModelDashboardStats(range);
		return Response.json(stats);
	}

	if (path === "/api/stats/costs") {
		const stats = await getCostDashboardStats(range);
		return Response.json(stats);
	}

	if (path === "/api/stats/behavior") {
		const stats = await getBehaviorDashboardStats(range);
		return Response.json(stats);
	}

	if (path === "/api/stats/recent") {
		const limit = url.searchParams.get("limit");
		const stats = await getRecentRequests(limit ? parseInt(limit, 10) : undefined);
		return Response.json(stats);
	}

	if (path === "/api/stats/errors") {
		const limit = url.searchParams.get("limit");
		const stats = await getRecentErrors(limit ? parseInt(limit, 10) : undefined);
		return Response.json(stats);
	}

	if (path === "/api/stats/models") {
		const stats = await getDashboardStats(range);
		return Response.json(stats.byModel);
	}

	if (path === "/api/stats/folders") {
		const stats = await getDashboardStats(range);
		return Response.json(stats.byFolder);
	}

	if (path === "/api/stats/timeseries") {
		const stats = await getDashboardStats(range);
		return Response.json(stats.timeSeries);
	}

	if (path.startsWith("/api/request/")) {
		const id = path.split("/").pop();
		if (!id) return new Response("Bad Request", { status: 400 });
		const details = await getRequestDetails(parseInt(id, 10));
		if (!details) return new Response("Not Found", { status: 404 });
		return Response.json(details);
	}

	if (path === "/api/sync") {
		const result = await syncAllSessions();
		const count = await getTotalMessageCount();
		return Response.json({ ...result, totalMessages: count });
	}

	return new Response("Not Found", { status: 404 });
}

/**
 * Handle static file requests.
 */
async function handleStatic(requestPath: string): Promise<Response> {
	const staticDir = IS_BUN_COMPILED ? await getCompiledClientDir() : STATIC_DIR;
	const filePath = requestPath === "/" ? "/index.html" : requestPath;
	const fullPath = path.join(staticDir, filePath);

	const file = Bun.file(fullPath);
	if (await file.exists()) {
		return new Response(file);
	}

	// SPA fallback
	const index = Bun.file(path.join(staticDir, "index.html"));
	if (await index.exists()) {
		return new Response(index);
	}

	return new Response("Not Found", { status: 404 });
}

function createDashboardServer(port: number) {
	const server = Bun.serve({
		hostname: "127.0.0.1",
		port,
		async fetch(req) {
			const url = new URL(req.url);
			const path = url.pathname;

			// CORS headers for local development and dashboard identity probing.
			const corsHeaders: Record<string, string> = {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type",
				[STATS_DASHBOARD_HEADER]: "1",
			};

			if (req.method === "OPTIONS") {
				return new Response(null, { headers: corsHeaders });
			}

			try {
				let response: Response;

				if (path.startsWith("/api/")) {
					response = await handleApi(req);
				} else {
					response = await handleStatic(path);
				}

				// Add CORS headers to all responses
				const headers = new Headers(response.headers);
				for (const [key, value] of Object.entries(corsHeaders)) {
					headers.set(key, value);
				}

				return new Response(response.body, {
					status: response.status,
					headers,
				});
			} catch (error) {
				console.error("Server error:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500, headers: corsHeaders },
				);
			}
		},
	});

	return server;
}

/**
 * Start the HTTP server, reusing a verified live dashboard or reclaiming a stale JWC runtime.
 */
export async function startServer(port = 3847): Promise<{ port: number; stop: () => void }> {
	await ensureClientBuild();

	try {
		const server = createDashboardServer(port);
		return { port: server.port ?? port, stop: () => server.stop() };
	} catch (error) {
		if (!(error instanceof Error && "code" in error && error.code === "EADDRINUSE")) throw error;
		const recovery = await recoverStatsPort(port);
		if (recovery === "reuse") return { port, stop: () => {} };
		try {
			const server = createDashboardServer(port);
			return { port: server.port ?? port, stop: () => server.stop() };
		} catch (retryError) {
			throw new Error(`Failed to start stats dashboard on port ${port} after reclaiming it.`, {
				cause: retryError,
			});
		}
	}
}
