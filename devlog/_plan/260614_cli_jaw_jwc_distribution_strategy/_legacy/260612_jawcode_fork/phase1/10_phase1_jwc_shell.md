# 10 — Phase 1: jwc 셸 구축
> ⚠️ **번호 주의**: 010 셸 ✅. gjc chase → [struct_har/chase/10_gjc_chase_MOC.md](../../../struct_har/chase/10_gjc_chase_MOC.md)

> 목표: 업스트림 파일 0개 수정으로 `jwc` CLI와 임베딩 호환 표면을 만든다.
> cli-jaw가 미래에 import할 경로는 **`jwc/sdk` 하나로 고정** — 업스트림 내부 구조가
> 바뀌어도 이 재수출 계층만 따라가면 된다 (호환 보장 지점).

## 변경 목록

루트: `/Users/jun/Developer/new/700_projects/jawcode/`

### NEW `packages/jwc/package.json`

```json
{
  "type": "module",
  "name": "jwc",
  "version": "0.1.0",
  "description": "Jawcode (jwc) — cli-jaw native runtime CLI, fork surface over gajae-code",
  "license": "MIT",
  "bin": { "jwc": "bin/jwc.js" },
  "exports": {
    ".": { "types": "./src/index.ts", "import": "./src/index.ts" },
    "./sdk": { "types": "./src/sdk.ts", "import": "./src/sdk.ts" }
  },
  "dependencies": { "@gajae-code/coding-agent": "catalog:" },
  "engines": { "bun": ">=1.3.14" }
}
```

### NEW `packages/jwc/bin/jwc.js`

```js
#!/usr/bin/env bun
import "@gajae-code/coding-agent/cli";
```

(업스트림 `packages/gajae-code/bin/gjc.js`와 동일 패턴)

### NEW `packages/jwc/src/sdk.ts`

`@gajae-code/coding-agent/sdk` 전체 재수출. cli-jaw 임베딩의 단일 진입점.

### NEW `packages/jwc/src/index.ts`

공개 경계 export — sdk 재수출 + 향후 `JawRuntime`(Phase 3) 자리.

## 비변경 (의도적)

- 업스트림 `packages/gajae-code`(gjc bin)는 그대로 — jwc와 공존
- `.gjc/` 상태 경로 유지 — AGENTS.md 계약. jwc 고유 경로가 필요해지면 Phase 3에서 결정
- 워크스페이스 등록: 루트 `package.json`의 `"packages/*"` 글롭이 자동 포함 → 루트 수정 불필요

## 검증

1. `bun install` (워크스페이스 링크)
2. `bun packages/jwc/bin/jwc.js --version` → 버전 출력
3. `bun -e 'import("jwc/sdk").then(m => console.log(typeof m.createAgentSession))'` → `function`
