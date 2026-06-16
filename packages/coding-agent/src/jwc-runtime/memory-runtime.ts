/**
 * jwc memory/chat adapter (99.01 M1/M4) — cli-jaw-shaped verb surface over
 * the existing memory backends. The engines stay canonical owners of state;
 * this adapter routes verbs per backend id (off/local/hindsight), formats
 * results, and mirrors the `{stdout, stderr, status}` shape of
 * goal-runtime/orchestrate-runtime.
 *
 * Verbs: memory search <q> | memory read <ref> [--lines a-b] |
 *        memory save <file> <content...> [--kind k] | memory context <ref> |
 *        chat search <q> [--days N] [--recent N] [--context N]
 *
 * Immediate visibility contract (99.01.03 §0-1): `refreshBaseSystemPrompt()`
 * is session-scoped — a standalone CLI process cannot reach a live session,
 * so save relies on the watermark queue (and the optional `session` param
 * refreshes when the runtime is invoked in-session).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { getAgentDir, getSessionsDir, parseJsonlLenient } from "@jawcode-dev/utils";
import { Settings } from "../config/settings";
import { computeBankScope } from "../hindsight/bank";
import { createHindsightClient } from "../hindsight/client";
import { isHindsightConfigured, loadHindsightConfig } from "../hindsight/config";
import { getMemoryRoot } from "../memories/index";
import {
	browseLocalMemories,
	buildLocalTaskSnapshot,
	contextLocalMemory,
	getLocalMemoryStatus,
	type LocalMemoryKind,
	listLocalMemoryRefs,
	readLocalMemoryArtifact,
	reindexLocalMemoryFts,
	saveLocalMemoryManual,
	searchLocalMemories,
} from "../memories/local-query";
import { loadMemoryConfig } from "../memories/memory-config";
import { readMemoryModelResolution } from "../memories/memory-model-resolution";
import type { AgentSession } from "../session/agent-session";
import { getDefaultSessionDirName } from "../session/session-manager";

export interface MemoryCommandResult {
	stdout?: string;
	stderr?: string;
	status: number;
}

export interface MemoryRuntimeOptions {
	agentDir?: string;
	settings?: Settings;
	session?: AgentSession;
}

const VALID_KINDS: ReadonlySet<string> = new Set(["profile", "shared", "episode"]);
const CHAT_DEFAULT_DAYS = 7;
const CHAT_MAX_HITS = 50;

const MEMORY_USAGE = `Usage:
  memory search <query> [--cloud] [--scope path[,path...]]
  memory browse [--limit N]
  memory list [--limit N]
  memory status
  memory reindex
  memory read <ref> [--lines a-b]        ref: summary | memory | raw | stage1:<thread_id> | rollout:<slug>
  memory save <file> <content...> [--kind profile|shared|episode]
  memory context <ref>

(init is a follow-up — not in this surface yet)`;

const CHAT_USAGE = `Usage:
  chat search <query> [--days N] [--recent N] [--context N]`;

async function resolveSettings(cwd: string, options?: MemoryRuntimeOptions): Promise<Settings> {
	if (options?.settings) return options.settings;
	if (options?.session) return options.session.settings;
	return await Settings.init({ cwd });
}

function backendId(settings: Settings): string {
	const id = settings.get("memory.backend");
	return id === "hindsight" || id === "local" ? id : "off";
}

interface ParsedArgs {
	verb: string;
	positional: string[];
	flags: Map<string, string | true>;
}

function parseArgs(argv: string[]): ParsedArgs {
	const positional: string[] = [];
	const flags = new Map<string, string | true>();
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg.startsWith("--")) {
			const key = arg.slice(2);
			const next = argv[i + 1];
			if (next !== undefined && !next.startsWith("--")) {
				flags.set(key, next);
				i++;
			} else {
				flags.set(key, true);
			}
		} else {
			positional.push(arg);
		}
	}
	const verb = positional.shift() ?? "";
	return { verb, positional, flags };
}

function offBackendError(): MemoryCommandResult {
	return {
		stderr: 'memory backend is off — enable it with settings `memory.backend = "local"` (or "hindsight").\n',
		status: 1,
	};
}

export async function runNativeMemoryCommand(
	argv: string[],
	cwd: string,
	options?: MemoryRuntimeOptions,
): Promise<MemoryCommandResult> {
	const { verb, positional, flags } = parseArgs(argv);
	if (!verb || verb === "help") return { stdout: `${MEMORY_USAGE}\n`, status: verb ? 0 : 1 };

	const settings = await resolveSettings(cwd, options);
	const id = backendId(settings);
	const cloudSearch = verb === "search" && flags.has("cloud");
	if (id === "off" && !cloudSearch) return offBackendError();
	const agentDir = options?.agentDir ?? getAgentDir();

	try {
		switch (verb) {
			case "search": {
				const query = positional.join(" ").trim();
				if (!query) return { stderr: `memory search: missing <query>\n${MEMORY_USAGE}\n`, status: 1 };
				if (cloudSearch || id === "hindsight") return await hindsightSearch(settings, cwd, query);
				const memCfg = loadMemoryConfig(settings);
				const scopeRaw = flags.get("scope");
				const scopePaths =
					typeof scopeRaw === "string"
						? scopeRaw
								.split(",")
								.map(s => s.trim())
								.filter(Boolean)
						: undefined;
				const hits = searchLocalMemories(agentDir, cwd, query, memCfg.searchLimit, {
					scopePaths,
					searchMode: memCfg.searchMode,
				});
				if (hits.length === 0) return { stdout: "no memory hits\n", status: 0 };
				const body = hits.map(h => `${h.ref}${h.line ? `:${h.line}` : ""} [${h.kind}]\n  ${h.snippet}`).join("\n");
				return { stdout: `${body}\n`, status: 0 };
			}
			case "read": {
				const ref = positional[0];
				if (!ref) return { stderr: `memory read: missing <ref>\n${MEMORY_USAGE}\n`, status: 1 };
				if (id === "hindsight") return await hindsightRead(settings, cwd, ref);
				const lines = typeof flags.get("lines") === "string" ? (flags.get("lines") as string) : undefined;
				const result = readLocalMemoryArtifact(agentDir, cwd, ref, lines);
				if (!result) return { stderr: `memory read: unknown ref "${ref}"\n`, status: 1 };
				return { stdout: `${result.content}\n`, status: 0 };
			}
			case "save": {
				const file = positional[0];
				const content = positional.slice(1).join(" ").trim();
				if (!file || !content)
					return { stderr: `memory save: missing <file> <content>\n${MEMORY_USAGE}\n`, status: 1 };
				const kindFlag = flags.get("kind");
				let kind: LocalMemoryKind | undefined;
				if (typeof kindFlag === "string") {
					if (!VALID_KINDS.has(kindFlag)) {
						return { stderr: `memory save: invalid --kind "${kindFlag}" (profile|shared|episode)\n`, status: 1 };
					}
					kind = kindFlag as LocalMemoryKind;
				}
				if (id === "hindsight") return await hindsightSave(settings, cwd, file, content, kind);
				const saved = saveLocalMemoryManual(agentDir, cwd, file, content, kind);
				// In-session saves refresh the prompt immediately; standalone CLI
				// saves surface on the next rebuild/phase2 (99.01.03 §0-1).
				await options?.session?.refreshBaseSystemPrompt?.();
				return { stdout: `saved ${saved.threadId} (phase2 enqueued)\n`, status: 0 };
			}
			case "browse": {
				const limitFlag = flags.get("limit");
				let limit = loadMemoryConfig(settings).browseLimit;
				if (typeof limitFlag === "string") {
					const parsed = Number.parseInt(limitFlag, 10);
					if (!Number.isFinite(parsed) || parsed < 1) {
						return { stderr: `memory browse: invalid --limit "${limitFlag}"\n`, status: 1 };
					}
					limit = parsed;
				}
				if (id !== "local") {
					return { stderr: `memory browse: not supported for hindsight backend yet\n`, status: 1 };
				}
				const rows = browseLocalMemories(agentDir, cwd, limit);
				if (rows.length === 0) return { stdout: "no memory entries\n", status: 0 };
				const body = rows
					.map(r => `${r.ref} [${r.kind}] updated=${new Date(r.updatedAt * 1000).toISOString()}\n  ${r.snippet}`)
					.join("\n");
				return { stdout: `${body}\n`, status: 0 };
			}
			case "context": {
				const ref = positional[0];
				if (!ref) return { stderr: `memory context: missing <ref>\n${MEMORY_USAGE}\n`, status: 1 };
				if (id === "hindsight") return await hindsightRead(settings, cwd, ref);
				const ctx = contextLocalMemory(agentDir, cwd, ref);
				if (!ctx) return { stderr: `memory context: unknown ref "${ref}"\n`, status: 1 };
				const lines = [
					`thread: ${ctx.threadId} (source: ${ctx.sourceKind}, updated: ${new Date(ctx.updatedAt * 1000).toISOString()})`,
					`record: ${ctx.record}`,
				];
				if (ctx.rolloutExcerpt) lines.push(`rollout evidence (${ctx.rolloutPath}):\n${ctx.rolloutExcerpt}`);
				return { stdout: `${lines.join("\n")}\n`, status: 0 };
			}
			case "list": {
				const limitFlag = flags.get("limit");
				let limit = loadMemoryConfig(settings).browseLimit;
				if (typeof limitFlag === "string") {
					const parsed = Number.parseInt(limitFlag, 10);
					if (!Number.isFinite(parsed) || parsed < 1) {
						return { stderr: `memory list: invalid --limit "${limitFlag}"\n`, status: 1 };
					}
					limit = parsed;
				}
				if (id !== "local") {
					return { stderr: `memory list: not supported for hindsight backend yet\n`, status: 1 };
				}
				const refs = listLocalMemoryRefs(agentDir, cwd, limit);
				if (refs.length === 0) return { stdout: "no memory entries\n", status: 0 };
				return { stdout: `${refs.join("\n")}\n`, status: 0 };
			}
			case "status": {
				if (id !== "local") {
					return { stdout: `backend: ${id}\n`, status: 0 };
				}
				const st = getLocalMemoryStatus(agentDir, cwd);
				const lines = [
					"backend: local",
					`stage1_rows: ${st.stage1Count}`,
					`fts_stage1_indexed: ${st.ftsStage1IndexedCount}`,
					`fts_artifact_indexed: ${st.ftsArtifactIndexedCount}`,
					`search_mode: ${loadMemoryConfig(settings).searchMode}`,
					`artifact_profile: ${st.artifactProfile ? "yes" : "no"}`,
					`artifact_summary: ${st.artifactSummary ? "yes" : "no"}`,
					`pending_global_jobs: ${st.pendingGlobalJobs}`,
				];
				const resolution = await readMemoryModelResolution(agentDir, cwd);
				if (resolution) {
					lines.push(`memory_model: ${resolution.provider}/${resolution.modelId} (${resolution.source})`);
				} else if (loadMemoryConfig(settings).modelRolePattern) {
					lines.push(`memory_model_pattern: ${loadMemoryConfig(settings).modelRolePattern}`);
				}
				return { stdout: `${lines.join("\n")}\n`, status: 0 };
			}
			case "reindex": {
				if (id !== "local") {
					return { stderr: `memory reindex: not supported for hindsight backend yet\n`, status: 1 };
				}
				const memoryRoot = getMemoryRoot(agentDir, cwd);
				const { indexedStage1, indexedArtifacts } = reindexLocalMemoryFts(agentDir, memoryRoot);
				return {
					stdout: `reindexed stage1=${indexedStage1} artifacts=${indexedArtifacts} (FTS5)\n`,
					status: 0,
				};
			}
			case "init":
				return { stderr: `memory ${verb}: not in this surface yet (follow-up — 99.01 scope)\n`, status: 1 };
			default:
				return { stderr: `memory: unknown verb "${verb}"\n${MEMORY_USAGE}\n`, status: 1 };
		}
	} catch (error) {
		return { stderr: `memory ${verb} failed: ${String(error)}\n`, status: 1 };
	}
}

/** Per-turn Task Snapshot body for the local backend (M6 consumes this). */
export function buildMemoryTaskSnapshot(agentDir: string, cwd: string, promptText: string): string | null {
	return buildLocalTaskSnapshot(agentDir, cwd, promptText, 4);
}

// ── hindsight thin wiring ────────────────────────────────────────────────────

function hindsightClientFor(settings: Settings, cwd: string) {
	const config = loadHindsightConfig(settings);
	if (!isHindsightConfigured(config)) return null;
	return { client: createHindsightClient(config), scope: computeBankScope(config, cwd) };
}

async function hindsightSearch(settings: Settings, cwd: string, query: string): Promise<MemoryCommandResult> {
	const resolved = hindsightClientFor(settings, cwd);
	if (!resolved) return { stderr: "hindsight backend is selected but not configured\n", status: 1 };
	const response = await resolved.client.recall(resolved.scope.bankId, query, { tags: resolved.scope.recallTags });
	const entries = response.results ?? [];
	if (entries.length === 0) return { stdout: "no memory hits\n", status: 0 };
	const body = entries
		.slice(0, 8)
		.map(
			(r: { id?: string; text?: string; content?: string }) =>
				`${r.id ?? "?"}\n  ${(r.text ?? r.content ?? "").slice(0, 700)}`,
		)
		.join("\n");
	return { stdout: `${body}\n`, status: 0 };
}

async function hindsightRead(settings: Settings, cwd: string, ref: string): Promise<MemoryCommandResult> {
	const resolved = hindsightClientFor(settings, cwd);
	if (!resolved) return { stderr: "hindsight backend is selected but not configured\n", status: 1 };
	const doc = await resolved.client.getDocument(resolved.scope.bankId, ref);
	if (!doc) return { stderr: `memory read: unknown document "${ref}"\n`, status: 1 };
	return { stdout: `${JSON.stringify(doc, null, 2)}\n`, status: 0 };
}

async function hindsightSave(
	settings: Settings,
	cwd: string,
	file: string,
	content: string,
	kind?: LocalMemoryKind,
): Promise<MemoryCommandResult> {
	const resolved = hindsightClientFor(settings, cwd);
	if (!resolved) return { stderr: "hindsight backend is selected but not configured\n", status: 1 };
	await resolved.client.retain(resolved.scope.bankId, content, {
		documentId: file,
		tags: resolved.scope.retainTags,
		metadata: kind ? { kind } : undefined,
	});
	return { stdout: `retained ${file}\n`, status: 0 };
}

// ── chat search (session-crossing rollout grep) ─────────────────────────────

interface ChatHit {
	timestamp: string;
	role: string;
	text: string;
	file: string;
}

function extractMessageText(message: unknown): string {
	if (typeof message === "string") return message;
	if (!message || typeof message !== "object") return "";
	const m = message as { content?: unknown; text?: unknown };
	if (typeof m.text === "string") return m.text;
	if (typeof m.content === "string") return m.content;
	if (Array.isArray(m.content)) {
		return m.content
			.map(part => (typeof part === "string" ? part : ((part as { text?: string })?.text ?? "")))
			.filter(Boolean)
			.join(" ");
	}
	return "";
}

export async function runNativeChatCommand(
	argv: string[],
	cwd: string,
	options?: MemoryRuntimeOptions,
): Promise<MemoryCommandResult> {
	const { verb, positional, flags } = parseArgs(argv);
	if (verb !== "search") return { stderr: `${CHAT_USAGE}\n`, status: verb === "help" ? 0 : 1 };
	const query = positional.join(" ").trim();
	if (!query) return { stderr: `chat search: missing <query>\n${CHAT_USAGE}\n`, status: 1 };

	const days = Number(flags.get("days")) || CHAT_DEFAULT_DAYS;
	const recent = Number(flags.get("recent")) || 0;
	const contextN = Number(flags.get("context")) || 0;
	const agentDir = options?.agentDir ?? getAgentDir();

	const { encodedDirName } = getDefaultSessionDirName(cwd);
	const sessionDir = path.join(getSessionsDir(agentDir), encodedDirName);
	if (!fs.existsSync(sessionDir)) return { stdout: "no sessions for this project\n", status: 0 };

	const cutoffMs = Date.now() - days * 86_400_000;
	const files = fs
		.readdirSync(sessionDir)
		.filter(f => f.endsWith(".jsonl"))
		.map(f => path.join(sessionDir, f))
		.map(p => ({ p, mtime: fs.statSync(p).mtimeMs }))
		.filter(({ mtime }) => mtime >= cutoffMs)
		.sort((a, b) => b.mtime - a.mtime);

	const lowered = query.toLowerCase();
	const hits: ChatHit[] = [];
	for (const { p } of files) {
		if (hits.length >= CHAT_MAX_HITS) break;
		let raw: string;
		try {
			raw = fs.readFileSync(p, "utf8");
		} catch {
			continue;
		}
		const entries = parseJsonlLenient(raw) as Array<Record<string, unknown>>;
		let seenInFile = 0;
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			if (entry?.type !== "message") continue;
			const message = entry.message as { role?: string } | undefined;
			const text = extractMessageText(entry.message);
			if (!text.toLowerCase().includes(lowered)) continue;
			const push = (e: Record<string, unknown>, marker: string) => {
				const m = e.message as { role?: string } | undefined;
				hits.push({
					timestamp: String(e.timestamp ?? ""),
					role: `${marker}${m?.role ?? "?"}`,
					text: extractMessageText(e.message).slice(0, 300),
					file: path.basename(p),
				});
			};
			if (contextN > 0) {
				const around = entries
					.slice(Math.max(0, i - contextN), i + contextN + 1)
					.filter(e => e?.type === "message" && e !== entry);
				for (const e of around.slice(0, contextN)) push(e, "  ~");
			}
			hits.push({
				timestamp: String(entry.timestamp ?? ""),
				role: message?.role ?? "?",
				text: text.slice(0, 300),
				file: path.basename(p),
			});
			seenInFile++;
			if (recent > 0 && hits.length >= recent) break;
			if (seenInFile >= 10 || hits.length >= CHAT_MAX_HITS) break;
		}
		if (recent > 0 && hits.length >= recent) break;
	}

	if (hits.length === 0) return { stdout: "no chat hits\n", status: 0 };
	const body = hits.map(h => `[${h.timestamp}] (${h.role}) ${h.text}  — ${h.file}`).join("\n");
	return { stdout: `${body}\n`, status: 0 };
}
