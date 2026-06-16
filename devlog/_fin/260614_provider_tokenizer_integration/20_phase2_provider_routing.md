# 20 — Phase 2: Provider→Tokenizer 라우팅

> Phase 1(Claude 임베딩)이 완료된 후 진행. `model.provider`를 기반으로 올바른 Encoding을
> 자동 선택하는 라우팅 레이어를 추가한다.

## 설계: resolveTokenizerEncoding()

### NEW `packages/ai/src/utils/tokenizer-routing.ts`

```typescript
import type { Model } from "../types";

/** Known tokenizer encoding families. Must match pi-natives Encoding enum. */
export type TokenizerFamily =
  | "o200k_base"     // OpenAI GPT-4o/o1/GPT-5, xAI Grok, Qwen (fallback)
  | "cl100k_base"    // OpenAI GPT-3.5/GPT-4 older
  | "claude"         // Anthropic Claude ≤4.6
  | "claude_v2"      // Anthropic Claude ≥4.7 (V1 × 1.3 보정)
  | "gemma"          // Google Gemini
  | "llama3"         // Meta Llama 3/3.1/4
  | "deepseek"       // DeepSeek V3/R1
  | "mistral"        // Mistral/Mixtral
  | "glm"            // GLM-4/5 (Zhipu)
  | "cohere";        // Cohere Command R

/** Claude V2 토크나이저 경계: 이 model ID prefix 이후는 V2. */
const CLAUDE_V2_PREFIXES = [
  "claude-opus-4-7", "claude-opus-4-8",
  "claude-fable", "claude-mythos",
  // Bedrock variants
  "anthropic.claude-opus-4-7", "anthropic.claude-opus-4-8",
  "anthropic.claude-fable", "anthropic.claude-mythos",
];

function isClaudeV2(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return CLAUDE_V2_PREFIXES.some(prefix => lower.includes(prefix));
}

const PROVIDER_TO_FAMILY: Record<string, TokenizerFamily> = {
  // Anthropic (단일 provider — Bedrock/Vertex는 multi-model이라 여기서 제외)
  anthropic: "claude",          // isClaudeV2 분기 적용

  // OpenAI 계열
  openai: "o200k_base",
  "openai-codex": "o200k_base",
  "azure-openai": "o200k_base",
  xai: "o200k_base",            // Grok은 OpenAI-compat
  cursor: "o200k_base",

  // Google (단일 provider)
  google: "gemma",
  "google-gemini-cli": "gemma",
  "google-antigravity": "gemma",

  // Meta/Llama
  groq: "llama3",
  fireworks: "llama3",
  together: "llama3",
  cerebras: "llama3",

  // 기타
  deepseek: "deepseek",
  mistral: "mistral",
  minimax: "glm",              // MiniMax는 GLM 계열
  "minimax-code": "glm",       // 실제 KnownProvider
  "minimax-code-cn": "glm",    // 실제 KnownProvider
  cohere: "cohere",

  // Qwen (tiktoken 호환)
  "qwen-portal": "o200k_base",
  "alibaba-coding-plan": "o200k_base",
};

/**
 * Resolve the tokenizer family for a given model.
 * Falls back to o200k_base for unknown providers.
 *
 * Bedrock/Vertex는 multi-model provider라 PROVIDER_TO_FAMILY에 넣지 않고
 * model.id 기반 분기로 처리 (단순 매핑하면 non-Claude 모델이 도달 불가능).
 */
export function resolveTokenizerFamily(model: { provider: string; id: string }): TokenizerFamily {
  // Multi-model provider: model.id 기반 분기 (PROVIDER_TO_FAMILY보다 먼저)
  if (model.provider === "amazon-bedrock") {
    if (model.id.startsWith("cohere.")) return "cohere";
    if (model.id.startsWith("deepseek.")) return "deepseek";
    if (model.id.startsWith("meta.") || model.id.includes("llama")) return "llama3";
    if (model.id.startsWith("mistral.")) return "mistral";
    if (model.id.startsWith("anthropic.") || model.id.includes("claude")) {
      return isClaudeV2(model.id) ? "claude_v2" : "claude";
    }
    return "o200k_base"; // 알 수 없는 Bedrock 모델
  }

  if (model.provider === "google-vertex") {
    if (model.id.includes("gemini") || model.id.includes("gemma")) return "gemma";
    if (model.id.includes("claude")) {
      return isClaudeV2(model.id) ? "claude_v2" : "claude";
    }
    return "gemma"; // Vertex 기본 = Gemma
  }

  // 단일-model provider: lookup table
  const base = PROVIDER_TO_FAMILY[model.provider];

  // Anthropic: V1/V2 분기
  if (base === "claude") {
    return isClaudeV2(model.id) ? "claude_v2" : "claude";
  }

  return base ?? "o200k_base";
}
```

### MODIFY `packages/coding-agent/src/modes/utils/context-usage.ts`

```diff
 import { countTokens, Encoding } from "@gajae-code/natives";
+import { resolveTokenizerFamily } from "@gajae-code/ai/utils/tokenizer-routing";
+import { tokenizerFamilyToEncoding } from "../../utils/tokenizer-encoding";

-export function estimateSkillsTokens(skills: ...): number {
-    return countTokens(fragments);
+export function estimateSkillsTokens(skills: ..., encoding?: Encoding): number {
+    return countTokens(fragments, encoding);

-export function estimateToolSchemaTokens(tools: ...): number {
-    return countTokens(fragments);
+export function estimateToolSchemaTokens(tools: ..., encoding?: Encoding): number {
+    return countTokens(fragments, encoding);

-export function estimateRulesTokens(rules: ...): number {
-    return countTokens(fragments);
+export function estimateRulesTokens(rules: ..., encoding?: Encoding): number {
+    return countTokens(fragments, encoding);

-function computeNonMessageBreakdown(...) {
+function computeNonMessageBreakdown(..., encoding?: Encoding) {
+    // session.model 기반 encoding resolve → 모든 helper에 전달

-function splitLastUserTurn(...) {
+function splitLastUserTurn(..., encoding?: Encoding) {
```

**핵심 변경**: `computeContextBreakdown()`에서 `session.model`을 읽어 encoding을
resolve하고, 모든 6개 helper 함수에 encoding 파라미터 전달.
`countTokens()` 직접 호출 6곳 모두 encoding 인자 추가.

### MODIFY `packages/agent/src/compaction/compaction.ts`

```diff
+export function countCollectedMessageFragments(
+    fragments: string[], encoding?: Encoding
+): number {
+    return fragments.length === 0 ? 0 : countTokens(fragments, encoding);
+}

-export const estimateTokens = countMessageTokensNativeO200k;
+export function createEstimateTokens(encoding?: Encoding) {
+    return (message: AgentMessage) => {
+        const fragments = collectMessageFragments(message);
+        return countCollectedMessageFragments(fragments, encoding);
+    };
+}
+export const estimateTokens = createEstimateTokens(); // 기본 o200k (back-compat)

-export function estimateEntriesTokens(...) {
+export function estimateEntriesTokens(..., encoding?: Encoding) {
+    // encoding을 내부 estimateTokens 호출에 전달

-export function prepareCompaction(...) {
+export function prepareCompaction(..., encoding?: Encoding) {
+    // encoding을 estimateEntriesTokens에 전달
```

**back-compat**: 기존 `estimateTokens` export는 기본값(o200k) 유지. 새 호출처만 encoding 주입.

### MODIFY `packages/agent/src/compaction/pruning.ts`

```diff
-export function pruneToolOutputs(...) {
+export function pruneToolOutputs(..., encoding?: Encoding) {
+    // encoding을 내부 estimateTokens 호출에 전달
```

### MODIFY `packages/agent/src/compaction/branch-summarization.ts`

```diff
-// estimateTokens 호출부
+// encoding 파라미터 추가하여 provider-aware 추정
```

### MODIFY `packages/coding-agent/src/session/agent-session.ts`

```diff
 // 4곳의 estimateTokens / prepareCompaction / pruneToolOutputs 호출부에 encoding 전달
 // model은 this.model (AgentSession 인스턴스에서 접근 가능)
+const encoding = tokenizerFamilyToEncoding(resolveTokenizerFamily(this.model));
 // L1457: estimateTokens → createEstimateTokens(encoding)
 // L6265: pruneToolOutputs(..., encoding)
 // L6300, L7637: prepareCompaction(..., encoding)
 // L9852, L9863: estimateTokens → encoding-aware
```

### MODIFY `packages/coding-agent/src/modes/components/status-line.ts`

```diff
 // L140, L619: estimateTokens 호출에 encoding 전달
+const encoding = tokenizerFamilyToEncoding(resolveTokenizerFamily(model));

 // Token cache invalidation: encoding을 cache fingerprint에 포함
 // per-message cache (L62-74): tokensForMessage() record에 encoding/family 키 추가
 // non-message cache (L602-637): #computeNonMessageInputsKey()에 tokenizer family 포함
+// model 전환 시 stale cached token 방지
```

### MODIFY `packages/coding-agent/src/commit/map-reduce/index.ts`

```diff
 // L44: estimateTokens 호출에 encoding 전달 (model 접근 가능한 경우)
 // map-reduce는 model 컨텍스트가 없으면 기본 o200k 유지
```

### TokenizerFamily → Encoding 매핑

```typescript
// packages/coding-agent/src/utils/tokenizer-encoding.ts
import { Encoding } from "@gajae-code/natives";
import type { TokenizerFamily } from "@gajae-code/ai/utils/tokenizer-routing";

const FAMILY_TO_NATIVE: Record<TokenizerFamily, Encoding> = {
  o200k_base: Encoding.O200kBase,
  cl100k_base: Encoding.Cl100kBase,
  claude: Encoding.Claude,
  claude_v2: Encoding.ClaudeV2,
  // Phase 3 이후 추가:
  gemma: Encoding.O200kBase,      // fallback until lazy download
  llama3: Encoding.O200kBase,     // fallback until lazy download
  deepseek: Encoding.O200kBase,   // fallback until lazy download
  mistral: Encoding.O200kBase,    // fallback until lazy download
  glm: Encoding.O200kBase,        // fallback until lazy download
  cohere: Encoding.O200kBase,     // fallback until lazy download
};

export function tokenizerFamilyToEncoding(family: TokenizerFamily): Encoding {
  return FAMILY_TO_NATIVE[family];
}
```

Phase 3에서 lazy download가 완료되면 fallback을 실제 encoding으로 교체.

## 호출 체인

```
session.model.provider + session.model.id
  → resolveTokenizerFamily(model) → "claude" | "claude_v2" | "o200k_base" | ...
  → tokenizerFamilyToEncoding(family) → Encoding.Claude | Encoding.O200kBase | ...
  → countTokens(fragments, encoding) → 정확한 토큰 수
```

## import path 결정

`tokenizer-routing.ts`는 **subpath import** 사용:
```typescript
import { resolveTokenizerFamily } from "@gajae-code/ai/utils/tokenizer-routing";
```
`packages/ai/package.json`의 `"./utils/*"` wildcard export가 이미 설정되어 있으므로
root `src/index.ts` 수정 불필요.

## 변경 범위 (전체)

| 파일 | 작업 | 영향도 |
|---|---|---|
| `packages/ai/src/utils/tokenizer-routing.ts` | NEW | provider→family 매핑 |
| `packages/coding-agent/src/utils/tokenizer-encoding.ts` | NEW | family→Encoding 매핑 |
| `packages/coding-agent/src/modes/utils/context-usage.ts` | MODIFY | 6개 helper에 encoding 주입 |
| `packages/agent/src/compaction/compaction.ts` | MODIFY | createEstimateTokens, estimateEntriesTokens, prepareCompaction에 encoding 추가 |
| `packages/agent/src/compaction/branch-summarization.ts` | MODIFY | encoding 전달 |
| `packages/agent/src/compaction/pruning.ts` | MODIFY | pruneToolOutputs에 encoding 추가 |
| `packages/coding-agent/src/session/agent-session.ts` | MODIFY | 6곳 호출부에 encoding 전달 (L1457, L6265, L6300, L7637, L9852, L9863) |
| `packages/coding-agent/src/modes/components/status-line.ts` | MODIFY | L140, L619 encoding 전달 |
| `packages/coding-agent/src/commit/map-reduce/index.ts` | MODIFY | L44 encoding 전달 (model 없으면 기본값) |
| 테스트 파일 | NEW/MODIFY | 새 encoding 테스트 |
