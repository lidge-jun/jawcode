# 10 — /tone 구현 플랜 (PABCD · revision a-r2)

> spec: [00_spec_tone_command.md](./00_spec_tone_command.md) · spec_ref 기록됨
> 개정 이력: P critic r1 → [10.1 synthesis](./10.1_p_synthesis_round1.md) · A audit r1 (planner PASS/architect FAIL) → [10.4 synthesis](./10.4_a_synthesis_round1.md) · A audit r2 (planner PASS/architect FAIL: ARCH-B1) → [10.7 synthesis](./10.7_a_synthesis_round2.md)
> 대상 패키지: `packages/coding-agent` 단독. 프로덕트 소스 3파일 MODIFY + 프롬프트 5파일 NEW + 테스트/문서.

## 설계 요약

`identity.tone`(enum) + `identity.toneCustom`(string) 설정 → `renderIdentityBlock()`이 `## Tone` 섹션으로 시스템 프롬프트에 주입. `/tone` 슬래시 커맨드가 설정을 영속(config.yml 전역). 기존 identity fail-safe(전부 unset이면 블록 null) 유지 — diff-0 불변식 보존.

## 파일별 변경

### 1. NEW — `packages/coding-agent/src/prompts/identity/tone-{sarcastic,savage,deadpan,hype,uhehe}.md`

각 파일은 불릿 3~6줄의 톤 지시문. **본문은 영문 우선, 한국어 뉘앙스 병기는 선택** (spec §Preset copy direction; PLANNER-A2). 공통 꼬리 조항(모든 파일 마지막 줄):
`Tone changes style only — correctness, completion-contract, and code-quality discipline are unchanged.`

- `tone-sarcastic.md`: 빈정+정확. 답은 맞게, 한 마디씩 얹기. 과한 조롱으로 정보 밀도 희생 금지.
- `tone-savage.md`: SOUL 계보 최대 수위. 욕설 허용, 나쁜 코드/결정에 직격. 인신공격이 아니라 결과물 타격.
- `tone-deadpan.md`: 감탄사·이모지·수사 0. 최소 어휘, 팩트와 diff만.
- `tone-hype.md`: 최대 텐션 응원. 성공에 과몰입 리액션, 실패도 에너지로 전환.
- `tone-uhehe.md`: 어흐흐 — 변태적 미소녀. 능글맞은 과몰입, "어흐흐" 웃음버릇, 코드·사용자에 대한 집착적 애정. 수위는 성인 유머 선, 업무 정확성 조항 필수.

### 2. MODIFY — `packages/coding-agent/src/config/settings-schema.ts`

(a) `"identity.language"` 블록(현 290–298행) 뒤에 2키 추가:

```ts
"identity.tone": {
    type: "enum",
    values: ["sarcastic", "savage", "deadpan", "hype", "uhehe", "custom"] as const,
    default: undefined,            // 선례: tool.renderMode (enum + default undefined)
    ui: { tab: "identity", label: "Tone", description: "Persona tone preset rendered as ## Tone (set via /tone)" },
},
"identity.toneCustom": {
    type: "string",
    default: undefined,
    ui: { tab: "identity", label: "Custom Tone", description: "Free-form tone text used when identity.tone = custom" },
},
```

(b) **SettingValue enum 분기 widen (ARCH-A1 해소)** — 현 3089–3092행의 enum 분기 앞에 default-undefined 조건 분기 추가:

```ts
: Schema[P] extends { type: "enum"; values: infer V; default: undefined }
    ? V extends readonly string[]
        ? V[number] | undefined
        : never
    : Schema[P] extends { type: "enum"; values: infer V }
        ? ... // 기존 분기 유지
```

`set("identity.tone", undefined)`가 as-cast 없이 typecheck. 파급: default-undefined enum은 리포에 `tool.renderMode` 1개뿐이고 유일한 get 호출부(`modes/controllers/event-controller.ts:173`)는 이미 `?? fallback` — 무파손 (10.4 synthesis에서 검증).

(c) **identity.vibe description 손질 (ARCH-A5)** — 현 287행 "Tone and personality lines" → "Free-form personality lines (distinct from the /tone preset)" 류로 tone 소유권 중복 제거.

### 3. MODIFY — `packages/coding-agent/src/system-prompt.ts`

- 상단 import 5건 (`with { type: "text" }`) + 모듈 상수:

```ts
const TONE_PRESETS: Record<string, string> = {
    sarcastic: toneSarcastic, savage: toneSavage, deadpan: toneDeadpan, hype: toneHype, uhehe: toneUhehe,
};
```

- `renderIdentityBlock()` (현 304–341행):
  - `tone`/`toneCustom` settings.get 추가 (try 블록 내).
  - tone 본문 해석 (**ARCH-B1 가드**): `tone === "custom" ? toneCustom?.trim() : tone ? TONE_PRESETS[tone]?.trim() : undefined` → 비었으면 미주입. §2(b) widen 후 `tone`은 `undefined` 가능이므로 인덱싱 전 가드 필수 (strict TS). 선택: `TONE_PRESETS`를 `Record<TonePreset, string>`(non-custom 유니온 키)로 타이핑해도 됨 — 어느 쪽이든 가드는 유지.
  - null-gate 확장: `if (!name && !emoji && !vibe && !language && !toneBody) return null;`
  - **삽입 위치 확정 (PLANNER-A1)**: `## Tone` 섹션(`"", "## Tone", toneBody`)은 **Vibe 블록(현 327–336행) 뒤, language 라인(현 337–339행) 앞**에 push — `Respond in <lang>` 트레일링 지시문이 항상 블록 마지막을 유지. custom은 원문 그대로, 프리셋은 md 본문 그대로.

### 4. MODIFY — `packages/coding-agent/src/slash-commands/builtin-registry.ts`

`/effort` 스펙(현 917–977행) 패턴으로 `/tone` 추가 + `/identity` 출력에 tone 2행 추가(581–589행 value 유니온에 `"identity.tone" | "identity.toneCustom"` 확장):

```ts
{
    name: "tone",
    description: "Set persona tone preset for the system prompt (identity.tone)",
    acpInputHint: "[sarcastic|savage|deadpan|hype|uhehe|custom|off|status]",
    subcommands: [
        { name: "sarcastic", description: "빈정거리지만 정확 — dry sarcasm" },
        { name: "savage", description: "매운맛 — profanity allowed, brutal honesty" },
        { name: "deadpan", description: "건조 극단 — facts only, zero flair" },
        { name: "hype", description: "텐션 최대 — maximum enthusiasm" },
        { name: "uhehe", description: "어흐흐 — 변태적 미소녀 톤" },
        { name: "custom", description: "Paste your own tone text", usage: "[text]" },
        { name: "off", description: "Clear tone preset" },
        { name: "status", description: "Show current tone" },
    ],
    allowArgs: true,
    handle: /* status/off/preset/custom 분기; custom 무인자는 아래 "custom 무인자 계약"의
               instruction 문자열을 runtime.session.prompt()로 발사 (identity-auto 패턴, builtin-registry.ts:602-622) */,
    // handleTui 미정의 (ARCH-A3/PLANNER-A6): TUI 디스패처가 handle을
    // adaptTuiSlashRuntime(ctx)로 자동 위임 (builtin-registry.ts:1916-1926) —
    // output은 showStatus로 라우팅되므로 별도 TUI lane 불필요.
    // B에서 설정 반영 후 상태줄 갱신이 필요하다고 판명되면 handleTui는
    // handle(command, adaptTuiSlashRuntime(runtime.ctx)) 위임 + refreshStatusLine만 하는 최소 셸로.
},
```

분기 계약:
- **args 파싱 (ARCH-A4)**: 디스패치는 **첫 토큰만** `trim().toLowerCase()`로 비교. `/effort`처럼 args 전체를 lowercase하지 않는다 — `custom`의 나머지 args는 원문 그대로(대소문자·개행 보존, 양끝 trim만).
- `status`/무인자: `identity.tone`(+custom이면 toneCustom 유무) 표시.
- 프리셋 5종: `settings.set("identity.tone", <preset>)` → "Tone set to X. Applies to new prompts."
- `custom <text>`: `settings.set("identity.toneCustom", text)` + `settings.set("identity.tone", "custom")`.
- `custom` 무인자: 아래 "custom 무인자 계약"의 instruction을 `runtime.session.prompt()`로 발사 (양쪽 lane 동일 헬퍼).
- `off`: `settings.set("identity.tone", undefined)` (§2(b) widen으로 typecheck; toneCustom은 보존 — 재선택 시 재사용).
- 미지원 인자: 에러 + 옵션 나열.

#### custom 무인자 계약 (critic F-02 해소)

양쪽 lane이 공유하는 `buildToneCustomInstruction()` 하나로 instruction 문자열을 생성한다 (identity-auto 선례: `builtin-registry.ts:607-618`). TUI lane은 디스패처의 handle 자동 위임을 타므로 헬퍼는 handle 안에서만 호출된다. instruction은 다음을 명시:

1. 사용자가 쓰던 언어로, tone 문안을 붙여넣어 달라고 한 번에 요청 (여러 줄 허용, 원문 그대로 보존한다고 안내).
2. 빈 입력/거절 시: 아무것도 저장하지 말고 "tone 설정이 변경되지 않았다"로 종료 (재프롬프트 강제 없음).
3. 저장 순서: `${APP_NAME} config set identity.toneCustom "<text>"` 먼저, 그 다음 `${APP_NAME} config set identity.tone custom` (멀티라인은 config set이 받는 그대로; 개행 보존).
4. 종료 시 저장 결과 1줄 요약 + "새 프롬프트부터 적용" 고지.

`/tone custom <text>` 인라인 lane도 같은 저장 순서(toneCustom → tone)를 따르며, args 원문(공백 포함)을 trim만 하고 그대로 저장한다. trim 결과가 빈 문자열이면 에러 + usage 안내.

### 5. MODIFY — `packages/coding-agent/test/system-prompt-identity.test.ts`

기존 컨벤션(temp home + `Settings.init({ inMemory })`) 그대로 케이스 추가:
1. `identity.tone=sarcastic`만 설정 → 블록 non-null, `## Tone` + sarcastic md 마커 문자열 포함.
2. `tone=custom` + `toneCustom="말끝마다 냥"` → `## Tone`에 원문 포함.
3. `tone=custom` + toneCustom 미설정 → `## Tone` 미렌더; 다른 필드도 없으면 null.
4. vibe+tone+language 동시 설정 → `## Vibe`·`## Tone` 모두 렌더 + **순서 어서션: vibe idx < tone idx < language idx** (PLANNER-A1).
5. diff-0: tone set→unset 후 baseline 복원 (기존 케이스 패턴 재사용) + **영속 라운드트립 (ARCH-A2)**: persist 모드에서 `/tone off` 상당(`set("identity.tone", undefined)`) 후 config.yml 재로드 시 tone이 unset으로 유지되고 `null` 부활이 없음을 어서션. null 부활이 실측되면 구현을 키 삭제 방식으로 전환.

### 6. 재생성/문서

- `bun scripts/generate-json-schemas.ts` → `schemas/config.schema.json` 동기화 (identity.tone enum 반영).
- `packages/coding-agent/CHANGELOG.md` `## [Unreleased]`에 1줄.
- `structure/40_fork-delta.md`: NEW `prompts/identity/tone-*.md` 행 + settings-schema/system-prompt/builtin-registry HARD-EDIT 밴드 주석 (커밋 동행 갱신 규칙).

## 실행 순서

1→2→3→4(소스) → 5(테스트) → 6(재생성·문서) → 검증.

## 검증 (acceptance)

자동:
- `bun test packages/coding-agent/test/system-prompt-identity.test.ts` green (테스트 1~5).
- `bun --cwd packages/coding-agent run check` green (coding-agent 집중 게이트: tsc + lint — §2(b) widen 파급 포함).
- root `bun run check:ts`는 전 워크스페이스 타입+스키마 게이트임을 전제로 실행 (critic F-04 반영).
- `bun scripts/generate-json-schemas.ts` 후 `git diff schemas/` 가 identity.tone/toneCustom 추가만 포함.

수동 (slash-command 표면 — spec acceptance 2·3, critic F-01 반영):
1. `/tone sarcastic` → `/tone status` 및 `/identity` 출력에 tone 행 확인은 **무조건 live로 수행** (PLANNER-A3). 새 프롬프트의 `## Tone` 주입 확인은 프롬프트 덤프로 하되, 덤프 수단이 없으면 그 부분에 한해 테스트 1로 대체 증빙 가능.
2. `/tone custom 말끝마다 냥` → `identity.toneCustom` 저장 + `identity.tone=custom` 전환 확인 (`/tone status`).
3. `/tone custom` 무인자 → buildToneCustomInstruction 프롬프트가 발사되어 붙여넣기 요청이 랜딩하는지 확인. TUI lane은 디스패처 handle 위임을 쓰므로 text lane 1회 확인 + 위임 경로 코드 리뷰로 갈음.
4. `/tone off` → `identity.tone` unset, `toneCustom` 보존 확인 + config.yml에 tone 키가 null로 부활하지 않는지 확인 (ARCH-A2).

최종 diff 체크리스트 (critic F-03 반영) — `git status`가 **정확히 다음 12개 파일**만 포함 (PLANNER-A4):
- NEW: `packages/coding-agent/src/prompts/identity/tone-{sarcastic,savage,deadpan,hype,uhehe}.md` (5개)
- MODIFY: `settings-schema.ts` / `system-prompt.ts` / `builtin-registry.ts` (3개 소스)
- MODIFY: `packages/coding-agent/test/system-prompt-identity.test.ts` (1개)
- MODIFY: `schemas/config.schema.json` (regen), `packages/coding-agent/CHANGELOG.md` (Unreleased 1줄), `structure/40_fork-delta.md` (tone-*.md 행 + HARD-EDIT 밴드 주석) (3개)

커밋 요건 (PLANNER-A5): NEW/HARD-EDIT 커밋에 `Fork-Delta: <종류> <경로>` 트레일러 동행 (structure/11_conventions.md:17) — 5 NEW 프롬프트 + 3 HARD-EDIT 소스.

## Non-goals (spec 승계)

TUI 셀렉터 오버레이 · 세션별 오버라이드 · SOUL 블록 개편 · 서브에이전트 프롬프트 tone 전파.

## 리스크

- ~~enum+default undefined 타입~~ → §2(b) SettingValue widen으로 해소 (ARCH-A1); 파급은 coding-agent check가 즉시 검출.
- 시스템 프롬프트 diff-0: null-gate 확장이 유일한 위험점 — 테스트 5로 고정.
- Bun YAML의 undefined 직렬화: 테스트 5 라운드트립 어서션으로 실측 고정 (ARCH-A2).
- uhehe/savage 수위: 프롬프트 파일에 공통 꼬리 조항으로 업무 규율 고정.
