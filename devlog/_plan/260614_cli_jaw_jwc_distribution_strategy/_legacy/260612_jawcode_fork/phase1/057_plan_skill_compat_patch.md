# 057 — 스킬 호환 패치 구현 플랜 (로딩 파이프라인)

> 상위: [055_moc_dev_skills_compat.md](./055_moc_dev_skills_compat.md). 치환 계약: [056](./056_map_cli_jaw_to_jwc.md).
> ⚠️ **개정 (인터뷰 260612 02:04)**: 085.5가 소스 하드 수정으로 전환되어 `brandPromptText()` 공통 엔진은 폐기. 런타임 치환은 **jwc 비소유 파일(`~/.cli-jaw/skills`) 전용**인 본 플랜의 dev 어휘 맵만 잔존 — 번들 4종·코드 프롬프트는 085.5 M2–M4 하드 수정 소관.

## 1. 패치 지점 (전수 — Backend 분석 P1–P9)

| # | file:line | 역할 | 본 플랜 적용 |
|---|-----------|------|--------------|
| **P1** | `extensibility/skills.ts:398-410` `buildSkillPromptMessage` | `/skill:*` 실행 시 본문 최종 조립 — frontmatter 제거 후 현재 **무치환** | ✅ **본문 치환 본점** — body 생성 직후 분기 |
| **P2** | `skills.ts:379-395` `resolveSkillSlashCommands` | slash autocomplete description | ✅ description 치환 |
| **P3** | `skills.ts:209-217` `loadSkills` skillMap | `<skills>` listing description | ✅ |
| **P4** | 신규 `gjc-runtime/brand-prompt.ts` (085.5 M3) + `applyCliJawDevVocabularyMap()` | 순수 치환 엔진 + 056 테이블 | ✅ 단일 정본 모듈 |
| P5–P6 | task/agents.ts, orchestrate-runtime | dev 스킬 아님 | 085.5 소관 |
| **P7** | `skills.ts:160-167` `effectiveIgnoredSkills` | dev-pabcd/memory 제외 | 유지 — 무변경 |
| **P8** | `discovery/cli-jaw.ts:21-35` | provider 메타 | `_source.provider === "cli-jaw"` 판별 사용 (로드 자체는 무변경) |
| P9 | `task/executor.ts:1389`, `tools/skill.ts:135`, `input-controller.ts:510`, `acp-agent.ts:733` | buildSkillPromptMessage 호출부 4곳 | P1 수정으로 일괄 — 무변경 |

## 2. 구현 diff 스케치

### M1. `gjc-runtime/cli-jaw-vocab.ts` (신규, ≤120줄) — [개정 02:04] dev 어휘 맵 단독 모듈

```typescript
/** 055 cli-jaw dev 어휘 맵 — jwc 비소유 파일(~/.cli-jaw/skills) 전용 런타임 치환. 순수 함수. */

const CLI_JAW_COMMAND_MAP: ReadonlyArray<[RegExp, string]> = [
	[/\bcli-jaw orchestrate ([IPABCD])\b/g, (…) => `jwc orchestrate ${stage.toLowerCase()}`],
	[/\bcli-jaw orchestrate reset\b/g, "jwc orchestrate complete (full reset 미지원)"],
	[/\bcli-jaw dispatch[^\n`]*/g, degraded("task subagent로 위임 — plan 전문을 task 프롬프트에 직접 포함")],
	[/\bcli-jaw bgtask[^\n`]*/g, degraded("장기 외부 대기는 로컬 폴링 또는 사용자 수동 재개")],
	[/\bcli-jaw (goal|memory)\b/g, "jwc $1"],          // 060/070 표면 — 구현 전엔 안내 문구 버전 사용
	[/\bcli-jaw (project|task|browser)[^\n`]*/g, degraded(…)],
];
export function applyCliJawDevVocabularyMap(body: string): string { … }
```

- 보존 규칙(테스트로 고정): `~/.cli-jaw` 경로 리터럴, `.gjc/`, fenced code 블록 내부는 명령 매핑만 적용하고 역할 어휘(Boss→main session)는 산문에만
- `degraded(msg)` = `[jwc: unavailable — ${msg}]` 고정 포맷

### M2. P1 분기 — `buildSkillPromptMessage`

```typescript
let body = content.replace(FRONTMATTER_RE, "").trim();
if (isJawBrand()) {
	if (skillSourceProvider(skill) === "cli-jaw") body = applyCliJawDevVocabularyMap(body);
	// 번들 4종은 085.5 M4 하드 수정으로 소스가 이미 jwc 어휘 — 추가 치환 불요 [개정 02:04]
}
```

- `skillSourceProvider`: Skill 타입의 source 메타(`_source.provider`)에서 — 없으면 `filePath.includes("/.cli-jaw/skills/")` 폴백
- P2/P3 description은 `brandPromptText` + 명령 매핑 1패스만 (degraded 블록 불요 — 짧은 문자열)

### M3. 호출부 — 무변경 (P9 4곳이 P1 경유)

## 3. 테스트 — `test/extensibility/skill-brand-compat.test.ts` (신규)

| 케이스 | 기대 |
|--------|------|
| jaw 브랜드 + cli-jaw provider 스킬 본문 `cli-jaw orchestrate I` | `jwc orchestrate i` |
| 동일 본문 `cli-jaw bgtask add --preset web-ai` | `[jwc: unavailable — …]` 포함, 원문 비노출 |
| `~/.cli-jaw/skills` 경로 리터럴 | 무변경 보존 |
| fenced 코드 블록 내 `cli-jaw dispatch …` | 명령 매핑 적용, 역할 어휘 비적용 |
| gjc 브랜드(env unset) | **byte-동일** (no-op) |
| native(비 cli-jaw) 스킬 | 무치환 — 번들 소스가 이미 jwc 어휘 (085.5 M4 하드 수정) |
| dev-pabcd/memory | 여전히 미로드 (`skills-discovery-jaw.test.ts` 기존 + 회귀 확인) |

게이트: `bun run check:types` + biome + 기존 `skills-discovery-jaw.test.ts` 무회귀. rebrand/G002 무접촉(소스 스킬 파일 무변경).

## 4. 구현 순서·의존

1. ~~085.5 brandPromptText 골격~~ 불요 [개정 02:04 — 085.5 하드 수정으로 공통 엔진 폐기]
2. 본 플랜 M1 dev 어휘 맵(cli-jaw-vocab.ts) + M2 분기 + 테스트
3. 060/070 구현 시 056 §5-1에 따라 stub 문구를 실명령으로 갱신 (테이블 1곳)
4. §6 P10 (M4 stage-skill-map + M5 주입 2곳) — 085.6 M1(agent-identity) 이후 (주입 텍스트 계약 의존)

## 5. [확정] (인터뷰 260612 01:36 — 열린 질문 0)

1. 치환 범위: **dev 군 우선** — 다른 스킬(search, telegram-send 등)은 발견 시 테이블 추가 [확정]
2. degraded 안내 언어: **영어 고정** — 스킬 본문 주류 언어 [확정]

## 6. P10 — 워크플로 단계·role 스킬 주입 (인터뷰 확정 편입, 058 §3 후보의 정식화)

cli-jaw에서 dev 스킬이 "자연스럽게 읽히는" 메커니즘(role/tag→스킬 주입, Phase Guide)의 jwc 동형. 발동 조건: `jawBrand && cliJawSkillsDirExists` — gjc 브랜드 byte-동일 무회귀.

### M4. `gjc-runtime/stage-skill-map.ts` (신규, 순수 데이터 ≤30줄)

| jwc stage | 주입 스킬 (로드된 것만 — 부재 시 해당 항목 생략) |
|-----------|--------------------------------------------------|
| p (plan) | dev, dev-architecture |
| a (audit) | dev-code-reviewer |
| b (build) | dev (+ 변경 표면별 role 스킬: frontend→dev-frontend, backend→dev-backend, data→dev-data, docs→dev-scaffolding — cli-jaw `ROLE_SKILL_NAME_MAP` 동형) |
| c (check) | dev-testing |

### M5. 주입 지점 2곳

1. **stage 프롬프트**: `gjc-runtime/orchestrate-runtime.ts:345` `STAGE_PROMPTS[target]` 방출 직전 — 로드된 스킬 셋에서 name 매칭 → 존재하는 것만 "⛔ Before starting this stage, read `/skill:<name>`" 블록 append. 정적 `prompts/jaw/orchestrate-*.md`에 박지 않음 (스킬 존재가 머신별로 다름 + D4 업스트림 충돌 회피).
2. **audit 서브에이전트**: auditArchitect → dev-architecture, auditPlanner → dev 포인터 1줄 — spawn 프롬프트 조립부에서 동일 resolve.

### 계약 (085.6 §4와 상호)

- 주입 블록 텍스트는 jwc 네이티브 어휘로 직접 생성 [개정 02:04 — 하드 수정 후 누수원 없음, brandPromptText 불요] — 이름 표기만 `agent-identity.ts` 헬퍼(085.6 M1) 공용.
- 테스트 추가분: ① stage p 진입 시 dev/dev-architecture 포인터 포함(스킬 존재 시) ② 스킬 부재 머신에서 블록 생략·에러 0 ③ gjc 브랜드 byte-동일.
