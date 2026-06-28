import { randomUUID } from "node:crypto";
import type { Server, ServerWebSocket } from "bun";
import { isNotificationConnectTokenAccepted } from "./config";
import {
	type NotificationEndpointRecord,
	removeNotificationDiscoveryRecord,
	writeNotificationDiscoveryRecord,
} from "./discovery";
import {
	NOTIFICATION_PROTOCOL_VERSION,
	type NotificationActionNeededFrame,
	type NotificationClientFrame,
	type NotificationServerFrame,
} from "./protocol";
import type { RemoteAnswerInput, RemoteAnswerKind } from "./remote-answer";
import { type NotificationActionDraft, NotificationSessionRegistry } from "./session-registry";

export interface NotificationLoopbackServerOptions {
	sessionId: string;
	stateRoot: string;
	/** Per-session connect token. Generated if omitted. Never logged. */
	connectToken?: string;
	now?: () => number;
}

interface NotificationWsData {
	token: string | undefined;
}

interface DraftMeta {
	options?: readonly string[];
	allowFreeText?: boolean;
}

/**
 * Loopback-only (127.0.0.1) WebSocket transport for the notification SDK.
 *
 * Business logic (token gate, action replay, remote/local answer race, idempotency) lives in
 * {@link NotificationSessionRegistry}; this class is the thin Bun-native transport that
 * authenticates clients at upgrade time, replays buffered asks, accepts remote replies, and
 * broadcasts resolution frames. The connect token is never logged.
 */
export class NotificationLoopbackServer {
	readonly #sessionId: string;
	readonly #stateRoot: string;
	readonly #connectToken: string;
	readonly #registry: NotificationSessionRegistry;
	readonly #now: () => number;
	readonly #sockets = new Set<ServerWebSocket<NotificationWsData>>();
	readonly #drafts = new Map<string, DraftMeta>();
	#server: Server<NotificationWsData> | undefined;
	#stopped = false;

	private constructor(options: NotificationLoopbackServerOptions, connectToken: string) {
		this.#sessionId = options.sessionId;
		this.#stateRoot = options.stateRoot;
		this.#connectToken = connectToken;
		this.#now = options.now ?? Date.now;
		this.#registry = new NotificationSessionRegistry({ sessionId: options.sessionId, connectToken });
	}

	static async start(options: NotificationLoopbackServerOptions): Promise<NotificationLoopbackServer> {
		const connectToken = options.connectToken ?? randomUUID();
		const self = new NotificationLoopbackServer(options, connectToken);
		self.#server = Bun.serve<NotificationWsData>({
			hostname: "127.0.0.1",
			port: 0,
			fetch: (req, server) => self.#handleFetch(req, server),
			websocket: {
				open: ws => self.#handleOpen(ws),
				message: (ws, message) => self.#handleMessage(ws, message),
				close: ws => {
					self.#sockets.delete(ws);
				},
			},
		});
		const startedAt = self.#now();
		const record: NotificationEndpointRecord = {
			version: NOTIFICATION_PROTOCOL_VERSION,
			sessionId: self.#sessionId,
			url: self.url,
			host: "127.0.0.1",
			port: self.port,
			token: connectToken,
			startedAt,
			updatedAt: startedAt,
			pid: process.pid,
		};
		await writeNotificationDiscoveryRecord(options.stateRoot, record);
		return self;
	}

	get url(): string {
		return `ws://127.0.0.1:${this.port}`;
	}

	get port(): number {
		const port = this.#server?.port;
		if (port === undefined) throw new Error("notification server not started");
		return port;
	}

	/** The per-session connect token. Exposed for host wiring/tests only; never log it. */
	get connectToken(): string {
		return this.#connectToken;
	}

	/** Enqueue an ask and broadcast the resulting action_needed frame to connected clients. */
	enqueueAction(draft: NotificationActionDraft): NotificationActionNeededFrame {
		this.#drafts.set(draft.actionId, { options: draft.options, allowFreeText: draft.allowFreeText });
		const frame = this.#registry.enqueueAction(draft);
		this.#broadcast(frame);
		return frame;
	}

	/** Resolve an ask locally (local answer wins the race) and broadcast action_resolved. */
	resolveLocal(actionId: string): NotificationServerFrame {
		const frame = this.#registry.resolveLocal(actionId);
		this.#broadcast(frame);
		return frame;
	}

	async stop(): Promise<void> {
		if (this.#stopped) return;
		this.#stopped = true;
		for (const ws of this.#sockets) {
			try {
				ws.close(1001, "server_stopped");
			} catch (error) {
				console.error("[notifications] socket close failed", (error as Error).message);
			}
		}
		this.#sockets.clear();
		this.#server?.stop(true);
		await removeNotificationDiscoveryRecord(this.#stateRoot, this.#sessionId);
	}

	#handleFetch(req: Request, server: Server<NotificationWsData>): Response | undefined {
		let presentedToken: string | undefined;
		try {
			presentedToken = new URL(req.url).searchParams.get("token") ?? undefined;
		} catch {
			return new Response("bad request", { status: 400 });
		}
		// Reject unauthorized clients at upgrade time — never open the socket.
		if (!isNotificationConnectTokenAccepted(this.#connectToken, presentedToken)) {
			return new Response("unauthorized", { status: 401 });
		}
		const upgraded = server.upgrade(req, { data: { token: presentedToken } });
		if (upgraded) return undefined;
		return new Response("upgrade required", { status: 400 });
	}

	#handleOpen(ws: ServerWebSocket<NotificationWsData>): void {
		const decision = this.#registry.connect(ws.data.token);
		if ("rejected" in decision) {
			ws.close(1008, "unauthorized");
			return;
		}
		this.#sockets.add(ws);
		for (const frame of decision.frames) ws.send(JSON.stringify(frame));
	}

	#handleMessage(ws: ServerWebSocket<NotificationWsData>, message: string | Buffer): void {
		let frame: NotificationClientFrame;
		try {
			const text = typeof message === "string" ? message : message.toString("utf8");
			const parsed = JSON.parse(text) as unknown;
			if (!parsed || typeof parsed !== "object") return;
			frame = parsed as NotificationClientFrame;
		} catch {
			return; // malformed frame: tolerate, keep connection open
		}
		switch (frame.type) {
			case "ping":
				ws.send(JSON.stringify({ type: "pong", nonce: frame.nonce } satisfies NotificationServerFrame));
				return;
			case "hello":
				return; // client hello: replay already sent on open
			case "reply": {
				const result = this.#registry.resolveRemote(this.#toRemoteInput(frame, ws.data.token));
				if (result.type === "action_resolved") {
					this.#broadcast(result);
				} else {
					this.#sendTo(ws, result);
				}
				return;
			}
			default:
				return; // unknown frame: forward-compatible no-op
		}
	}

	#toRemoteInput(frame: { actionId: string; value: string }, presentedToken: string | undefined): RemoteAnswerInput {
		const draft = this.#drafts.get(frame.actionId);
		const kind: RemoteAnswerKind = draft?.options?.includes(frame.value) ? "button" : "free_text";
		return {
			sessionId: this.#sessionId,
			actionId: frame.actionId,
			// Local WS replies carry no client idempotency key; each reply is a fresh attempt.
			idempotencyKey: randomUUID(),
			transport: "telegram",
			kind,
			value: frame.value,
			presentedToken,
		};
	}

	#broadcast(frame: NotificationServerFrame): void {
		const payload = JSON.stringify(frame);
		for (const ws of this.#sockets) this.#sendSafe(ws, payload);
	}

	#sendTo(ws: ServerWebSocket<NotificationWsData>, frame: NotificationServerFrame): void {
		this.#sendSafe(ws, JSON.stringify(frame));
	}

	#sendSafe(ws: ServerWebSocket<NotificationWsData>, payload: string): void {
		try {
			ws.send(payload);
		} catch (error) {
			console.error("[notifications] frame send failed", (error as Error).message);
		}
	}
}
