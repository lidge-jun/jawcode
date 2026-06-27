import type { NotificationActionNeededFrame } from "./protocol";
import { fingerprintSecret } from "./transport-state";

const DEFAULT_TITLE = "JWC session";
const TITLE_LIMIT = 120;
const FIELD_LIMIT = 80;

export interface ThreadTopicRecord {
	sessionId: string;
	messageThreadId: number;
	chatIdFingerprint: string;
	title: string;
	updatedAt: number;
	stale?: boolean;
}

export interface ThreadIdentityHeaderInput {
	repo?: string;
	branch?: string;
	machine?: string;
	sessionId: string;
	title?: string;
}

export interface ThreadInboundUpdate {
	updateId?: unknown;
	chatId?: unknown;
	messageThreadId?: unknown;
	text?: unknown;
	caption?: unknown;
	hasAttachment?: boolean;
}

export type ThreadInboundDropReason =
	| "wrong_chat"
	| "no_topic"
	| "unknown_topic"
	| "duplicate_update"
	| "missing_update_id"
	| "empty_text"
	| "attachment_not_supported"
	| "stale_topic";

export type ThreadInboundDecision =
	| { mode: "route"; sessionId: string; text: string; updateId: number }
	| { mode: "drop"; reason: ThreadInboundDropReason };

export interface ThreadInboundClassifierContext {
	expectedChatIdFingerprint: string;
	isDuplicateUpdate: (updateId: number) => boolean;
	recordUpdateId?: (updateId: number) => void;
}

function limitText(value: string | undefined, max: number, fallback = ""): string {
	const text = (value ?? fallback).trim();
	if (text.length <= max) return text;
	return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function normalizeOptionLabel(value: string): string {
	return value.replace(/^\s*\d+[.)]\s+/, "").trim();
}

function parseNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isInteger(value)) return value;
	if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
	return null;
}

function hasRouteableText(update: ThreadInboundUpdate): string | null {
	if (typeof update.text === "string" && update.text.trim()) return update.text.trim();
	if (typeof update.caption === "string" && update.caption.trim()) return update.caption.trim();
	return null;
}

export class ThreadTopicRegistry {
	#topicsBySession = new Map<string, ThreadTopicRecord>();

	upsert(record: ThreadTopicRecord): ThreadTopicRecord {
		const next: ThreadTopicRecord = {
			sessionId: record.sessionId,
			messageThreadId: record.messageThreadId,
			chatIdFingerprint: record.chatIdFingerprint,
			title: record.title,
			updatedAt: record.updatedAt,
			stale: false,
		};
		this.#topicsBySession.set(record.sessionId, next);
		return next;
	}

	findByThread(chatIdFingerprint: string, messageThreadId: number): ThreadTopicRecord | null {
		for (const topic of this.#topicsBySession.values()) {
			if (topic.chatIdFingerprint === chatIdFingerprint && topic.messageThreadId === messageThreadId) return topic;
		}
		return null;
	}

	markStale(sessionId: string, updatedAt: number): ThreadTopicRecord | null {
		const current = this.#topicsBySession.get(sessionId);
		if (!current) return null;
		const next: ThreadTopicRecord = { ...current, stale: true, updatedAt };
		this.#topicsBySession.set(sessionId, next);
		return next;
	}

	list(): ThreadTopicRecord[] {
		return Array.from(this.#topicsBySession.values()).map(topic => ({ ...topic }));
	}
}

export function renderThreadIdentityHeader(input: ThreadIdentityHeaderInput): string {
	const title = limitText(input.title, TITLE_LIMIT, DEFAULT_TITLE) || DEFAULT_TITLE;
	const lines = [`${title}`, "jwc threaded session", `.jwc/state/notifications`];
	if (input.repo) lines.push(`repo: ${limitText(input.repo, FIELD_LIMIT)}`);
	if (input.branch) lines.push(`branch: ${limitText(input.branch, FIELD_LIMIT)}`);
	if (input.machine) lines.push(`machine: ${limitText(input.machine, FIELD_LIMIT)}`);
	lines.push(`session: ${limitText(input.sessionId, FIELD_LIMIT)}`);
	return lines.join("\n");
}

export function renderThreadActionNeeded(input: NotificationActionNeededFrame): string {
	const lines = [`Action needed`, limitText(input.prompt, TITLE_LIMIT)];
	for (const [index, option] of (input.options ?? []).entries()) {
		lines.push(`${index + 1}. ${limitText(normalizeOptionLabel(option), FIELD_LIMIT)}`);
	}
	return lines.join("\n");
}

export function classifyThreadInboundUpdate(
	update: ThreadInboundUpdate,
	registry: ThreadTopicRegistry,
	ctx: ThreadInboundClassifierContext,
): ThreadInboundDecision {
	const updateId = parseNumber(update.updateId);
	if (updateId === null) return { mode: "drop", reason: "missing_update_id" };
	if (ctx.isDuplicateUpdate(updateId)) return { mode: "drop", reason: "duplicate_update" };

	const chatId = typeof update.chatId === "string" || typeof update.chatId === "number" ? String(update.chatId) : "";
	if (!chatId || fingerprintSecret(chatId) !== ctx.expectedChatIdFingerprint) {
		return { mode: "drop", reason: "wrong_chat" };
	}

	const messageThreadId = parseNumber(update.messageThreadId);
	if (messageThreadId === null) return { mode: "drop", reason: "no_topic" };

	const topic = registry.findByThread(ctx.expectedChatIdFingerprint, messageThreadId);
	if (!topic) return { mode: "drop", reason: "unknown_topic" };
	if (topic.stale) return { mode: "drop", reason: "stale_topic" };
	if (update.hasAttachment) return { mode: "drop", reason: "attachment_not_supported" };

	const text = hasRouteableText(update);
	if (!text) return { mode: "drop", reason: "empty_text" };

	ctx.recordUpdateId?.(updateId);
	return { mode: "route", sessionId: topic.sessionId, text, updateId };
}
