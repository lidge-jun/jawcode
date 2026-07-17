import type { AgentEvent } from "@jawcode-dev/agent-core";
import type { AssistantMessage } from "@jawcode-dev/ai";
import type { NotificationServerFrame, NotificationTurnStreamFrame } from "./protocol";

export interface NotificationFrameSink {
	pushFrame(frame: NotificationServerFrame): void;
}

interface TurnState {
	sequence: number;
	messageRef?: string;
	lastLiveAt?: number;
	lastLiveText?: string;
}

const sinks = new Map<string, NotificationFrameSink>();
const turnStates = new Map<string, TurnState>();
const FINAL_TEXT_LIMIT = 40_000;
const LIVE_TEXT_LIMIT = 3_500;

export function registerNotificationFrameSink(sessionId: string, sink: NotificationFrameSink): void {
	sinks.set(sessionId, sink);
}

export function unregisterNotificationFrameSink(sessionId: string, sink: NotificationFrameSink): void {
	if (sinks.get(sessionId) === sink) sinks.delete(sessionId);
	turnStates.delete(sessionId);
}

function streamEnabled(): boolean {
	return process.env.JWC_NOTIFICATIONS_STREAM === "1" || process.env.GJC_NOTIFICATIONS_STREAM === "1";
}

function streamIntervalMs(): number {
	const raw = Number(
		process.env.JWC_NOTIFICATIONS_STREAM_INTERVAL_MS ?? process.env.GJC_NOTIFICATIONS_STREAM_INTERVAL_MS,
	);
	return Number.isFinite(raw) && raw > 0 ? Math.max(200, raw) : 500;
}

function finalTextLimit(): number {
	const raw = Number(process.env.JWC_NOTIFICATIONS_TURN_MAX ?? process.env.GJC_NOTIFICATIONS_TURN_MAX);
	return Number.isFinite(raw) && raw > 0 ? Math.min(FINAL_TEXT_LIMIT, Math.max(280, raw)) : FINAL_TEXT_LIMIT;
}

function assistantText(message: AssistantMessage, max: number): string | undefined {
	const text = message.content
		.filter(content => content.type === "text")
		.map(content => content.text)
		.join("")
		.trim();
	if (!text || /^[.\s]+$/.test(text)) return undefined;
	return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function emit(sessionId: string, frame: NotificationTurnStreamFrame): void {
	sinks.get(sessionId)?.pushFrame(frame);
}

/** Mirror assistant output to the active notification server without coupling AgentSession to its lifecycle owner. */
export function publishNotificationAgentEvent(
	sessionId: string,
	event: AgentEvent,
	options: { redact: boolean; now?: () => number },
): void {
	if (!sinks.has(sessionId) || options.redact) return;
	if (event.type === "turn_start") {
		const previous = turnStates.get(sessionId);
		turnStates.set(sessionId, { sequence: previous?.sequence ?? 0 });
		return;
	}
	if (event.type === "message_update" && streamEnabled() && event.message.role === "assistant") {
		const state = turnStates.get(sessionId) ?? { sequence: 0 };
		const now = (options.now ?? Date.now)();
		if (now - (state.lastLiveAt ?? 0) < streamIntervalMs()) return;
		const text = assistantText(event.message, LIVE_TEXT_LIMIT);
		if (!text || text === state.lastLiveText) return;
		if (!state.messageRef) state.messageRef = String(++state.sequence);
		state.lastLiveAt = now;
		state.lastLiveText = text;
		turnStates.set(sessionId, state);
		emit(sessionId, { type: "turn_stream", sessionId, phase: "live", text, messageRef: state.messageRef });
		return;
	}
	if (event.type !== "turn_end" || event.message.role !== "assistant") return;
	const message = event.message as AssistantMessage;
	const text = assistantText(message, finalTextLimit());
	const state = turnStates.get(sessionId) ?? { sequence: 0 };
	if (text) {
		if (streamEnabled() && !state.messageRef) state.messageRef = String(++state.sequence);
		emit(sessionId, {
			type: "turn_stream",
			sessionId,
			phase: "finalized",
			finalAnswer: message.stopReason !== "toolUse",
			text,
			messageRef: state.messageRef,
		});
	}
	turnStates.set(sessionId, { sequence: state.sequence });
}
