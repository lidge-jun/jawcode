# WP2 — Cache-Friendly Summarization Prefix (③)

> Make `generateSummary` replay the live session prefix (system prompt + tools + exact
> message head) so providers hit the prompt cache, instead of serializing the whole
> conversation into an uncached `<conversation>` blob. Mirrors `generateHandoff` (which
> already passes the live prefix verbatim) and codex-rs compaction.

## Facts (investigation 2026-07-03, codex gpt-5.5 xhigh + self-verified)

- Live requests use `agent.state.systemPrompt` / `agent.state.tools` / `agent.state.messages`
  (agent.ts:1173-1179, agent-loop.ts:657-679). `#baseSystemPrompt` can diverge when a
  `before_agent_start` extension overrides the prompt (agent-session.ts:5149-5172) — use
  `agent.state.*`, not `#baseSystemPrompt`.
- Anthropic cache breakpoints: last tool, last system block, penultimate + last user message
  (anthropic.ts:1729-1804). Auto-compaction fires right after live turns, so cached prefixes
  from recent requests cover the summarize head; `toolChoice`/`max_tokens` are serialized
  outside the cached blocks. OpenAI Responses caches server-side by prefix with
  `prompt_cache_key` (openai-responses.ts:488-528).
- **History bytes are stable across thinking settings** (self-verified): the Anthropic
  serializer emits signed thinking blocks based on message content, regardless of the
  request's thinking option (anthropic.ts:2163-2214), and transform-messages preserves
  signed thinking for same-model replay (transform-messages.ts:175). So WP1's lowered
  summarization effort does not perturb replayed history bytes — same model only.
- **`messagesToSummarize` is NOT the live head**: it starts at `prevCompactionIndex + 1`
  (compaction.ts prepareCompaction), while the live context after a prior compaction is
  `[prev compactionSummary msg, kept(firstKept..prevIdx), post(prevIdx+1..)]`
  (session-manager.ts:666-723). Byte-identical replay must come from the live message array,
  not from `messagesToSummarize`.
- Compaction candidates can be fallback models (agent-session.ts:7608-7639); cache replay
  only helps (and only byte-matches thinking blocks) when candidate === session model.

## Design

### packages/agent/src/compaction/compaction.ts

1. Extend `SummaryOptions` with an optional `cachePrefix`:

```ts
/**
 * Live-session prefix for cache-friendly summarization. When set and the
 * candidate model matches `modelKey`, generateSummary replays this exact
 * prefix (system prompt, tools, message head) with the summarization
 * instruction appended as a trailing user message, so providers hit the
 * prompt cache instead of prefilling a serialized transcript. The serialized
 * `<conversation>` path remains the fallback.
 */
cachePrefix?: {
	/** `${provider}/${api}/${id}` of the live session model. */
	modelKey: string;
	/** Live agent system prompt, verbatim (agent.state.systemPrompt). */
	systemPrompt: string[];
	/** Live agent tools, verbatim; request uses toolChoice "none". */
	tools?: AgentTool<any>[];
	/** Exact live-context head: everything before turnPrefix/recent messages. */
	messages: AgentMessage[];
};
```

2. Add `summaryModelKey(model: Model): string` helper — joins `provider|api|id|baseUrl ?? ""`
   (audit fix: `Model.baseUrl` is part of endpoint identity, types.ts:891; credential lookup
   keys on it, model-registry.ts:2456) — exported for the agent-session call sites.

3. In `generateSummary`: when `options.cachePrefix` is set, `cachePrefix.modelKey ===
   summaryModelKey(model)`, `options.remoteEndpoint` is unset, and `model.api` is one of
   `anthropic-messages | openai-responses | openai-codex-responses`, build the request
   handoff-style instead of serializing:
   - `llmMessages = (options.convertToLlm ?? convertToLlm)(cachePrefix.messages)`
   - trailing user message text = continuation guard (the 3 lines of
     `summarization-system.md`, inlined since the live system prompt replaces
     `SUMMARIZATION_SYSTEM_PROMPT`) + `\n\n` + the same basePrompt selection as today
     (update vs initial prompt, `customInstructions`, `formatAdditionalContext(extraContext)`).
     No `<conversation>` wrapper. The `<previous-summary>` block IS kept when
     `previousSummary` exists (B-phase adjustment: `compaction-update-summary.md` references
     the tag explicitly, so dropping it would break the update prompt's semantics; the few-KB
     duplication with the replayed head is negligible next to the cache win).
   - `instrumentedCompleteSimple(model, { systemPrompt: cachePrefix.systemPrompt,
     messages: [...llmMessages, trailing], tools: cachePrefix.tools },
     { maxTokens, signal, apiKey, reasoning: clampThinkingLevelForModel(model, Effort.Low),
       toolChoice: "none", initiatorOverride, metadata },
     { telemetry, oneshotKind: "compaction_summary" })`
   - Progress event unchanged (`summarizing_history` / `local_summary`).
   - On non-matching modelKey / unsupported api / remoteEndpoint: existing serialized path
     unchanged. Short summary and turn-prefix summary stay on the serialized path (secondary
     calls; boundary complexity not worth it — investigation recommendation).

### packages/coding-agent/src/session/agent-session.ts

4. New private helper `#buildCompactionCachePrefix(preparation): SummaryOptions["cachePrefix"] | undefined`:
   - `const live = this.agent.state.messages`
   - `const tail = preparation.recentMessages.length + preparation.turnPrefixMessages.length`
   - `const head = live.slice(0, live.length - tail)`
   - Defensive gates — return `undefined` (serialized fallback) unless ALL hold:
     `head.length > 0`, `tail > 0`, and the live boundary message matches the entry-derived
     boundary. Boundary = `preparation.turnPrefixMessages[0] ?? preparation.recentMessages[0]`
     (turn prefix precedes recent in entry order when splitting). Match rule
     (delta-audit round-2 fix — role+timestamp alone can collide for same-millisecond
     custom messages):
     - ordinary LLM roles (`user`/`assistant`/`toolResult`/`bashExecution`): **reference
       equality required** (`live[head.length] === boundary`) — both builds share the
       persisted `entry.message` object (compaction.ts:162, session-manager.ts:647);
       anything else means the array shifted.
     - synthesized roles (fresh objects per build): role + timestamp equality PLUS
       role-specific content identity — `custom`/`hookMessage`: `customType` equal and
       stringified `content` equal; `branchSummary`: `fromId` and `summary` equal;
       `compactionSummary`: `summary` equal.
     Rationale: the gate guarantees the slice point sits exactly at the summarize/keep
     boundary. With content identity included, a false positive requires an
     identical-content twin at the same index — worst case one message's content is both
     summarized and kept (benign duplication), never context loss. Any mismatch →
     serialized fallback, never wrong output.
   - Returns `{ modelKey: summaryModelKey(this.model), systemPrompt:
     this.agent.state.systemPrompt, tools: this.agent.state.tools, messages: head }`.
5. Manual path (`#compactWithFallbackModel`, :7659-7679) and auto path (candidate loop,
   :8007-8033): pass `cachePrefix: candidateIsSessionModel ? this.#buildCompactionCachePrefix(preparation) : undefined`
   into the compact() options, where `candidateIsSessionModel` compares
   `summaryModelKey(candidate) === summaryModelKey(this.model)`. Fallback models never get it.

### Tests

- `packages/agent/test/` (new file `compaction-cache-prefix.test.ts`): with a mocked
  `completeSimple`, assert the cache path (a) passes systemPrompt/tools verbatim +
  `toolChoice: "none"`, (b) appends exactly one trailing user message containing the guard +
  base prompt, (c) does NOT serialize `<conversation>`, (d) falls back to the serialized path
  on modelKey mismatch, unsupported api, or `remoteEndpoint` set.
- `packages/coding-agent/test/compaction.test.ts`: `#buildCompactionCachePrefix` gating —
  boundary mismatch (shifted live array) → undefined; synthesized `custom_message` boundary
  still matches via role+timestamp; fallback-model candidate never receives cachePrefix
  (extend compaction-prefer-current-model.test.ts pattern if cleaner there).
- Existing suites must stay green (telemetry counts unchanged — same oneshot kinds).

### Verification gate

- `bun run check:ts` (repo contract, AGENTS.md:169 — not `npx tsc`) in packages/agent +
  packages/coding-agent (or repo-root `bun check`).
- `bun test` over compaction, compaction-telemetry, remote-compaction, handoff,
  compaction-prefer-current-model, issue-986-compaction-auth-fallback, build-context suites.

## Risks & mitigations

- **Continuation risk** (model continues the chat instead of summarizing): guard text moves
  into the trailing user message; codex-rs ships the same shape (history + trailing compact
  prompt) in production. Test (b) pins the guard's presence.
- **Runtime-divergent live array** (attachments/hook messages not in entries): reference
  -equality gate falls back to the serialized path — never wrong, just uncached.
- **Extension `transformContext` divergence**: live request bytes may differ from
  `state.messages` → cache miss only (correctness unaffected).
- **Tool-pair/thinking sanitization**: the replayed head IS the live shape; the same
  transform-messages/provider sanitizers apply (transform-messages.ts:230-383).
- Cost note: cache WRITE on first summarize adds ~25% input surcharge on Anthropic for
  uncached spans, offset by reads on the post-compaction turns that replay the same head.
