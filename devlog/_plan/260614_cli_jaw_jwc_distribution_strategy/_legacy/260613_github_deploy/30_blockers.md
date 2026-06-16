# 30 — Tasks 001-005: CI 블로커 해소

> 5건 전부 해소해야 CI green. 실행 순서: 001(커밋) → 002(biome) → 003(tsc) → 004(zod) → 005(테스트)

## 002 — Biome 66 lint/format 에러

**복잡도**: S (대부분 auto-fix)
**차단**: lint CI check 완전 차단

`npx biome check` exit non-zero, 66건:
- 7 format violations (formatter rewrite)
- ~50 import-sort/organizeImports
- 3 `noUnusedPrivateClassMembers`
- 2 `useOptionalChain`
- 1 `noUnusedVariables`, 1 `useTemplate`

**해결**: `npx biome check --write` → 수동 검토 → 커밋

영향 파일: `jwc-defaults.ts`, `selector-controller.ts`, `settings-schema.ts`, `packages/ai/src/index.ts`,
`packages/tui/src/tui.ts`, smoke-test scripts

## 005 — 27 failing tests / 8591

**복잡도**: M-L (mock fixture 갱신 필요)
**차단**: test CI check 완전 차단

주요 실패:
- `btw-escape-dismiss.test.ts`: mock ctx에 `composerFooter` 누락 → TypeError
- `redesigned-shell.test.ts`: status preset에 `pabcd` 모드 예상 밖 포함
- `ModelSelector canonical model selection`: 4건 — GJC assignment 모델 변경
- `default GJC definitions`: 2건 — 번들 워크플로 스킬셋 변경
- `skills > loadSkills with options`: 4건 — custom directory 핸들링
- `searchCodex model selection`: 3건 — 기본 모델 상수 변경
- `gjc harness CLI`: 1건 — 5s timeout
- 기타: release bump, auto-compaction, BashTool ACP routing 등

**해결**: mock fixture 갱신 + 새 기능 로직 안정화

## 003 — 2209 TS6305 stale .d.ts 에러

**복잡도**: S
**차단**: tsc CI check 완전 차단

`tsc --noEmit` → 2209 `TS6305` ("output file not built from source"). 전부 stale declaration 파일.
**실제 타입 에러 0건** — 이 클래스의 에러만.

**해결**: CI에서 `tsc --noEmit` 전에 `bun run build` 선행. 또는 `--incremental false`.

## 004 — cu-mcp-server zod 3 vs catalog zod 4

**복잡도**: M
**차단**: latent build risk (현재 bun이 별도 해석하지만 크로스패키지 시 깨짐)

`packages/cu-mcp-server/package.json`: `"zod": "^3.24.0"`, `"typescript": "^5.8.0"`
root catalog: `zod: 4.4.3`, `typescript: ^6.0.3`

bun이 zod 3.x를 별도 해석하나 API가 다름 (zod 4는 `z.string()` → `z.pipe()` 등 breaking change).
크로스 패키지 스키마 공유 시 런타임 에러.

**해결**: cu-mcp-server를 zod 4 + TS 6으로 업그레이드, 또는 workspace override로 격리 유지

## 001 — dirty bun.lock + uncommitted files

**복잡도**: S
**차단**: `bun install --frozen-lockfile` 실패

`bun.lock` modified + 8 소스 파일 unstaged + untracked devlog plan 파일.

**해결**: staged changes 커밋 + lockfile 갱신 커밋

## 실행 순서

```
001 (S, 커밋 정리)
 → 002 (S, biome --write)
   → 003 (S, CI에서 build 선행)
     → 004 (M, zod 4 마이그레이션)
       → 005 (M-L, 27 test fixture 갱신)
```
