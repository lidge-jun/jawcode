import * as fs from "node:fs/promises";
import * as path from "node:path";
import { assertSafeSessionId } from "../harness-control-plane/storage";
import { type NotificationEndpointRecord, notificationDiscoveryDir, toNotificationEndpointDisplay } from "./discovery";
import { readTransportRoots } from "./transport-state";

export interface TransportSessionObservation {
	sessionId: string;
	url: string;
	tokenMasked: string | null;
	inboundMode: "drop";
}

export type TransportEndpointReadErrorCode = "invalid_json" | "unsafe_session_id" | "read_failed" | "invalid_record";

export interface TransportEndpointReadError {
	sessionId?: string;
	file: string;
	code: TransportEndpointReadErrorCode;
}

export type SafeReadTransportEndpointResult =
	| { ok: true; observation: TransportSessionObservation }
	| { ok: false; error: TransportEndpointReadError };

export interface ScanTransportSessionsResult {
	observations: TransportSessionObservation[];
	errors: TransportEndpointReadError[];
}

export interface ScanTransportSessionsOptions {
	agentDir: string;
}

export interface TransportInboundDecision {
	mode: "drop";
	reason: "authorization_not_implemented";
}

function isEndpointRecord(value: unknown): value is NotificationEndpointRecord {
	const record = value as Partial<NotificationEndpointRecord>;
	return (
		typeof record === "object" &&
		record !== null &&
		typeof record.sessionId === "string" &&
		typeof record.url === "string" &&
		typeof record.host === "string" &&
		typeof record.port === "number" &&
		typeof record.token === "string" &&
		typeof record.startedAt === "number" &&
		typeof record.updatedAt === "number" &&
		typeof record.pid === "number"
	);
}

export async function safeReadTransportEndpoint(
	_stateRoot: string,
	file: string,
): Promise<SafeReadTransportEndpointResult> {
	const sessionId = path.basename(file, ".json");
	try {
		assertSafeSessionId(sessionId);
		const raw = await fs.readFile(file, "utf8");
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			return { ok: false, error: { sessionId, file, code: "invalid_json" } };
		}
		if (!isEndpointRecord(parsed) || parsed.sessionId !== sessionId) {
			return { ok: false, error: { sessionId, file, code: "invalid_record" } };
		}
		const display = toNotificationEndpointDisplay(parsed);
		return {
			ok: true,
			observation: {
				sessionId: display.sessionId,
				url: display.url,
				tokenMasked: display.tokenMasked,
				inboundMode: "drop",
			},
		};
	} catch (error) {
		if ((error as Error).message.includes("unsafe_session_id")) {
			return { ok: false, error: { sessionId, file, code: "unsafe_session_id" } };
		}
		return { ok: false, error: { sessionId, file, code: "read_failed" } };
	}
}

export async function scanTransportSessions(
	options: ScanTransportSessionsOptions,
): Promise<ScanTransportSessionsResult> {
	const rootsFile = await readTransportRoots(options.agentDir);
	const observations: TransportSessionObservation[] = [];
	const errors: TransportEndpointReadError[] = [];

	for (const root of rootsFile.roots) {
		const dir = notificationDiscoveryDir(root.stateRoot);
		let entries: string[];
		try {
			entries = await fs.readdir(dir);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
			errors.push({ file: dir, code: "read_failed" });
			continue;
		}
		for (const entry of entries) {
			if (!entry.endsWith(".json")) continue;
			const result = await safeReadTransportEndpoint(root.stateRoot, path.join(dir, entry));
			if (result.ok) observations.push(result.observation);
			else errors.push(result.error);
		}
	}

	return { observations, errors };
}

export function decideTransportInbound(): TransportInboundDecision {
	return { mode: "drop", reason: "authorization_not_implemented" };
}
