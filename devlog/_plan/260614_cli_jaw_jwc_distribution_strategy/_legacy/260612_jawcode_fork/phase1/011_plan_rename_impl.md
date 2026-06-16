# 011 — 010 밴드 구현 플랜 v2: 표면 리네이밍 (ENGINE/APP 역전 설계)

> ⚠️ **[구원칙 폐기 — 인터뷰 260612 02:04]** 본 문서의 'gjc diff-0 / 무수정 추종 / 런타임 치환 / 무회귀' 서술은 폐기된 구원칙 기록이다. 현행 원칙은 **소스 하드 수정**(Jaw/jwc 어휘 직접 기입, 가드 jwc 기준 반전) — [085.5 개정판](./085.5_plan_prompt_rebrand.md) · [095](./095_plan_debt_cleanup.md) 참조.

> P 산출물 v2 (260612 03:50, goal c3fab4a7). v1 감사 FAIL 반영: Backend 감사가 표시 지점 11+ 파일 누락과
> TUI 하드코딩 5곳을 적발 → **역전 설계**로 전환: 표시 지점(40+)은 무수정, 기능 지점(소수)만 고정 상수로 분리.
> 분류: C2. 감사 지적 전 항목 흡수 확인: 본 문서 §감사 반영.

## Part 1 — 쉬운 설명

`APP_NAME` 상수를 "브랜드 가변"으로 바꾸고(`jwc` bin이 env로 jwc 지정), 경로·바이너리 해석 등
기능 지점만 새 고정 상수 `ENGINE_NAME="gjc"`로 옮긴다. 그러면 헬프/배너/안내문 40여 곳이
한 줄도 안 고치고 자동으로 jwc 브랜드가 된다. `.gjc/` 경로는 `CONFIG_DIR_NAME`(별도 상수, dirs.ts:23)이라 영향 없음.

## Part 2 — diff 레벨

### M1. `packages/utils/src/dirs.ts`

```ts
// L20 교체:
export const ENGINE_NAME: string = "gjc";                                   // 경로/기능용 고정
export const APP_NAME: string = process.env.GJC_BRAND_NAME || ENGINE_NAME;  // 표시용 가변
// 내부 기능 사용처 3곳 APP_NAME→ENGINE_NAME:
//   L143 path.join(value, APP_NAME)  · L242 로그 파일명  · L447 디버그 로그명
```

### M2. 기능 지점 import 별칭 치환 (본문 diff 0)

| 파일 | 변경 |
|------|------|
| `packages/coding-agent/src/cli/update-cli.ts:10` | `import { ..., ENGINE_NAME as APP_NAME, ... }` — 릴리스 에셋명(198,200)·$which(207) 등 업데이트 채널 전체가 엔진(gjc) 기준 |
| `packages/coding-agent/src/utils/tools-manager.ts:4` | 동일 별칭 — User-Agent(120) 유지 |

(init-xdg.ts는 로컬 `const APP_NAME="gjc"`라 무영향 — 확인 완료)

### M3. `packages/jwc/bin/jwc.js` — env 선설정 + 동적 import (호이스팅 회피)

```js
#!/usr/bin/env bun
process.env.GJC_BRAND_NAME = "jwc";
await import("@gajae-code/coding-agent/cli");
```

### M4. TUI 하드코딩 리터럴 5곳 (감사 적발분)

| 파일:라인 | 전 | 후 |
|------|----|----|
| `modes/components/status-line/segments.ts:69` | `"GJC"` | `APP_NAME.toUpperCase()` (import 추가) |
| `modes/utils/ui-helpers.ts:538` | `"gjc update"` | `` `${APP_NAME} update` `` |
| `modes/components/provider-onboarding-selector.ts:28` | `"...gjc setup provider..."` | 템플릿 치환 |
| `modes/components/plugin-settings.ts:70` | `"gjc plugin install <package>"` | 템플릿 치환 |
| `modes/acp/acp-agent.ts:408` | `"Launch the gjc TUI..."` | 템플릿 치환 |

### M5. `modes/components/welcome.ts:200` — `· GJC forge` 꼬리표

```ts
const title = ` ${APP_NAME} v${this.version} · ${APP_NAME === "gjc" ? "GJC forge" : "Jawcode"} `;
```

### M6. `scripts/rebrand-inventory.ts` — 가드 확장

```ts
const expectedCliBins = ["gjc", "gjc-stats", "jwc"] as const;                  // L35
const allowedUnscopedPackageNames = new Set([expectedRootPackageName, "jwc"]); // L37
```

### N1. NEW `README.jwc.md` — jwc/jawcode 소개 (fork 관계, bin, jwc/sdk, M1/M2 로드맵 링크)

## 검증 (C)

1. `bun packages/jwc/bin/jwc.js --version` → `jwc/<VERSION>` (gjc 0건)
2. `bun packages/jwc/bin/jwc.js --help` 헤더·예시가 jwc (역전 설계로 서브커맨드 헬프 전수 자동 적용 — args.ts:296 등)
3. **무회귀**: `bun packages/gajae-code/bin/gjc.js --version` → `gjc/<VERSION>` 그대로 (env 미설정 시 ENGINE 기본)
4. `bun scripts/rebrand-inventory.ts --strict` → PASS / `bun scripts/verify-gjc-ui-redesign.ts` → PASS (프리셋 검사라 무영향 — 확인 완료)
5. `bun run check:ts` (002_proxy Rust 실패는 기존 이슈, 범위 밖)

## §감사 반영 (v1 FAIL → v2)

- 표시 지점 누락(args/launch/config-cli/plugin-cli/auth-broker-cli/setup/stats/web-search/shell/system-info/http-inspector 등 40+) → **역전 설계로 전부 자동 해소** (수정 0)
- TUI 하드코딩 5곳 → M4로 명시 수정
- 검증 기준 모호 → §검증 1–3으로 확정 (루트+서브 헬프 전수 자동, TUI 리터럴은 M4 한정)
- M2 jwc.js 미반영 → M3 명시
- update-cli 방침 → 엔진 채널(gjc)로 일관 (M2 별칭)

## 범위 밖 (의도적)

- `.gjc/`(CONFIG_DIR_NAME)·`@gajae-code/*`·env prefix·릴리스 에셋명 (D4)
- 기본 스킬 4종 표시명 (040/050 가드 전략과 함께)
- jwc 자체 업데이트 채널 (퍼블리시 정책과 함께, 010 열린 질문)

## 구현 결과 (260612 04:0x — B/C 완료, 커밋 59d10c6)

검증 전 항목 통과:

| # | 검증 | 결과 |
|---|------|------|
| 1 | `bun packages/jwc/bin/jwc.js --version` | `jwc/0.4.4` ✅ |
| 2 | `jwc --help` 브랜드 gjc/GJC 잔존 (env `GJC_*`·`.gjc` 경로 제외) | 0건 ✅ — 커맨드 설명 12파일 추가 스윕 포함 |
| 3 | `gjc --version`/`--help` 무회귀 | `gjc/0.4.4`, `gjc v0.4.4` ✅ |
| 4 | `bun scripts/rebrand-inventory.ts --strict` | exit 0 ✅ (jwc bin 기대값/unscoped 허용 반영) |
| 5 | `bun scripts/verify-gjc-ui-redesign.ts` | exit 0 ✅ |
| 6 | `bun run check:ts` 전체 체인 (biome/node20/schemas/gjc-ui/워크스페이스) | exit 0 ✅ |

플랜 대비 추가 작업 (실측에서 발견):
- 루트 헬프의 커맨드 설명에 GJC 브랜드 잔존 12파일 → `${APP_NAME.toUpperCase()}` 템플릿 스윕
  (deep-interview/codex-native-hook/coordinator/mcp-serve/setup/skills/ultragoal/ralplan/team/session/state + args.ts:266)
- 의도적 잔존 (D4): env 변수명 `GJC_*`, `.gjc/` 경로 표기, 릴리스 에셋명, User-Agent
- 잔여 (후속): 서브커맨드 `examples`의 `$ gjc ...` 리터럴 (state.ts 등) — 루트 헬프 비노출, 추후 스윕
