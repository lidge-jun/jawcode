# 00 — MOC: Provider별 토크나이저 통합

> 상태: 🟡 계획 수립 완료 / 구현 대기 (260614)
> 입력: jwc는 PI(Provider-Independent) 코딩 에이전트. 현재 모든 모델에 대해
> `o200k_base` (OpenAI tiktoken) 하나로 토큰을 추정함. Anthropic/Google/Meta/DeepSeek 등
> 각 provider의 토크나이저가 다르므로 StatusLine 표시, compaction 트리거, context window 계산이
> 부정확함.

## 한 줄 결론

`model.provider` 기반 토크나이저 라우팅을 도입한다. Claude V1(1.7MB)은 바이너리에 임베딩하고,
나머지(gemma/llama3/deepseek/mistral/glm 등 ~60MB)는 첫 사용 시 `~/.jwc/tokenizers/`에
lazy download + 캐시한다. Claude V2(≥4.7)는 미공개이므로 V1 × 1.3 보정 계수를 적용한다.

## 현재 구조 (AS-IS)

```
countTokens(input, encoding?)
  └── tiktoken-rs o200k_base (default)
      └── 모든 provider에 동일 적용
          ├── Anthropic → o200k (부정확)
          ├── Google    → o200k (부정확)
          ├── Meta      → o200k (부정확)
          └── OpenAI    → o200k (정확)
```

- Rust crate: `crates/pi-natives/src/tokens.rs` — `tiktoken-rs 0.11`, `Encoding` enum 2개
- JS binding: `packages/natives/native/index.js` — `countTokens` export
- 호출처: `context-usage.ts` (StatusLine), `compaction.ts` (compact 트리거)
- **모든 호출이 encoding 파라미터를 생략** → 항상 o200k_base

## 목표 구조 (TO-BE)

```
countTokens(input, encoding?)
  ├── Encoding::O200kBase    → tiktoken-rs (OpenAI/GPT/Grok/Qwen) [기존]
  ├── Encoding::Cl100kBase   → tiktoken-rs (GPT-3.5/GPT-4 구형)  [기존]
  ├── Encoding::Claude       → HF tokenizers (Claude ≤4.6)       [NEW, 임베딩]
  ├── Encoding::ClaudeV2     → Claude × 1.3 보정 (≥4.7)          [NEW, 보정]
  ├── Encoding::Gemma        → HF tokenizers (Gemini)             [NEW, lazy]
  ├── Encoding::Llama3       → HF tokenizers (Meta Llama)         [NEW, lazy]
  ├── Encoding::DeepSeek     → HF tokenizers (DeepSeek)           [NEW, lazy]
  ├── Encoding::Mistral      → SentencePiece (Mistral)            [NEW, lazy]
  └── Encoding::Glm          → HF tokenizers (GLM-4/5)            [NEW, lazy]

resolveTokenizerEncoding(model: Model) → Encoding
  ├── provider === "anthropic" → model.id ≥ 4.7 ? ClaudeV2 : Claude
  ├── provider === "google*"   → Gemma
  ├── provider === "openai*"   → O200kBase / Cl100kBase
  ├── provider === "xai"       → O200kBase (Grok은 OpenAI-compat)
  ├── provider === "deepseek"  → DeepSeek
  ├── provider === "mistral"   → Mistral
  └── default                  → O200kBase (fallback)
```

## 토크나이저 소스 (cli-rp에서 확보)

| 토크나이저 | 소스 파일 | 크기 | 포맷 | 라이센스 | 배포 전략 |
|---|---|---:|---|---|---|
| Claude V1 | `cli-rp/app/public/token/claude/claude.json` | 1.7M | HF JSON | MIT (Anthropic) | **임베딩** |
| Gemma | `cli-rp/app/public/token/gemma/tokenizer.json` | 17M | HF JSON | Apache 2.0 | lazy download |
| Llama3 | `cli-rp/app/public/token/llama/llama3.json` | 8.7M | HF JSON | Meta License | lazy download |
| DeepSeek | `cli-rp/app/public/token/deepseek/tokenizer.json` | 7.5M | HF JSON | MIT | lazy download |
| Mistral | `cli-rp/app/public/token/mistral/tokenizer.model` | 482K | SentencePiece | Apache 2.0 | lazy download |
| Cohere | `cli-rp/app/public/token/cohere/tokenizer.json` | 12M | HF JSON | - | lazy download |
| GLM-4 | `cli-rp/app/public/token/glm4/tokenizer.json` | 8.2M | HF JSON | - | lazy download |
| GLM-5 | `cli-rp/app/public/token/glm5/tokenizer.json` | 8.3M | HF JSON | - | lazy download |

**총 lazy download 크기: ~57MB** (개별 다운로드, 사용하는 provider만)

## 문서

| # | 문서 | 내용 |
|---|---|---|
| 00 | 본 MOC | 결론·구조·소스 |
| [01](./01_current_architecture.md) | AS-IS 아키텍처 상세 |
| [10](./10_phase1_claude_embed.md) | Phase 1: Claude V1 임베딩 |
| [20](./20_phase2_provider_routing.md) | Phase 2: Provider 라우팅 |
| [30](./30_phase3_lazy_download.md) | Phase 3: Lazy download 인프라 |
| [40](./40_phase4_ci_integration.md) | Phase 4: CI 파이프라인 통합 |
