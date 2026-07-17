# Evidence Receipt: Hook Verification

Date: 2026-07-09
Repo: /Users/jun/Developer/new/700_projects/jawcode

## rg refusal helper
Command: rg -n "isRefusalErrorMessage" packages/coding-agent/src/session/agent-session.ts
8371:	#isRefusalErrorMessage(errorMessage: string): boolean {
8412:		if (this.#isRefusalErrorMessage(err)) return "terminal";
exit=0

## rg Anthropic disabled-thinking branch absence
Command: rg -n "thinkingEnabled.*false" packages/ai/src/providers/anthropic.ts
exit=1 (expected 1: no matches)

## focused tests
Command: bun test packages/ai/test/openai-bounded-rate-limits.test.ts packages/ai/test/anthropic-alignment.test.ts packages/coding-agent/test/agent-session-resilient-retry.test.ts
bun test v1.3.14 (0d9b296a)

packages/coding-agent/test/agent-session-resilient-retry.test.ts:
(pass) AgentSession resilient retry > retries transient errors past retry.maxRetries (unbounded) [119.43ms]
(pass) AgentSession resilient retry > retries unknown / no-code errors [55.12ms]
(pass) AgentSession resilient retry > surfaces terminal coded errors without retrying [49.40ms]
(pass) AgentSession resilient retry > surfaces provider safety refusals without retrying [49.20ms]
(pass) AgentSession resilient retry > surfaces deliberate request aborts without retrying [50.33ms]
(pass) AgentSession resilient retry > retries network-abort style errors (not deliberate request aborts) [50.30ms]
(pass) AgentSession resilient retry > does not retry when retry.enabled is false [50.71ms]
(pass) AgentSession resilient retry > retryNow skips the backoff and re-attempts immediately [101.73ms]
(pass) AgentSession resilient retry > abortRetry cancels the retry and surfaces the error [99.56ms]
(pass) AgentSession resilient retry > surfaces 400 bad-request errors without retrying [46.18ms]
(pass) AgentSession resilient retry > surfaces numeric HTTP 4xx (status context) without retrying [49.44ms]
(pass) AgentSession resilient retry > surfaces explicit HTTP 400 messages even when text contains transient substrings [54.46ms]
(pass) AgentSession resilient retry > surfaces structured HTTP 400 even when text contains transient substrings [50.97ms]
(pass) AgentSession resilient retry > surfaces explicit status-code 4xx errors without retrying [51.19ms]
(pass) AgentSession resilient retry > retries rate-limit text with incidental 4xx numbers even when provider status extraction says 400 [51.00ms]
(pass) AgentSession resilient retry > does not terminalize retryable explicit HTTP statuses [49.52ms]
(pass) AgentSession resilient retry > emits auto_retry_end when a retry ends on a terminal error [49.83ms]
(pass) AgentSession resilient retry > honors retryNow() invoked synchronously from the auto_retry_start subscriber [49.14ms]

packages/ai/test/anthropic-alignment.test.ts:
(pass) Anthropic request fingerprint alignment > maps Stainless OS and arch values from explicit inputs [0.04ms]
(pass) Anthropic request fingerprint alignment > uses runtime Stainless OS and arch mappings in Anthropic headers [0.14ms]
(pass) Anthropic request fingerprint alignment > attaches cache_control only to the last emitted system block when cacheControl is set [0.23ms]
(pass) Anthropic request fingerprint alignment > places top-level automatic caching and an explicit breakpoint on the last ordered system prompt [4.51ms]
(pass) Anthropic request fingerprint alignment > reserves the final-turn cache slot for native Anthropic automatic caching [0.72ms]
(pass) Anthropic request fingerprint alignment > uses Bearer auth for non-Anthropic API bases with api-key credentials [0.03ms]
(pass) Anthropic request fingerprint alignment > forwards a custom User-Agent through the non-Anthropic proxy branch so WAFs see the configured client [0.02ms]
(pass) Anthropic request fingerprint alignment > forwards only prefix-matching Claude Code User-Agent values [0.03ms]
(pass) Anthropic request fingerprint alignment > skips Claude Code instruction injection for claude-3-5-haiku models [0.26ms]
(pass) Anthropic request fingerprint alignment > accepts uppercase hex in the user hash segment [0.02ms]
(pass) Anthropic request fingerprint alignment > generates cloaking-compatible user IDs
(pass) Anthropic request fingerprint alignment > injects generated metadata.user_id for OAuth requests when missing [0.19ms]
(pass) Anthropic request fingerprint alignment > does not inject metadata.user_id for non-OAuth requests without caller metadata [0.16ms]
(pass) Anthropic request fingerprint alignment > preserves valid caller metadata.user_id for OAuth requests [0.15ms]
(pass) Anthropic request fingerprint alignment > preserves real Claude Code JSON-format metadata.user_id for OAuth requests [0.15ms]
(pass) Anthropic request fingerprint alignment > preserves a minimal { session_id } JSON metadata.user_id for OAuth requests [0.13ms]
(pass) Anthropic request fingerprint alignment > replaces JSON metadata.user_id missing session_id for OAuth requests [0.16ms]
(pass) Anthropic request fingerprint alignment > replaces invalid caller metadata.user_id for OAuth requests [0.15ms]
(pass) Anthropic request fingerprint alignment > adds additionalProperties false to Anthropic tool object schemas [0.51ms]
(pass) Anthropic request fingerprint alignment > preserves explicit additionalProperties schemas and true for open record fields [0.51ms]
(pass) Anthropic request fingerprint alignment > removes Anthropic-unsupported array item count constraints [0.30ms]
(pass) Anthropic request fingerprint alignment > strips minItems from object-typed property schemas (Anthropic rejects them) [0.23ms]
(pass) Anthropic request fingerprint alignment > marks only the Anthropic strict allowlist strict [0.52ms]
(pass) Anthropic request fingerprint alignment > marks regular two-field Zod object tools strict [0.99ms]
(pass) Anthropic request fingerprint alignment > does not mark allowlisted Anthropic tools strict when schemas contain open object maps [0.30ms]
(pass) Anthropic request fingerprint alignment > honors strict=false and skips non-allowlisted Anthropic tools [0.22ms]
(pass) Anthropic request fingerprint alignment > adds legacy fine-grained tool-streaming beta only for tool requests on incompatible models [0.05ms]
(pass) Anthropic request fingerprint alignment > uses Cloudflare AI Gateway authorization without Anthropic credential headers [0.03ms]
(pass) Anthropic request fingerprint alignment > keeps Cloudflare gateway auth authoritative over caller-supplied auth headers [0.03ms]
(pass) Anthropic request fingerprint alignment > applies Claude Code TLS profile for direct Anthropic transport [0.03ms]
(pass) Anthropic request fingerprint alignment > uses Foundry base URL, Bearer auth, and custom headers when enabled [0.41ms]
(pass) Anthropic request fingerprint alignment > loads Foundry mTLS and CA material from file paths [0.95ms]
(pass) Anthropic request fingerprint alignment > throws when Foundry mTLS cert/key pair is incomplete [0.08ms]
(pass) Anthropic request fingerprint alignment > resolves Anthropic Foundry API key when Foundry mode is enabled [0.05ms]
(pass) Anthropic request fingerprint alignment > sends temperature for Anthropic requests without enabled thinking [0.33ms]
(pass) Anthropic request fingerprint alignment > omits thinking for reasoning models when thinking is explicitly disabled [0.16ms]
(pass) Anthropic request fingerprint alignment > drops temperature and sampling params for Opus 4.7 without enabled thinking [0.13ms]
(pass) Anthropic request fingerprint alignment > drops sampling params and requests summarized adaptive thinking for Opus 4.7 [0.19ms]
(pass) Anthropic request fingerprint alignment > maps Opus max reasoning to Anthropic adaptive max [0.12ms]
(pass) Anthropic request fingerprint alignment > treats tool prefix helpers as no-ops when prefix is empty [0.02ms]
(pass) Anthropic request fingerprint alignment > does not prefix built-in Anthropic tool names when prefix is configured [0.01ms]
(pass) Anthropic request fingerprint alignment > prefixes custom tool names when prefix is configured [0.01ms]

packages/ai/test/openai-bounded-rate-limits.test.ts:
(pass) isOpenAIUsageExhaustionResponse > flags an out-of-range Retry-After as exhaustion [0.03ms]
(pass) isOpenAIUsageExhaustionResponse > does not flag a short Retry-After without a body marker [0.03ms]
(pass) isOpenAIUsageExhaustionResponse > flags monthly usage-limit body copy
(pass) isOpenAIUsageExhaustionResponse > flags out_of_credits / insufficient_quota bodies
(pass) isOpenAIUsageExhaustionResponse > does not flag a plain transient 429 body
(pass) wrapOpenAIFetchForBoundedRateLimits > injects x-should-retry:false on a usage-exhaustion 429 [0.25ms]
(pass) wrapOpenAIFetchForBoundedRateLimits > leaves a transient 429 untouched so the SDK may still retry [0.04ms]
(pass) wrapOpenAIFetchForBoundedRateLimits > passes non-429 responses through unchanged [0.02ms]
(pass) wrapOpenAIFetchForBoundedRateLimits > is disabled when the retry-delay cap is 0 [0.02ms]

 69 pass
 0 fail
 209 expect() calls
Ran 69 tests across 3 files. [1390.00ms]
exit=0

## packages/ai type check
Command: (cd packages/ai && bun run check:types)
$ tsgo -p tsconfig.json --noEmit
exit=0

## packages/coding-agent type check
Command: (cd packages/coding-agent && bun run check:types)
$ tsgo -p tsconfig.json --noEmit
exit=0

## judgement
PASS: Patches 1 and 2 are landed. Patch 3 bounded OpenAI 429 is implemented, wired, and verified; NEEDS_HUMAN is not required.
