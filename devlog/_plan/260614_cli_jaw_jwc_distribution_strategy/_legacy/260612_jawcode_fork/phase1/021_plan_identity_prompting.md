# 021 — 020 밴드 구현 플랜: jaw 아이덴티티 프롬프팅 + identity 설정 표면

> ⚠️ **[구원칙 폐기 — 인터뷰 260612 02:04]** 본 문서의 'gjc diff-0 / 무수정 추종 / 런타임 치환 / 무회귀' 서술은 폐기된 구원칙 기록이다. 현행 원칙은 **소스 하드 수정**(Jaw/jwc 어휘 직접 기입, 가드 jwc 기준 반전) — [085.5 개정판](./085.5_plan_prompt_rebrand.md) · [095](./095_plan_debt_cleanup.md) 참조.

> P 산출물 (260612 04:09, goal 9c75379f). 인터뷰 R12 확정 스코프. 분류: C2.
> 불변식: **identity 필드 미설정 시 업스트림 시스템 프롬프트 diff 0** (010의 무회귀 패턴 승계).

## Part 1 — 쉬운 설명

`/settings`(또는 config.yml)에서 에이전트 이름/이모지/말투/언어를 설정하면 시스템 프롬프트에
아이덴티티 블록이 렌더된다 (cli-jaw a2 방식). `/identity`는 설정 경로를 알려주고,
`/identity-auto`는 에이전트가 몇 가지 질문을 한 뒤 설정을 대신 써준다. 아무것도 설정하지 않으면
지금과 100% 동일하게 동작한다.

## Part 2 — diff 레벨

### M1. `packages/coding-agent/src/config/settings-schema.ts` — 스키마 + 탭

- `SettingTab` 유니온(L26)과 `SETTING_TABS`(L41)에 `"identity"` 추가 (appearance 앞)
- 스키마 엔트리 4개 (string, default undefined, ui 블록):

```ts
"identity.name":     { type: "string", default: undefined, ui: { tab: "identity", label: "Name", description: "Agent display name for the system prompt identity block" } },
"identity.emoji":    { type: "string", default: undefined, ui: { tab: "identity", label: "Emoji", description: "Signature emoji shown alongside the agent name" } },
"identity.vibe":     { type: "string", default: undefined, ui: { tab: "identity", label: "Vibe", description: "Tone and personality lines (semicolon or newline separated)" } },
"identity.language": { type: "string", default: undefined, ui: { tab: "identity", label: "Language", description: "Preferred response language (e.g. Korean, English)" } },
```

- settings-defs.ts는 스키마 어댑터라 **무수정** (ui 블록만으로 텍스트 입력 위젯 자동 생성 — string+ui)

### M2. `packages/coding-agent/src/system-prompt.ts` — 합성기

- NEW 함수 `renderIdentityBlock(): string | null` — `settings.get("identity.*")` 4필드 읽어
  전부 비면 `null`, 아니면 a2 구조의 마크다운 블록 생성:

```md
# Identity
- Name: {name}{emoji ? " " + emoji}
{vibe ? "## Vibe\n- ..." }
{language ? "- Respond in: {language}"}
```

- L539–548 합성 지점: `systemPromptCustomization: [renderIdentityBlock(), effectiveSystemPromptCustomization].filter(Boolean).join("\n\n") || null`
  → 미설정 시 기존과 동일 값(null 또는 SYSTEM.md 단독) = **diff 0 불변식 충족**
- settings 싱글톤 import (`config/settings`) — ui-helpers.ts와 동일 패턴

### M3. `packages/coding-agent/src/slash-commands/builtin-registry.ts` — 커맨드 2종

- **`/identity`** — `handle(command, runtime)` (TUI/ACP 공용): `runtime.output()`으로
  현재 identity 설정값 + 설정 경로 안내 (config.yml = `<agentDir>/config.yml`, SYSTEM.md 통로 설명,
  `/settings` Identity 탭 안내)
- **`/identity-auto`** — 에이전트에게 인터뷰 지시 프롬프트 제출: 이름/이모지/말투/언어를 한국어/영어
  사용자 언어로 1–2회 질문한 뒤, 답을 config.yml identity.* 에 기록(`gjc config` 커맨드 또는 직접 편집)하고
  요약 보고하라는 인스트럭션. 제출 경로는 `runtime.session`의 프롬프트 큐 API 사용
  — **A 감사 확인 항목: AgentSession의 정확한 prompt/steer 메서드명**

### M4. NEW 테스트 `packages/coding-agent/test/system-prompt-identity.test.ts`

1. identity 미설정 → buildSystemPrompt 결과가 기존과 동일 (필드 없는 settings로 호출, identity 블록 부재)
2. identity 설정(name/emoji/vibe/language) → 시스템 프롬프트에 렌더 블록 포함 (스냅샷)
3. 일부 필드만 설정 → 해당 라인만 렌더
- settings는 inMemory 모드(`options.inMemory` 기존재, settings.ts:223 부근)로 격리

### M5. 문서 — 본 021에 구현 결과 추가, README.jwc.md에 identity 설정 1줄

## 검증 (C)

1. `bun test packages/coding-agent/test/system-prompt-identity.test.ts` 통과
2. **diff 0 불변식**: 미설정 상태에서 buildSystemPrompt 산출 비교 테스트 GREEN
3. `bun run check:ts` 전체 체인 (rebrand strict 포함) exit 0
4. `bun packages/gajae-code/bin/gjc.js --version` 무회귀 + `jwc --version` 정상
5. TUI 수동 확인 불가 항목(/settings 탭 렌더)은 settings-defs 어댑터 구조상 스키마 ui 블록으로 자동 —
   `getPathsForTab("identity")` 단위 확인으로 대체

## 범위 밖

- jaw 어휘 통일·언어 정책 전반(020 MOC 스코프 2·4) — identity 표면이 선행 슬라이스, 어휘 통일은 040–060 병합과 함께
- SYSTEM.md 에디터 UI (경로 안내만, 파워유저는 직접 편집)
- cli-jaw 임베딩 시 identity 처리 (M2 130에서)

## §감사 반영 (v1 FAIL → v2, 260612 04:1x)

Backend 감사 FAIL 4건 + 추가 확인 결과를 플랜에 반영:

1. **M1 보강 — 탭 메타/테마 심볼**: 새 탭은 `TAB_METADATA`(settings-schema.ts:54, `Record<SettingTab, {label, icon}>`)에
   엔트리 필수 + `theme.ts` SymbolKey 유니온(L183–191)과 심볼 맵(L347+)에 `"tab.identity"` 추가
   (ASCII 폴백 맵 존재 시 함께). string+ui 선례는 `hindsight.bankId`(L1358) — L243 앵커 오류 정정
2. **M1 보강 — JSON 스키마 재생성**: `bun scripts/generate-json-schemas.ts` → `schemas/config.schema.json` 갱신,
   `check:schemas` 통과 필수 (검증 항목에 추가)
3. **M2 보강 — settings는 throwing Proxy** (settings.ts:946 "Settings not initialized" throw):
   `renderIdentityBlock()`은 try/catch 가드 — 미초기화(SDK/임베딩 경로) 시 null 반환 = 블록 생략 = diff 0 유지
4. **M3 확정 — 제출 API**: `AgentSession.prompt(text, options)` (agent-session.ts:4532, PromptOptions L430) —
   `/identity-auto`는 `runtime.session.prompt(인스트럭션)` 사용
5. **M4 보강 — 테스트 패턴**: `toMatchSnapshot` 선례 없음 → `toContain`/문자열 고정 assertion
   (선례: test/system-prompt-templates.test.ts, system-prompt-dedup.test.ts의 diff 0 패턴). `Settings.init(options)`(settings.ts:241) 격리

## 구현 결과 (260612 04:2x — B/C 완료, 커밋 59043f7)

| # | 검증 | 결과 |
|---|------|------|
| 1 | `bun test .../system-prompt-identity.test.ts` | 5 pass / 0 fail (17 expects) ✅ |
| 2 | **diff 0 불변식**: 미설정→설정→해제 시 바이트 동일 복원 | GREEN ✅ |
| 3 | 인접 무회귀: system-prompt-dedup + templates | 19 pass / 0 fail ✅ |
| 4 | `bun run check:ts` 전체 체인 (schemas 재생성 포함) | exit 0 ✅ |
| 5 | `jwc --version` / `gjc --version` 스모크 | jwc/0.4.4 · gjc/0.4.4 ✅ |
| 6 | `getPathsForTab("identity")` | name/emoji/vibe/language 4필드 ✅ |

변경 파일: settings-schema.ts(탭+TAB_METADATA+4필드), theme.ts(tab.identity 심볼 3맵),
system-prompt.ts(renderIdentityBlock + 합성, throwing Proxy 가드), builtin-registry.ts(/identity,
/identity-auto — session.prompt 사용), test/system-prompt-identity.test.ts(신규), schemas/config.schema.json(재생성).
플랜 대비 변경: SETTING_TABS에서 identity를 **마지막**에 배치 (appearance 앞 배치 시 기본 선택 탭이 바뀌는 UX 회귀 회피).
