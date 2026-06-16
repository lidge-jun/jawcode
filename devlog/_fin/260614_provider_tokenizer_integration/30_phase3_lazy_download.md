# 30 — Phase 3: Lazy Download 인프라

> Phase 2 완료 후 진행. Claude V1 외의 토크나이저(gemma/llama3/deepseek/mistral/glm/cohere)를
> 첫 사용 시 다운로드하고 `~/.jwc/tokenizers/`에 캐시.

## 설계

### 다운로드 소스

두 가지 옵션:

**옵션 A: HuggingFace Hub 직접 다운로드**
```
https://huggingface.co/google/gemma-tokenizer/resolve/main/tokenizer.json
https://huggingface.co/meta-llama/Llama-3.2-1B/resolve/main/tokenizer.json
...
```
- 장점: 공식 소스, 항상 최신
- 단점: HF 인증 필요할 수 있음 (Llama), URL 안정성 보장 없음

**옵션 B: jwc 자체 CDN/GitHub Release 에셋 (추천)**
```
https://github.com/<org>/jawcode-tokenizers/releases/download/v1/gemma.json
```
- 장점: 인증 불필요, URL 안정, 버전 관리
- 단점: 별도 레포 관리

**옵션 C: npm 패키지**
```
@gajae-code/tokenizers-gemma
@gajae-code/tokenizers-llama3
```
- 장점: npm 인프라 활용, 버전 관리
- 단점: 패키지 관리 오버헤드

**추천: 옵션 B**. cli-rp의 파일을 jawcode-tokenizers 레포에 올리고 GitHub Release로 배포.

### 캐시 구조

```
~/.jwc/tokenizers/
├── manifest.json              # 다운로드된 토크나이저 목록 + 버전
├── claude.json                # (Phase 1에서 임베딩이므로 여기 없음)
├── gemma/tokenizer.json       # 17MB
├── llama3/tokenizer.json      # 8.7MB
├── deepseek/tokenizer.json    # 7.5MB
├── mistral/tokenizer.model    # 482KB
├── glm4/tokenizer.json        # 8.2MB
├── glm5/tokenizer.json        # 8.3MB
└── cohere/tokenizer.json      # 12MB
```

### manifest.json

```json
{
  "version": 1,
  "tokenizers": {
    "gemma": {
      "file": "gemma/tokenizer.json",
      "sha256": "abc123...",
      "size": 17825792,
      "downloadedAt": "2026-06-14T14:00:00Z",
      "source": "https://github.com/.../releases/download/v1/gemma.json"
    }
  }
}
```

### Rust 구현: 런타임 로딩

```rust
// crates/pi-natives/src/tokens.rs

use std::path::PathBuf;
use std::collections::HashMap;
use std::sync::Mutex;

static LAZY_TOKENIZERS: LazyLock<Mutex<HashMap<String, Tokenizer>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn resolve_tokenizer_path(family: &str) -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    let path = PathBuf::from(home)
        .join(".jwc")
        .join("tokenizers")
        .join(family)
        .join("tokenizer.json");
    path.exists().then_some(path)
}

fn get_lazy_tokenizer(family: &str) -> Option<&'static Tokenizer> {
    // 이미 로드됨?
    let guard = LAZY_TOKENIZERS.lock().ok()?;
    if guard.contains_key(family) {
        // 안전한 'static 참조를 위해 Box::leak 패턴 사용
        // (실제 구현에서는 DashMap + LazyLock 활용)
    }
    // 파일 존재 확인
    let path = resolve_tokenizer_path(family)?;
    let tokenizer = Tokenizer::from_file(&path).ok()?;
    // 캐시에 저장
    drop(guard);
    // ...
    None // fallback to o200k
}
```

**참고**: Rust에서 런타임 파일 로드 + 캐싱은 `DashMap` (이미 workspace dependency에 있음)으로
구현. `once_cell` 대신 `std::sync::LazyLock` (이미 사용 중)을 활용하여 새 의존성 추가 불필요.
`include_bytes!`와 달리 파일이 없으면 graceful fallback → o200k_base.

### JavaScript 구현: 다운로드 트리거

```typescript
// packages/coding-agent/src/utils/tokenizer-download.ts

import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { getAgentDir } from "@gajae-code/utils";

const TOKENIZER_CDN = "https://github.com/<org>/jawcode-tokenizers/releases/download/v1";

const TOKENIZER_MANIFEST: Record<string, { url: string; sha256: string; size: number }> = {
  gemma:    { url: `${TOKENIZER_CDN}/gemma.json`,    sha256: "...", size: 17825792 },
  llama3:   { url: `${TOKENIZER_CDN}/llama3.json`,   sha256: "...", size: 8700000 },
  deepseek: { url: `${TOKENIZER_CDN}/deepseek.json`, sha256: "...", size: 7500000 },
  mistral:  { url: `${TOKENIZER_CDN}/mistral.model`, sha256: "...", size: 482000 },
  glm4:     { url: `${TOKENIZER_CDN}/glm4.json`,     sha256: "...", size: 8200000 },
  glm5:     { url: `${TOKENIZER_CDN}/glm5.json`,     sha256: "...", size: 8300000 },
  cohere:   { url: `${TOKENIZER_CDN}/cohere.json`,   sha256: "...", size: 12000000 },
};

export async function ensureTokenizer(family: string): Promise<boolean> {
  const dir = join(getAgentDir(), "tokenizers", family);
  const target = join(dir, "tokenizer.json");

  if (await Bun.file(target).exists()) return true;

  const entry = TOKENIZER_MANIFEST[family];
  if (!entry) return false;

  await mkdir(dir, { recursive: true });
  const response = await fetch(entry.url);
  if (!response.ok) return false;

  await Bun.write(target, response);
  return true;
}
```

**다운로드 타이밍**: 세션 시작 시 `resolveTokenizerFamily(model)` 결과가 lazy 대상이면
백그라운드에서 다운로드. 다운로드 전에는 o200k fallback.

### Phase 2 연동

`tokenizerFamilyToEncoding()`에서 lazy 토크나이저가 캐시에 있으면 실제 Encoding 반환,
없으면 o200k fallback + 백그라운드 다운로드 트리거.

```typescript
export function tokenizerFamilyToEncoding(family: TokenizerFamily): Encoding {
  if (EMBEDDED_FAMILIES.has(family)) return FAMILY_TO_NATIVE[family];
  // Lazy: 캐시에 있으면 실제 encoding, 없으면 fallback
  if (isTokenizerCached(family)) return FAMILY_TO_NATIVE[family];
  triggerBackgroundDownload(family);
  return Encoding.O200kBase; // fallback
}
```

## 변경 파일

| 파일 | 작업 |
|---|---|
| `crates/pi-natives/src/tokens.rs` | MODIFY — lazy file load + 6 enum 추가 |
| `packages/coding-agent/src/utils/tokenizer-download.ts` | NEW — 다운로드 로직 |
| `packages/coding-agent/src/utils/tokenizer-encoding.ts` | MODIFY — cache 체크 |
| `packages/ai/src/utils/tokenizer-routing.ts` | MODIFY — family enum 추가 |
| GitHub: `jawcode-tokenizers` 레포 | NEW — 토크나이저 파일 호스팅 |
