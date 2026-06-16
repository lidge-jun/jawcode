# 40 — Phase 4: CI 파이프라인 통합

> Phase 1-3의 Rust/JS 변경이 CI에서 문제없이 빌드·테스트되도록 파이프라인 보강.

## 영향 분석

### Phase 1 (Claude 임베딩) CI 영향

| 항목 | 영향 | 조치 |
|---|---|---|
| Cargo 빌드 시간 | `tokenizers` crate 추가 → 첫 빌드 +2-5분 (이후 캐시) | `default-features = false`로 최소화 |
| 바이너리 크기 | +1.7MB (include_bytes) | 허용 범위. npm tarball 15MB 제한에는 영향 없음 (native binary는 별도) |
| CI workflow | 현재 `ci.yml`은 `ci:check:full` (tsc)만 실행. native build는 별도 release workflow | CI에 native build smoke test 추가 필요 |
| 테스트 | 새 Encoding variant 테스트 추가 | `test/tokenizer-encoding.test.ts` |
| Release | napi build → 자동 포함 | 변경 불필요 |

### Phase 2 (Provider 라우팅) CI 영향

| 항목 | 영향 | 조치 |
|---|---|---|
| TypeScript | 새 파일 2개 (tokenizer-routing.ts, tokenizer-encoding.ts) | `bun check` 통과 필요 |
| 테스트 | provider→family 매핑 테스트, 모든 bundled model에 대해 | `test/tokenizer-routing.test.ts` |
| back-compat | `estimateTokens` 기존 export 유지 | 기존 테스트 통과 확인 |

### Phase 3 (Lazy Download) CI 영향

| 항목 | 영향 | 조치 |
|---|---|---|
| Rust Encoding enum | 6개 추가 → napi 재생성 | CI에서 `napi build` 통과 |
| 네트워크 의존성 | CI에서 토크나이저 다운로드 불필요 (fallback 사용) | 다운로드 없이 테스트 가능하게 설계 |
| 테스트 | lazy download mock 테스트 | `test/tokenizer-download.test.ts` |
| `jawcode-tokenizers` 레포 | Release 자동화 | GitHub Actions workflow |

## CI 변경 상세

### MODIFY `.github/workflows/ci.yml`

```diff
 jobs:
   check:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
       - uses: oven-sh/setup-bun@v2
+      - name: Cache Cargo registry
+        uses: actions/cache@v4
+        with:
+          path: |
+            ~/.cargo/registry
+            ~/.cargo/git
+            target
+          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
       - run: bun install --frozen-lockfile
       - run: bun run ci:check:full
       - run: bun run ci:test:smoke
```

Cargo 캐시 추가로 `tokenizers` crate 반복 빌드 방지.

### NEW `test/tokenizer-routing.test.ts`

```typescript
import { describe, expect, it } from "bun:test";
import { resolveTokenizerFamily } from "@gajae-code/ai/utils/tokenizer-routing";

describe("resolveTokenizerFamily", () => {
  it("routes Anthropic Claude 4.6 to claude", () => {
    expect(resolveTokenizerFamily({
      provider: "anthropic", id: "claude-opus-4-6"
    })).toBe("claude");
  });

  it("routes Anthropic Claude 4.7+ to claude_v2", () => {
    expect(resolveTokenizerFamily({
      provider: "anthropic", id: "claude-opus-4-7"
    })).toBe("claude_v2");
  });

  it("routes Fable 5 to claude_v2", () => {
    expect(resolveTokenizerFamily({
      provider: "anthropic", id: "claude-fable-5"
    })).toBe("claude_v2");
  });

  it("routes OpenAI to o200k_base", () => {
    expect(resolveTokenizerFamily({
      provider: "openai", id: "gpt-4o"
    })).toBe("o200k_base");
  });

  it("routes xAI Grok to o200k_base", () => {
    expect(resolveTokenizerFamily({
      provider: "xai", id: "grok-composer-2.5-fast"
    })).toBe("o200k_base");
  });

  it("routes Google to gemma", () => {
    expect(resolveTokenizerFamily({
      provider: "google", id: "gemini-2.5-pro"
    })).toBe("gemma");
  });

  it("routes Bedrock Claude to claude", () => {
    expect(resolveTokenizerFamily({
      provider: "amazon-bedrock", id: "anthropic.claude-opus-4-6-v1"
    })).toBe("claude");
  });

  it("routes Bedrock DeepSeek to deepseek", () => {
    expect(resolveTokenizerFamily({
      provider: "amazon-bedrock", id: "deepseek.v3-v1:0"
    })).toBe("deepseek");
  });

  it("falls back to o200k_base for unknown provider", () => {
    expect(resolveTokenizerFamily({
      provider: "unknown-provider", id: "some-model"
    })).toBe("o200k_base");
  });
});
```

### ~~G002 Gate 업데이트~~ (삭제)

> **Audit 수정**: `scripts/verify-g002-gates.ts`에는 바이너리 크기 gate가 없음.
> 실제 size guard는 ci.yml 내 npm tarball 15MB 제한이며, native binary와는 무관.
> 이 항목은 삭제함.

### MODIFY `.github/workflows/ci.yml` — Native build smoke test 추가

```diff
 jobs:
   check:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
       - uses: oven-sh/setup-bun@v2
+      - name: Cache Cargo registry
+        uses: actions/cache@v4
+        with:
+          path: |
+            ~/.cargo/registry
+            ~/.cargo/git
+            target
+          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
       - run: bun install --frozen-lockfile
       - run: bun run ci:check:full
+      - run: bun run ci:build:native  # Encoding enum 변경 검증
       - run: bun run ci:test:smoke
```

> `ci:build:native` 추가로 Rust Encoding enum 변경이 CI에서 빌드 검증됨.
> 현재 CI는 TypeScript check만 실행하므로, native build 없이는 enum 추가가 검출 안 됨.

## 실행 순서

```
Phase 1 (Claude 임베딩)
  ├── Rust: Cargo.toml + tokens.rs + data/claude.json
  ├── Build: cargo build → napi build → 바이너리 확인
  ├── Test: countTokens(text, Encoding.Claude) 동작 확인
  └── CI: Cargo 캐시 + ci:build:native 추가

Phase 2 (Provider 라우팅)
  ├── TS: tokenizer-routing.ts + tokenizer-encoding.ts
  ├── Modify: context-usage.ts + compaction.ts + agent-session.ts + status-line.ts
  ├── Test: provider 매핑 테스트 + 기존 테스트 regression 없음
  └── CI: bun check + bun test 통과

Phase 3 (Lazy Download)
  ├── Rust: 6 enum 추가 + 런타임 파일 로드 (DashMap + LazyLock, 신규 의존성 없음)
  ├── TS: tokenizer-download.ts
  ├── Infra: jawcode-tokenizers 레포 + Release
  ├── Test: mock download + fallback 테스트
  └── CI: 네트워크 없이도 테스트 통과 (fallback 경로)
```

## 전체 작업 규모 추정

| Phase | 새 파일 | 수정 파일 | 추정 시간 |
|---|---:|---:|---|
| Phase 1 | 1 (data/claude.json) | 3 (Cargo.toml×2 + tokens.rs) | 2-3시간 |
| Phase 2 | 2 (routing.ts + encoding.ts) | 8 (context-usage + compaction + pruning + branch-summarization + agent-session + status-line + map-reduce + tests) | 4-6시간 |
| Phase 3 | 2 (download.ts + jawcode-tokenizers 레포) | 3 (tokens.rs + encoding.ts + tests) | 4-6시간 |
| Phase 4 | 1 (routing test) | 1 (ci.yml) | 1-2시간 |
| **합계** | **6** | **15** | **11-17시간** |

## 마일스톤

- **M1**: Phase 1 완료 → Claude 사용자의 토큰 표시 정확도 즉시 개선
- **M2**: Phase 2 완료 → 모든 provider에 대해 올바른 토크나이저 라우팅 (Phase 3 전까지 fallback)
- **M3**: Phase 3 완료 → Gemini/Llama/DeepSeek 등 실제 토크나이저로 정확 추정
- **M4**: Phase 4 완료 → CI 안정화, release-ready
