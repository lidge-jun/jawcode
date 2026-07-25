/**
 * Append-only context mode — stabilizes the byte prefix sent to the LLM
 * across turns so provider prefix caches (DeepSeek, Anthropic, etc.)
 * hit at the maximum possible rate.
 *
 * Two mechanisms:
 *
 * 1. **StablePrefix** — system prompt + tool specs are computed once
 *    and frozen. Subsequent turns reuse the exact same byte sequence
 *    unless `invalidate()` is called (e.g. after MCP reconnect).
 *
 * 2. **AppendOnlyLog** — messages only grow; prior turns are never
 *    re-serialized. Combined with a stable prefix, only the user's new
 *    message delta is a cache miss each turn.
 */

import type { Context, Message, Tool } from "@jawcode-dev/ai";
import { normalizeTools } from "./agent-loop";
import type { AgentContext } from "./types";

// ---------------------------------------------------------------------------
// StablePrefix (formerly ImmutablePrefix)
// ---------------------------------------------------------------------------

/** Frozen system prompt + tool spec snapshot. */
export interface StablePrefixSnapshot {
	systemPrompt: string[];
	tools: Tool[];
	fingerprint: string;
}

/** Options threaded through `build()` so the snapshot reflects loop-time settings. */
export interface BuildOptions {
	/** Inject the `_i` intent field into tool schemas (must match agent-loop's normalizeTools). */
	intentTracing: boolean;
}

/**
 * A frozen prefix (system prompt + tools) that produces stable byte
 * sequences across `build()` calls.
 *
 * The first `build()` snapshots the live state. Subsequent calls reuse
 * the cached copy until `invalidate()` is called or the live state's
 * fingerprint changes.
 */
export class StablePrefix {
	#snapshot: StablePrefixSnapshot | null = null;
	#version = 0;

	get fingerprint(): string {
		return this.#snapshot?.fingerprint ?? "<unbuilt>";
	}
	get version(): number {
		return this.#version;
	}
	get built(): boolean {
		return this.#snapshot !== null;
	}

	exportSnapshot(): StablePrefixSnapshot | null {
		return this.#snapshot ? cloneJson(this.#snapshot) : null;
	}

	importSnapshot(snapshot: StablePrefixSnapshot, options: BuildOptions): void {
		const systemPrompt = cloneJson(snapshot.systemPrompt);
		const tools = normalizeImportedTools(snapshot.tools, options);
		const fingerprint = computeFingerprint(systemPrompt, tools, options);
		if (fingerprint !== snapshot.fingerprint) {
			throw new Error(
				`StablePrefix.importSnapshot() fingerprint mismatch: expected ${fingerprint}, received ${snapshot.fingerprint}`,
			);
		}
		this.#snapshot = { systemPrompt, tools, fingerprint };
		this.#version++;
	}

	/**
	 * Build or rebuild from live context.
	 * Returns `true` if the prefix actually changed (cache miss imminent).
	 */
	build(context: AgentContext, options: BuildOptions): boolean {
		const snapshot = takeSnapshot(context, options);
		if (this.#snapshot && this.#snapshot.fingerprint === snapshot.fingerprint) {
			return false;
		}
		this.#snapshot = snapshot;
		this.#version++;
		return true;
	}

	/** Force rebuild on the next `build()` call. */
	invalidate(): void {
		this.#snapshot = null;
	}

	/**
	 * Returns the cached prefix.
	 * @throws if `build()` was never called.
	 */
	toContext(): { systemPrompt: string[]; tools: Tool[] } {
		const s = this.#snapshot;
		if (!s) throw new Error("StablePrefix.toContext() called before build()");
		return { systemPrompt: cloneJson(s.systemPrompt), tools: cloneJson(s.tools) };
	}
}

// ---------------------------------------------------------------------------
// AppendOnlyLog
// ---------------------------------------------------------------------------

/**
 * Append-only message log at the `Message[]` (provider-level) layer.
 *
 * The only mutation path is `replaceTail()`, reserved for compaction.
 * Every other operation is append-only.
 */
export class AppendOnlyLog {
	#entries: Message[] = [];

	get length(): number {
		return this.#entries.length;
	}

	append(message: any): void {
		this.#entries.push(message);
	}

	extend(messages: any[]): void {
		for (const m of messages) this.#entries.push(m);
	}

	/** Replace the last entry — only legal for compaction. */
	replaceTail(replacement: any): void {
		const idx = this.#entries.length - 1;
		if (idx >= 0) this.#entries[idx] = replacement;
	}

	/** Returns a shallow copy of all entries. */
	toMessages(): Message[] {
		return this.#entries.slice();
	}

	/** Direct readonly access for in-place inspection. */
	entries(): readonly Message[] {
		return this.#entries;
	}

	/**
	 * Drop entries past index `count`, keeping the first `count` byte-stable.
	 * Used by {@link AppendOnlyContextManager.syncMessages} to preserve the
	 * already-on-the-wire prefix when a later message diverges, instead of
	 * clearing the whole log and forcing the provider to re-prefill from the
	 * end of the system prompt.
	 */
	truncate(count: number): void {
		if (count < 0) count = 0;
		if (count >= this.#entries.length) return;
		this.#entries.length = count;
	}

	clear(): void {
		this.#entries = [];
	}
}

// ---------------------------------------------------------------------------
// AppendOnlyContextManager
// ---------------------------------------------------------------------------

/**
 * Manages a stable prefix + append-only log for the agent loop.
 *
 * Call `build(context)` each turn to get a `Context` with stable
 * `systemPrompt` and `tools` and append-only messages. Call
 * `syncMessages(normalizedMessages)` after `convertToLlm` each
 * turn to keep the log in sync.
 *
 * Example:
 * ```
 * const mgr = new AppendOnlyContextManager();
 * const ctx = mgr.build(context);  // first call snapshots prefix
 * mgr.syncMessages(normalized);    // grow the log
 * ctx = mgr.build(context);        // subsequent calls use cache
 * ```
 */
export class AppendOnlyContextManager {
	readonly prefix = new StablePrefix();
	readonly log = new AppendOnlyLog();
	/** How many normalized messages were synced into the log as of the last sync. */
	#lastSyncCount = 0;
	/**
	 * Per-message digests of the synced log. Lets a deep or tail rewrite
	 * (per-turn pruning, image strip, transformContext re-render) preserve
	 * the byte-stable prefix up to the divergence point instead of clearing
	 * and re-appending the entire conversation — keeping the provider's
	 * prompt-cache hit rate high on local backends (llama.cpp/Ollama).
	 */
	#messageDigests: number[] = [];
	/** Number of provider-normalized messages that were seeded before child-local messages. */
	#seededPrefixCount = 0;

	static forkFromSeed(args: {
		prefixSnapshot?: StablePrefixSnapshot;
		messages?: readonly Message[];
		options: BuildOptions;
	}): AppendOnlyContextManager {
		const manager = new AppendOnlyContextManager();
		if (args.prefixSnapshot) {
			manager.prefix.importSnapshot(args.prefixSnapshot, args.options);
		}
		if (args.messages) {
			manager.seedNormalizedMessages(args.messages);
		}
		return manager;
	}

	build(context: AgentContext, options: BuildOptions): Context {
		this.prefix.build(context, options);
		const { systemPrompt, tools } = this.prefix.toContext();
		return { systemPrompt, messages: this.log.toMessages(), tools };
	}

	/**
	 * Sync normalized (provider-level) messages into the append-only log.
	 *
	 * Three cases:
	 *
	 * 1. **Append**: same prefix, new tail → push the new entries.
	 * 2. **Compaction**: shorter array → clear the log and replay.
	 * 3. **In-place rewrite** (per-turn pruning, transformContext re-render,
	 *    image strip): find the longest byte-stable prefix between the
	 *    previously-synced messages and the new ones, truncate the log down
	 *    to that prefix, then append the diverged tail. Earlier revisions
	 *    cleared the whole log on any change, forcing local backends to
	 *    re-prefill the entire conversation every turn a prune pass rewrote
	 *    one message. Preserving the stable prefix keeps the provider KV
	 *    cache warm up to the divergence point.
	 */
	syncMessages(normalizedMessages: any[]): void {
		const seededPrefix = this.#seededPrefixCount > 0 ? this.log.toMessages().slice(0, this.#seededPrefixCount) : [];
		const includesSeedPrefix =
			seededPrefix.length > 0 &&
			normalizedMessages.length >= seededPrefix.length &&
			this.#messagesDigestEqual(normalizedMessages.slice(0, seededPrefix.length), seededPrefix);
		const messagesToSync =
			seededPrefix.length > 0 && !includesSeedPrefix ? [...seededPrefix, ...normalizedMessages] : normalizedMessages;

		// Compaction — array shrunk. Seeded forks preserve the inherited prefix
		// and append child-local deltas, so a shorter child message array is not a
		// compaction signal while a seed prefix is active.
		if (messagesToSync.length < this.#lastSyncCount) {
			if (this.#seededPrefixCount > 0) {
				throw new Error("AppendOnlyContextManager.syncMessages() cannot compact a seeded fork without reset");
			}
			this.log.clear();
			this.#lastSyncCount = 0;
			this.#messageDigests = [];
		}

		// In-place rewrite: trim the log down to the longest byte-stable prefix
		// shared by the previous sync and the new messages, then re-append the
		// diverged tail. Bound by the physical log length because `log.clear()`
		// is public — a direct clear (advisor reset) can leave the sync cursor
		// ahead of the log.
		if (this.#lastSyncCount > 0) {
			const stableCount = Math.min(this.#longestStablePrefix(messagesToSync), this.log.length);
			if (stableCount < this.#lastSyncCount) {
				// A seeded fork must never rewrite the inherited (seed) region;
				// child-local divergence past the seed prefix is allowed.
				if (this.#seededPrefixCount > 0 && stableCount < this.#seededPrefixCount) {
					throw new Error("AppendOnlyContextManager.syncMessages() seed prefix changed");
				}
				this.log.truncate(stableCount);
				this.#lastSyncCount = stableCount;
				this.#messageDigests.length = stableCount;
			}
		}

		// Append the diverged tail (or the full delta on a normal turn).
		for (let i = this.#lastSyncCount; i < messagesToSync.length; i++) {
			const msg = messagesToSync[i];
			this.log.append(msg);
			this.#messageDigests.push(this.#messageDigest(msg));
		}
		this.#lastSyncCount = messagesToSync.length;
	}

	seedNormalizedMessages(messages: readonly Message[], options?: { reset?: boolean }): void {
		if (this.log.length > 0 && options?.reset !== true) {
			throw new Error("AppendOnlyContextManager.seedNormalizedMessages() cannot seed a non-empty log without reset");
		}
		const clonedMessages = cloneJson([...messages]);
		this.log.clear();
		this.log.extend(clonedMessages);
		this.#lastSyncCount = clonedMessages.length;
		this.#messageDigests = clonedMessages.map(m => this.#messageDigest(m));
		this.#seededPrefixCount = clonedMessages.length;
	}

	/** Reset prefix + log for a model/provider switch while mode stays active. */
	invalidateForModelChange(): void {
		this.prefix.invalidate();
		this.log.clear();
		this.#lastSyncCount = 0;
		this.#messageDigests = [];
		this.#seededPrefixCount = 0;
	}

	/** Reset the sync cursor AND clear the log. */
	resetSyncCursor(): void {
		this.log.clear();
		this.#lastSyncCount = 0;
		this.#messageDigests = [];
		this.#seededPrefixCount = 0;
	}

	appendMessage(message: any): void {
		this.log.append(message);
	}

	replaceTailMessage(message: any): void {
		this.log.replaceTail(message);
	}

	invalidate(): void {
		this.prefix.invalidate();
	}

	reset(context: AgentContext, options: BuildOptions): void {
		this.prefix.invalidate();
		this.log.clear();
		this.#lastSyncCount = 0;
		this.#messageDigests = [];
		this.#seededPrefixCount = 0;
		this.prefix.build(context, options);
	}

	/**
	 * Index of the first message whose serialized bytes differ from the
	 * previously-synced log; equals `min(#lastSyncCount, messages.length)`
	 * when nothing diverged.
	 */
	#longestStablePrefix(messages: readonly unknown[]): number {
		const bound = Math.min(this.#lastSyncCount, messages.length);
		for (let i = 0; i < bound; i++) {
			if (this.#messageDigest(messages[i]) !== this.#messageDigests[i]) {
				return i;
			}
		}
		return bound;
	}

	/** True when two message arrays are element-wise digest-equal. */
	#messagesDigestEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (this.#messageDigest(a[i]) !== this.#messageDigest(b[i])) return false;
		}
		return true;
	}

	/**
	 * Deterministic digest over every field the provider may serialize — role,
	 * content, tool calls (both `toolCalls` and OpenAI-wire `tool_calls`),
	 * tool-result correlation (`toolCallId`/`tool_call_id`), tool name
	 * (`toolName`/`name`), the error flag (`isError`), the transport-native
	 * `providerPayload`, and `id` — so an in-place rewrite of *any* of these
	 * fields is visible to {@link #longestStablePrefix}. Tool-result metadata
	 * and provider payloads must be hashed because a re-render can mutate them
	 * without touching `content`, which would otherwise slip past the stable
	 * prefix and silently desync the provider's KV cache. Hashed with an
	 * FNV-style rolling accumulator.
	 */
	#messageDigest(msg: unknown): number {
		if (!msg || typeof msg !== "object") return 0;
		const m = msg as Record<string, unknown>;
		const payload = JSON.stringify({
			r: m.role ?? null,
			c: m.content ?? null,
			tc: m.toolCalls ?? m.tool_calls ?? null,
			tcid: m.toolCallId ?? m.tool_call_id ?? null,
			tn: m.toolName ?? m.name ?? null,
			err: m.isError ?? null,
			pp: m.providerPayload ?? null,
			id: m.id ?? null,
		});
		let hash = 0;
		for (let j = 0; j < payload.length; j++) {
			hash = ((hash << 5) - hash + payload.charCodeAt(j)) | 0;
		}
		return hash >>> 0;
	}
}

// ---------------------------------------------------------------------------
// Snapshot helpers
// ---------------------------------------------------------------------------

function takeSnapshot(context: AgentContext, options: BuildOptions): StablePrefixSnapshot {
	const systemPrompt = [...context.systemPrompt];
	const tools = normalizeTools(context.tools, options.intentTracing) ?? [];
	return {
		systemPrompt,
		tools,
		fingerprint: computeFingerprint(systemPrompt, tools, options),
	};
}

function normalizeImportedTools(tools: readonly Tool[], options: BuildOptions): Tool[] {
	const clonedTools = cloneJson(tools);
	const normalizedTools = normalizeTools(clonedTools as AgentContext["tools"], options.intentTracing) ?? [];
	return cloneJson(normalizedTools);
}

export function cloneJson<T>(value: T): T {
	return cloneJsonValue(value) as T;
}

function cloneJsonValue(value: unknown, key = "", applyToJson = true): unknown {
	if (value === null) return null;
	const type = typeof value;
	if (type === "number") return Number.isFinite(value) ? value : null;
	// JSON.stringify drops function/symbol/undefined values (object props
	// omitted, array elements become null via the array walk below).
	if (type === "undefined" || type === "function" || type === "symbol") return undefined;
	if (type !== "object") return value;
	if (applyToJson) {
		// JSON.stringify performs a single Get of `toJSON` per holder/key and
		// serializes the returned replacement WITHOUT re-dispatching the
		// replacement's own toJSON at the same level (nested properties still
		// dispatch normally). Mirror that exactly to keep byte parity.
		const toJSON = (value as { toJSON?: unknown }).toJSON;
		if (typeof toJSON === "function") {
			return cloneJsonValue(toJSON.call(value, key), key, false);
		}
	}
	if (Array.isArray(value)) {
		const cloned: unknown[] = new Array(value.length);
		for (let i = 0; i < value.length; i++) {
			const item = Object.hasOwn(value, i) ? cloneJsonValue(value[i], String(i)) : undefined;
			cloned[i] = item === undefined ? null : item;
		}
		return cloned;
	}
	const cloned: Record<string, unknown> = {};
	for (const key of Object.keys(value as object)) {
		const clonedValue = cloneJsonValue((value as Record<string, unknown>)[key], key);
		if (clonedValue !== undefined) cloned[key] = clonedValue;
	}
	return cloned;
}

function computeFingerprint(systemPrompt: string[], tools: Tool[], options: BuildOptions): string {
	const payload = JSON.stringify({
		s: systemPrompt,
		t: tools.map(t => ({
			n: t.name,
			d: t.description,
			p: t.parameters,
			s: t.strict,
			cf: t.customFormat,
			cw: t.customWireName,
		})),
		i: options.intentTracing,
	});
	let hash = 0;
	for (let i = 0; i < payload.length; i++) {
		hash = ((hash << 5) - hash + payload.charCodeAt(i)) | 0;
	}
	return (hash >>> 0).toString(36);
}
