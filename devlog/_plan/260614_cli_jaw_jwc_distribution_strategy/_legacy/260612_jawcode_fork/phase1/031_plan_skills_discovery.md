# 031 — 030 밴드 구현 플랜: 스킬 디스커버리 대체 모델

> ⚠️ **[구원칙 폐기 — 인터뷰 260612 02:04]** 본 문서의 'gjc diff-0 / 무수정 추종 / 런타임 치환 / 무회귀' 서술은 폐기된 구원칙 기록이다. 현행 원칙은 **소스 하드 수정**(Jaw/jwc 어휘 직접 기입, 가드 jwc 기준 반전) — [085.5 개정판](./085.5_plan_prompt_rebrand.md) · [095](./095_plan_debt_cleanup.md) 참조.

> P 산출물 (260612 05:07, goal 9ab19d16). 인터뷰 R13–R16 확정 스코프. 분류: C2~C3 (디스커버리 게이트 1곳 + 프로바이더 1개).
> 불변식: **gjc 브랜드 시 스킬 셋 변화 0** (diff-0 패턴 3연속 적용).

## 핵심 발견 (계획을 줄인 것)

- **`.agents/skills` 워크업+유저홈 프로바이더가 업스트림에 기존재** (`discovery/agents.ts:65-83`) —
  안 잡혔던 유일한 이유는 `extensibility/skills.ts:124 isSourceEnabled`의 **native-only 필터**
- 충돌 규칙 = **first-wins** (skillMap 선점, 후순위는 collision warning) — 프로바이더 priority가 곧 우선순위
- `ignoredSkills`/`customDirectories` 옵션 기존재, frontmatter는 `[key: string]: unknown`이라 keywords/triggers 보존
- → 구현 = 신규 프로바이더 1개 + 게이트 brand 분기 + 기본 제외 2종

## Part 1 — 쉬운 설명

jwc로 띄우면: 글로벌 스킬은 `~/.cli-jaw/skills`(29개)가 1순위로 로드되고(gjc의 빈 유저 폴더 자리를 대체),
`.agents/skills`(크로스툴 관례, 워크업)도 보이며, cli-jaw 전용이라 jwc에서 모순인 `memory`/`dev-pabcd` 2개만 빠진다.
gjc로 띄우면 지금과 100% 동일.

## Part 2 — diff 레벨

### M1. NEW `packages/coding-agent/src/discovery/cli-jaw.ts` — 글로벌 정본 프로바이더

- id `"cli-jaw"`, displayName `"cli-jaw"`, **priority 110** (native 100보다 높음 → first-wins로 글로벌 승)
- skillCapability만 등록. `load()`: 브랜드가 엔진과 같으면(gjc) 즉시 빈 결과,
  jwc 브랜드면 `~/.cli-jaw/skills`를 `scanSkillsFromDir`(helpers 기존 함수)로 스캔 (level "user")
- 디렉토리 부재 시 빈 결과 → native user가 그대로 살아 **폴백 자동 성립**

### M2. `packages/coding-agent/src/discovery/index.ts` — 프로바이더 import 등록 (1줄)

### M3. `packages/coding-agent/src/extensibility/skills.ts` — isSourceEnabled brand 분기 (L122-130)

```ts
function isSourceEnabled(source: SourceMeta): boolean {
  const { provider, level } = source;
  if (provider === "native") {
    if (level === "user") {
      // 대체: jwc 브랜드 + ~/.cli-jaw/skills 존재 시 native user 억제 (부재 시 폴백 유지)
      if (isJawBrand() && cliJawSkillsDirExists()) return false;
      return enablePiUser;
    }
    if (level === "project") return enablePiProject;
    return false;
  }
  if (provider === "cli-jaw") return isJawBrand();         // 글로벌 정본
  if (provider === "agents") return isJawBrand();          // .agents 관례 (워크업+유저홈)
  return false;                                            // 기타 프로바이더(claude/codex/...)는 업스트림대로 차단
}
```

- `isJawBrand()` = `APP_NAME !== ENGINE_NAME` (utils 기존 상수 — 010 산출물 재사용)
- `cliJawSkillsDirExists()` = `~/.cli-jaw/skills` 존재 캐시 체크

### M4. jaw 브랜드 기본 제외 2종 (`loadSkills` 옵션 기본값 합성)

```ts
const effectiveIgnored = isJawBrand() ? [...ignoredSkills, "memory", "dev-pabcd"] : ignoredSkills;
```
네이티브-대체 명단 (D10): jwc가 `jwc memory`/`jwc orchestrate`를 네이티브 제공 — cli-jaw판 스킬은 모순 지시.

### M5. NEW 테스트 `packages/coding-agent/test/skills-discovery-jaw.test.ts`

temp HOME + `GJC_BRAND_NAME` env 제어 (dedup 테스트의 temp-home 패턴 재사용):
1. jwc 브랜드 + `~/.cli-jaw/skills` 존재 → cli-jaw 스킬 로드, native user 미로드 (대체)
2. 동명 충돌: `~/.cli-jaw/skills/x` vs `.agents/skills/x` → cli-jaw 승 (priority first-wins)
3. jaw 브랜드에서 `memory`/`dev-pabcd` 이름 제외
4. **gjc 브랜드 → cli-jaw·agents 프로바이더 항목 0, native만** (diff-0 불변식)
5. jwc 브랜드 + `~/.cli-jaw` 부재 → native user 폴백
6. `.agents/skills` 워크업 인식 (jaw 브랜드)

### M6. 문서 — 본 031 결과표 + README.jwc.md 스킬 섹션 1줄

## 검증 (C)

1. 신규 테스트 6케이스 통과 + 기존 스킬 테스트 무회귀 (`bun test packages/coding-agent/test/` 중 skills 관련)
2. `bun run check:ts` 전체 체인 exit 0
3. 실머신 e2e: `jwc` 헤드리스 1턴으로 `/skills` 출처 표시 또는 시스템 프롬프트에 cli-jaw 스킬 목록 확인 — 가능 범위에서
4. `gjc --version` + 스킬 로드 무회귀

## A 감사 확인 요청

1. `loadCapability` 결과(result.items)가 프로바이더 priority 순으로 정렬되는지 (first-wins 전제) — capability/index.ts 로직 인용
2. agents 프로바이더의 priority 값 (native 100 대비) — cli-jaw(110) > native(100) > agents 순서 성립 확인
3. `scanSkillsFromDir` 시그니처가 M1 사용 방식과 일치하는지
4. `GJC_BRAND_NAME` env가 테스트에서 모듈 로드 후 변경 가능한지 (APP_NAME은 모듈 초기화 시 고정 — 테스트는 env 먼저 설정 필요 / 또는 isJawBrand()를 env 직독으로)
5. ignoredSkills 합성 지점이 custom 디렉토리 경로에도 적용되는지 (L204-210 매칭 로직)

## 범위 밖

- `<루트>/skills/` (R13 기각) · `.gemini` 변경 없음 · 비활성 `skills_ref/` 미인식
- jwc 네이티브 memory/orchestrate 명령 자체 (050/060/070 밴드)
- `/skills` 표시 개선 (source 필드 기존재 — 표시 형식 변경은 범위 밖)

## §감사 반영 (v1 FAIL → v2, 260612 05:1x)

1. **isJawBrand() = `process.env.GJC_BRAND_NAME` 런타임 직독** (APP_NAME은 모듈 로드 시 고정 — 테스트 브랜드 전환 불가 문제).
   정의 위치: `discovery/helpers.ts` (cli-jaw 프로바이더·skills.ts 양쪽 import)
2. `cliJawSkillsDirExists()` — skills.ts 로컬, `fs.existsSync(path.join(os.homedir(), ".cli-jaw", "skills"))`
   런타임 체크 (캐시 없음 — 테스트 단순화, homedir 모킹 호환)
3. M1 `requireDescription: true` (custom 디렉토리 스캔과 동일 정책)
4. M5 테스트: per-test `process.env.GJC_BRAND_NAME` 설정 + afterEach 정리 + homedir 모킹 (011 env-before-import 패턴 불요 — 런타임 직독이라)
5. 감사 PASS 확인: first-wins 전제(priority 정렬), agents priority < native 100, scanSkillsFromDir 시그니처,
   ignoredSkills 양쪽 적용, index.ts 1줄 등록, rebrand 가드 무반응

## 구현 결과 (260612 05:2x — B/C 완료, 커밋 af7523f)

| # | 검증 | 결과 |
|---|------|------|
| 1 | 신규 테스트 6케이스 (대체/충돌 글로벌 승/제외 2종/gjc diff-0/폴백/.agents 워크업) | 6 pass ✅ |
| 2 | 스킬 스위트 전체 무회귀 (9파일) | 126 pass / 0 fail ✅ |
| 3 | `bun run check:ts` 전체 체인 | exit 0 ✅ |
| 4 | **실홈 e2e (jwc)**: `loadSkills` → `cli-jaw:user` 27개 (= 29 − 제외 2), memory·dev-pabcd 제외 확인 | ✅ |
| 5 | **실홈 e2e (gjc)**: 비네이티브 소스 0 (diff-0) | ✅ |
| 6 | `jwc/gjc --version` 스모크 | ✅ |

변경: discovery/cli-jaw.ts(신규 프로바이더 P110), helpers.ts(isJawBrand env 직독), index.ts(등록 1줄),
extensibility/skills.ts(isSourceEnabled brand 분기 + 기본 제외 2종), test/skills-discovery-jaw.test.ts(신규 6케이스).

### ⚠️ 실측 발견: .agents 워크업은 git repoRoot에서 멈춤

`getProjectPathCandidates`(agents.ts:46-61)는 cwd→repoRoot까지만 워크업 — **git 리포 안에서는 리포 상위의
`Developer/new/.agents`가 안 잡힘** (업스트림 표준 시맨틱, 의도된 경계). 유닛 테스트는 비-git 임시 디렉토리라 통과.
실사용 해법(코드 무수정): `~/.agents/skills`(유저 홈 레벨, 현재 빈 디렉토리)에 심볼릭 링크 —
`ln -s /Users/jun/Developer/new/.agents/skills/* ~/.agents/skills/` 또는 디렉토리 링크.
워크업 경계를 repoRoot 너머로 확장하는 포크 수정은 서프라이즈 리스크로 비채택 (사용자 결정 시 재고).
