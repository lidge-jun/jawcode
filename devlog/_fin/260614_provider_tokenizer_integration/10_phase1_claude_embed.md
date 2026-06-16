# 10 — Phase 1: Claude V1 토크나이저 임베딩

> 가장 높은 ROI. Anthropic 사용자가 jwc의 primary audience이므로 정확도 개선 효과가 가장 큼.
> 바이너리 크기 증가 ~1.7MB (110MB 대비 1.5%).

## 변경 파일

### NEW `crates/pi-natives/data/claude.json`

- 소스: `cli-rp/app/public/token/claude/claude.json` (1.7MB)
- 라이센스: MIT, Copyright 2022 Anthropic, PBC
- 포맷: HuggingFace `tokenizers` JSON
- Vocab 크기: 65K + 5 special tokens

### MODIFY `Cargo.toml` (workspace root)

```diff
 [workspace.dependencies]
+tokenizers = { version = "0.21", default-features = false, features = ["onig"] }
 tiktoken-rs = "0.11"
```

`tokenizers` crate (HuggingFace): HF JSON 포맷 토크나이저 로드.
`default-features = false`로 불필요한 Python 바인딩/HTTP 의존성 제거.

### MODIFY `crates/pi-natives/Cargo.toml`

```diff
 [dependencies]
+tokenizers = { workspace = true }
 tiktoken-rs = { workspace = true }
```

### MODIFY `crates/pi-natives/src/tokens.rs`

```diff
+use tokenizers::Tokenizer;
+use std::sync::LazyLock;
+
+static CLAUDE_V1: LazyLock<Tokenizer> = LazyLock::new(|| {
+    let bytes = include_bytes!("../data/claude.json");
+    Tokenizer::from_bytes(bytes).expect("failed to load Claude V1 tokenizer")
+});
+
 #[napi(string_enum)]
 pub enum Encoding {
     O200kBase,
     Cl100kBase,
+    /// Claude ≤4.6 (Sonnet/Haiku 4.5, Opus 4.6). HuggingFace tokenizers JSON.
+    Claude,
+    /// Claude ≥4.7 (Opus 4.7/4.8, Fable 5). V1 × 1.3 보정.
+    ClaudeV2,
 }

 fn count_with_encoding(text: &str, encoding: &Encoding) -> u32 {
     match encoding {
         Encoding::O200kBase => O200K.encode_ordinary(text).len() as u32,
         Encoding::Cl100kBase => CL100K.encode_ordinary(text).len() as u32,
+        Encoding::Claude => {
+            let enc = CLAUDE_V1.encode(text, false).expect("claude encode failed");
+            enc.len() as u32
+        }
+        Encoding::ClaudeV2 => {
+            let enc = CLAUDE_V1.encode(text, false).expect("claude encode failed");
+            // V2 토크나이저 미공개. V1 결과에 1.3x 보정 (실측 근거: 1.0-1.35x 범위).
+            ((enc.len() as f64) * 1.3).ceil() as u32
+        }
     }
 }
```

### MODIFY `packages/natives/native/index.d.ts` (자동 생성)

napi-rs가 자동으로 Encoding enum에 `Claude`, `ClaudeV2` 추가.

### 검증

```bash
# Rust 빌드
cargo build -p pi-natives

# 바이너리 크기 비교
ls -lh packages/natives/native/pi_natives.*.node

# 토큰 카운트 검증
bun --eval '
import { countTokens, Encoding } from "@gajae-code/natives";
const text = "Hello, how are you doing today?";
console.log("o200k:", countTokens(text, Encoding.O200kBase));
console.log("claude:", countTokens(text, Encoding.Claude));
console.log("claudeV2:", countTokens(text, Encoding.ClaudeV2));
'
```

## 위험

| 위험 | 확률 | 영향 | 완화 |
|---|---|---|---|
| `tokenizers` crate 빌드 시간 증가 | 중 | CI 시간 | `default-features = false`로 최소화 |
| `include_bytes!` 1.7MB가 바이너리 블로트 | 낮 | 배포 | 110MB 대비 1.5% — 무시 가능 |
| HF tokenizer와 실제 Claude 토크나이저 차이 | 낮 | 정확도 | Anthropic 공식 MIT 라이센스 파일. V1은 정확 |
| ClaudeV2 1.3x 보정 부정확 | 중 | 정확도 | 실측 1.0-1.35x 범위. API countTokens로 calibration 가능 |
