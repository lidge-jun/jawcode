/**
 * Tool output pruning utilities for compaction.
 */

import type { ToolResultMessage } from "@jawcode-dev/ai";
import type { Encoding } from "@jawcode-dev/natives";
import type { AgentMessage } from "../types";
import { countMessageTokensNative, estimateTokens } from "./compaction";
import type { SessionEntry, SessionMessageEntry } from "./entries";

export interface PruneConfig {
	/** Keep the most recent tool output tokens intact. */
	protectTokens: number;
	/** Only prune if total savings meets this threshold. */
	minimumSavings: number;
	/** Tool names that should never be pruned unless staleness explicitly overrides them. */
	protectedTools: string[];
	/** Protected tools whose stale results may still be pruned. */
	staleOverridableTools?: string[];
}

export const DEFAULT_PRUNE_CONFIG: PruneConfig = {
	protectTokens: 40_000,
	minimumSavings: 20_000,
	protectedTools: ["skill", "read"],
	staleOverridableTools: ["read"],
};

export interface PruneResult {
	prunedCount: number;
	tokensSaved: number;
	prunedEntries: SessionMessageEntry[];
}

interface ToolResultMeta {
	entry: SessionMessageEntry;
	message: ToolResultMessage;
	args: Record<string, unknown>;
}

const DIGEST_NOTICE_TOKEN_CAP_MULTIPLIER = 1.25;
const DIGEST_NOTICE_MIN_EXTRA_TOKENS = 24;

function createGenericPrunedNotice(tokens: number): string {
	return `[Output truncated - ${tokens} tokens]`;
}

function firstTextContent(message: ToolResultMessage): string {
	if (typeof message.content === "string") return message.content;
	const block = message.content.find(part => part.type === "text");
	return block?.type === "text" ? block.text : "";
}

function firstErrorLine(text: string): string | undefined {
	return text
		.split(/\r?\n/)
		.find(line => /error|failed|exception|panic/i.test(line))
		?.trim();
}

function truncateField(value: string, maxLength: number): string {
	if (value.length <= maxLength) return value;
	if (maxLength <= 1) return "…";
	return `${value.slice(0, maxLength - 1)}…`;
}

function resultDigest(message: ToolResultMessage): string | undefined {
	const toolName = message.toolName.toLowerCase();
	const text = firstTextContent(message);
	if (toolName === "bash") {
		const details = asRecord((message as ToolResultMessage & { details?: unknown }).details);
		const exitCode = typeof details?.exitCode === "number" ? details.exitCode : message.isError ? 1 : 0;
		const tail = text.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? "";
		const error = firstErrorLine(text);
		return [`exit=${exitCode}`, tail ? `tail=${tail}` : undefined, error ? `error=${error}` : undefined]
			.filter((part): part is string => part !== undefined)
			.join("; ");
	}
	if (toolName === "search" || toolName === "grep") {
		const match = text.match(/(\d+)\s+matches?/i) ?? text.match(/totalMatches["']?:\s*(\d+)/i);
		const files = text.match(/(\d+)\s+files?/i) ?? text.match(/filesWithMatches["']?:\s*(\d+)/i);
		const error = firstErrorLine(text);
		return (
			[
				match ? `matches=${match[1]}` : undefined,
				files ? `files=${files[1]}` : undefined,
				error ? `error=${error}` : undefined,
			]
				.filter((part): part is string => part !== undefined)
				.join("; ") || "search digest unavailable"
		);
	}
	return undefined;
}

function createPrunedNotice(tokens: number, message?: ToolResultMessage): string {
	const generic = createGenericPrunedNotice(tokens);
	const digest = message ? resultDigest(message) : undefined;
	if (!digest) return generic;
	const genericTokens = Math.ceil(generic.length / 4);
	const maxTokens = Math.max(
		genericTokens + DIGEST_NOTICE_MIN_EXTRA_TOKENS,
		Math.floor(genericTokens * DIGEST_NOTICE_TOKEN_CAP_MULTIPLIER),
	);
	const prefix = `[Output truncated - ${tokens} tokens; `;
	const suffix = "]";
	const maxChars = Math.max(0, maxTokens * 4 - prefix.length - suffix.length);
	return `${prefix}${truncateField(digest, maxChars)}${suffix}`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function getToolResultMessage(entry: SessionEntry): ToolResultMessage | undefined {
	if (entry.type !== "message") return undefined;
	const message = entry.message as AgentMessage;
	if (message.role !== "toolResult") return undefined;
	return message as ToolResultMessage;
}

function getToolCallArgsById(entries: SessionEntry[]): Map<string, Record<string, unknown>> {
	const result = new Map<string, Record<string, unknown>>();
	for (const entry of entries) {
		if (entry.type !== "message") continue;
		const message = entry.message as AgentMessage;
		if (message.role !== "assistant") continue;
		for (const part of message.content) {
			const record = asRecord(part);
			if (record?.type !== "toolCall" || typeof record.id !== "string") continue;
			result.set(record.id, asRecord(record.arguments) ?? {});
		}
	}
	return result;
}

function estimatePrunedSavings(tokens: number, notice: string): number {
	const noticeTokens = Math.ceil(notice.length / 4);
	return Math.max(0, tokens - noticeTokens);
}

function baseReadPath(rawPath: unknown): string | undefined {
	if (typeof rawPath !== "string" || rawPath.length === 0) return undefined;
	const firstColon = rawPath.indexOf(":");
	return firstColon === -1 ? rawPath : rawPath.slice(0, firstColon);
}

function pathLike(args: Record<string, unknown>): unknown {
	return args.path ?? args.file_path ?? args.filePath;
}

function readPath(meta: ToolResultMeta): string | undefined {
	const details = asRecord((meta.message as ToolResultMessage & { details?: unknown }).details);
	const resolvedPath = details?.resolvedPath;
	return baseReadPath(typeof resolvedPath === "string" ? resolvedPath : pathLike(meta.args));
}

function stableValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(stableValue);
	const record = asRecord(value);
	if (!record) return value;
	return Object.fromEntries(
		Object.keys(record)
			.sort()
			.map(key => [key, stableValue(record[key])]),
	);
}

function searchKey(args: Record<string, unknown>): string | undefined {
	if (typeof args.pattern !== "string") return undefined;
	return JSON.stringify(
		stableValue({
			gitignore: args.gitignore,
			i: args.i,
			paths: args.paths,
			pattern: args.pattern,
			skip: args.skip,
		}),
	);
}

function filesFromPatchEnvelope(input: unknown): string[] {
	if (typeof input !== "string") return [];
	const files: string[] = [];
	for (const line of input.split(/\r?\n/)) {
		const update = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/.exec(line);
		if (update?.[1]) files.push(update[1]);
		const move = /^\*\*\* Move to: (.+)$/.exec(line);
		if (move?.[1]) files.push(move[1]);
	}
	return files;
}

function fileArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function successfulFilesFromDetails(detailsValue: unknown): string[] {
	const details = asRecord(detailsValue);
	if (!details) return [];
	const sourceDetails = asRecord(details.sourceResultDetails);
	const effective = sourceDetails ?? details;
	const directFiles = fileArray(effective.files);
	if (effective.applied === true && directFiles.length > 0) return directFiles;
	const perFileResults = Array.isArray(effective.perFileResults) ? effective.perFileResults : [];
	return perFileResults
		.map(asRecord)
		.filter(
			(item): item is Record<string, unknown> => !!item && item.isError !== true && typeof item.path === "string",
		)
		.map(item => item.path as string);
}

function hasStructuredFileDetails(detailsValue: unknown): boolean {
	const details = asRecord(detailsValue);
	if (!details) return false;
	const sourceDetails = asRecord(details.sourceResultDetails);
	const effective = sourceDetails ?? details;
	return effective.applied === true || Array.isArray(effective.perFileResults);
}

function touchedFiles(meta: ToolResultMeta): string[] {
	if (
		meta.message.toolName !== "edit" &&
		meta.message.toolName !== "write" &&
		meta.message.toolName !== "apply_patch" &&
		meta.message.toolName !== "ast_edit" &&
		meta.message.toolName !== "resolve"
	) {
		return [];
	}
	const files = new Set<string>();
	const details = (meta.message as ToolResultMessage & { details?: unknown }).details;
	if (hasStructuredFileDetails(details)) {
		for (const file of successfulFilesFromDetails(details)) files.add(file);
		return [...files].map(baseReadPath).filter((file): file is string => !!file);
	}
	if (meta.message.isError) return [];
	const pathValue = pathLike(meta.args);
	if (typeof pathValue === "string") files.add(pathValue);
	for (const file of filesFromPatchEnvelope(meta.args.input)) files.add(file);
	return [...files].map(baseReadPath).filter((file): file is string => !!file);
}

function staleResultIds(entries: SessionEntry[]): Set<string> {
	const argsById = getToolCallArgsById(entries);
	const stale = new Set<string>();
	const seenReads = new Set<string>();
	const seenSearches = new Set<string>();
	const mutatedFiles = new Set<string>();

	for (let index = entries.length - 1; index >= 0; index--) {
		const entry = entries[index];
		const message = getToolResultMessage(entry);
		if (!message) continue;
		const meta: ToolResultMeta = {
			entry: entry as SessionMessageEntry,
			message,
			args: argsById.get(message.toolCallId) ?? {},
		};
		const touched = touchedFiles(meta);
		for (const file of touched) mutatedFiles.add(file);
		if (message.isError) continue;
		if (message.toolName === "read") {
			const file = readPath(meta);
			if (!file) continue;
			if (seenReads.has(file) || mutatedFiles.has(file)) stale.add(meta.entry.id);
			seenReads.add(file);
		} else if (message.toolName === "search") {
			const key = searchKey(meta.args);
			if (!key) continue;
			if (seenSearches.has(key)) stale.add(meta.entry.id);
			seenSearches.add(key);
		}
	}
	return stale;
}

export function pruneToolOutputs(
	entries: SessionEntry[],
	config: PruneConfig = DEFAULT_PRUNE_CONFIG,
	encoding?: Encoding,
): PruneResult {
	let accumulatedTokens = 0;
	let tokensSaved = 0;
	let prunedCount = 0;
	const prunedEntries: SessionMessageEntry[] = [];
	const staleIds = staleResultIds(entries);
	const staleOverridableTools = new Set(config.staleOverridableTools ?? []);

	const candidates: Array<{ entry: SessionMessageEntry; tokens: number; notice: string; savings: number }> = [];

	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		const message = getToolResultMessage(entry);
		if (!message) continue;

		const tokens = encoding
			? countMessageTokensNative(message as AgentMessage, encoding)
			: estimateTokens(message as AgentMessage);
		const isStale = staleIds.has(entry.id);
		const isProtected =
			config.protectedTools.includes(message.toolName) && !(isStale && staleOverridableTools.has(message.toolName));

		if (message.prunedAt !== undefined) {
			accumulatedTokens += tokens;
			continue;
		}

		if (!isStale && (accumulatedTokens < config.protectTokens || isProtected)) {
			accumulatedTokens += tokens;
			continue;
		}
		if (isProtected) {
			accumulatedTokens += tokens;
			continue;
		}

		const notice = createPrunedNotice(tokens, message);
		candidates.push({
			entry: entry as SessionMessageEntry,
			tokens,
			notice,
			savings: estimatePrunedSavings(tokens, notice),
		});
		accumulatedTokens += tokens;
	}

	for (const candidate of candidates) {
		tokensSaved += candidate.savings;
	}

	if (tokensSaved < config.minimumSavings || candidates.length === 0) {
		return { prunedCount: 0, tokensSaved: 0, prunedEntries: [] };
	}

	const prunedAt = Date.now();
	for (const candidate of candidates) {
		const message = candidate.entry.message as ToolResultMessage;
		message.content = [{ type: "text", text: candidate.notice }];
		message.prunedAt = prunedAt;
		prunedEntries.push(candidate.entry);
		prunedCount++;
	}

	return { prunedCount, tokensSaved, prunedEntries };
}
