import { randomBytes } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { type TransportOwnerState, transportPaths } from "./transport-state";

export type DaemonControlKind = "stop" | "reload";

export interface DaemonControlRequest {
	version: 1;
	kind: DaemonControlKind;
	/** The owner this control request targets; honored only when it matches the current owner. */
	targetOwnerId: string;
	requestedAt: number;
}

export type DaemonControlDecision =
	| { action: "honor-stop" | "honor-reload"; reason: "owner-match" }
	| { action: "ignore"; reason: "no-request" | "owner-mismatch" | "stale-request" };

export function daemonControlPath(agentDir: string): string {
	return path.join(transportPaths(agentDir).dir, "control.json");
}

async function ensurePrivateDir(dir: string): Promise<void> {
	await fs.mkdir(dir, { recursive: true, mode: 0o700 });
	if (process.platform !== "win32") await fs.chmod(dir, 0o700);
}

export async function writeDaemonControl(agentDir: string, request: DaemonControlRequest): Promise<void> {
	const file = daemonControlPath(agentDir);
	await ensurePrivateDir(path.dirname(file));
	const tmp = `${file}.tmp-${randomBytes(4).toString("hex")}`;
	await fs.writeFile(tmp, `${JSON.stringify(request, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
	await fs.rename(tmp, file);
	if (process.platform !== "win32") await fs.chmod(file, 0o600);
}

export async function readDaemonControl(agentDir: string): Promise<DaemonControlRequest | null> {
	try {
		const raw = await fs.readFile(daemonControlPath(agentDir), "utf8");
		return JSON.parse(raw) as DaemonControlRequest;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}

export async function clearDaemonControl(agentDir: string): Promise<void> {
	try {
		await fs.unlink(daemonControlPath(agentDir));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
}

/**
 * Decide whether a daemon should honor a stop/reload control request. Owner-scoped: a request is
 * honored only when it targets the current owner and is not older than the owner's start — so a stale
 * or mismatched request can never clear a newer owner.
 */
export function decideDaemonControl(input: {
	current: TransportOwnerState | null;
	request: DaemonControlRequest | null;
}): DaemonControlDecision {
	const { current, request } = input;
	if (!request) return { action: "ignore", reason: "no-request" };
	if (!current) return { action: "ignore", reason: "owner-mismatch" };
	if (request.targetOwnerId !== current.ownerId) return { action: "ignore", reason: "owner-mismatch" };
	if (request.requestedAt < current.startedAt) return { action: "ignore", reason: "stale-request" };
	return request.kind === "stop"
		? { action: "honor-stop", reason: "owner-match" }
		: { action: "honor-reload", reason: "owner-match" };
}
