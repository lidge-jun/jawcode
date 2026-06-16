# 01 — AS-IS: 현재 토크나이저 아키텍처

## Rust 구현

```path
crates/pi-natives/src/tokens.rs
```

```rust
// Token counting via tiktoken-rs.
// o200k_base is the default. Anthropic doesn't publish their tokenizer, so
// o200k_base is closer to current frontier models' English/code text.

use tiktoken_rs::{CoreBPE, cl100k_base, o200k_base};

static O200K: LazyLock<CoreBPE> = LazyLock::new(|| o200k_base().expect("..."));
static CL100K: LazyLock<CoreBPE> = LazyLock::new(|| cl100k_base().expect("..."));

#[napi(string_enum)]
pub enum Encoding {
    O200kBase,    // GPT-4o/o1/GPT-5 (default)
    Cl100kBase,   // GPT-3.5/GPT-4/older
}

fn encoder(encoding: Option<Encoding>) -> &'static CoreBPE {
    match encoding.unwrap_or(Encoding::O200kBase) {
        Encoding::O200kBase => &O200K,
        Encoding::Cl100kBase => &CL100K,
    }
}

#[napi]
pub fn count_tokens(input: Either<String, Vec<String>>, encoding: Option<Encoding>) -> u32 {
    let bpe = encoder(encoding);
    // ... encode_ordinary() + rayon parallelization
}
```

**의존성**: `tiktoken-rs = "0.11"` (Cargo.toml:292)

## JavaScript 바인딩

```path
packages/natives/native/index.js:32
```

```javascript
export const countTokens = nativeBindings.countTokens;
export const Encoding = { O200kBase: "O200kBase", Cl100kBase: "Cl100kBase" };
```

## TypeScript 선언

```path
packages/natives/native/index.d.ts:375-427
```

```typescript
export declare function countTokens(
  input: string | Array<string>,
  encoding?: Encoding | undefined | null
): number

export declare enum Encoding {
  O200kBase = 'O200kBase',
  Cl100kBase = 'Cl100kBase'
}
```

## 호출처

### 1. StatusLine (context-usage.ts)

```path
packages/coding-agent/src/modes/utils/context-usage.ts
```

```typescript
import { countTokens } from "@gajae-code/natives";           // :6
// ...
return countTokens(fragments);                                // :50 (skills)
return countTokens(fragments);                                // :63 (tools — toolWireSchema 적용)
const systemContextTokens = countTokens(systemPromptParts.slice(1)); // :102
const systemPromptTokens = Math.max(0, countTokens(...));     // :103
return fragments.length === 0 ? 0 : countTokens(fragments);  // :114 (rules)
```

**model 접근 경로**: `session.model` (line 150) → `model.provider` 사용 가능.

### 2. Compaction (compaction.ts)

```path
packages/agent/src/compaction/compaction.ts
```

```typescript
import { countTokens } from "@gajae-code/natives";           // :16
// ...
export function countMessageTokensNativeO200k(message: AgentMessage): number {
    return countCollectedMessageFragments(collectMessageFragments(message));
}
export const estimateTokens = countMessageTokensNativeO200k;  // :287
```

**문제**: `estimateTokens`가 함수명에 `NativeO200k`을 명시하고 있어, 이 함수를 provider-aware로 바꾸면
기존 호출처(branch-summarization.ts, pruning.ts)도 연쇄 변경 필요.

**model 접근 경로**: `generateSummary(currentMessages, model, ...)` (line 615) — model 파라미터를
통해 provider 접근 가능. 하지만 `estimateTokens`는 model 파라미터 없이 호출됨.

## 네이티브 바이너리 빌드/배포

### 빌드

```path
packages/natives/scripts/build-native.ts
```

- `napi build --manifest-path crates/pi-natives/Cargo.toml`
- AVX2 지원 여부에 따라 baseline/modern 두 variant 빌드
- 출력: `pi_natives.{platform}-{arch}[-{variant}].node`

### CI

```path
scripts/ci-build-native.ts
```

- `TARGET_VARIANTS="baseline modern"` 환경변수로 multi-variant 빌드
- `.github/workflows/ci.yml`: TypeScript 체크 + smoke test (네이티브 빌드는 별도)
- `.github/workflows/release.yml`: 릴리즈 시 pre-built 바이너리 가정

### 배포

```path
packages/natives/package.json
```

```json
{
  "napi": { "binaryName": "pi_natives", "triples": {} },
  "files": ["src", "native", "README.md"]
}
```

- 바이너리 크기: ~110MB (darwin-arm64 기준)
- 로더: `loader-state.js` — platform/arch/variant 자동 감지, `~/.jwc/natives/` fallback
- 지원 플랫폼: linux-x64, linux-arm64, darwin-x64, darwin-arm64, win32-x64
- 버전 sentinel: `__piNativesV0_4_4` — 바이너리-패키지 버전 불일치 방지

## 핵심 제약

1. **Encoding enum이 Rust N-API에 노출** → enum 추가 시 바이너리 재빌드 필요
2. **tiktoken-rs는 OpenAI 토크나이저만 지원** → HuggingFace tokenizers 추가 필요
3. **estimateTokens가 model 파라미터 없음** → provider 라우팅 시 호출 체인 변경
4. **바이너리 110MB** → Claude V1(1.7M) 임베딩은 크기 영향 미미
5. **CI가 네이티브 빌드를 별도 관리** → Cargo 의존성 추가 시 CI 통과 확인 필요
