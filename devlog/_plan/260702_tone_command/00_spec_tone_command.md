# Spec — `/tone` slash command (persona tone presets + custom)

## Goal

Add a `/tone` slash command to the jwc coding-agent that injects a selectable persona tone into the system prompt identity block, parametrizing the SOUL-style flavor as a user dial. Presets plus a paste-your-own `custom` lane.

## Surface

`/tone <subcommand>` with subcommand autocomplete (pattern: `/effort` in `builtin-registry.ts`):

| subcommand | meaning |
|---|---|
| `sarcastic` | 비꼬는 맛 — 정확하지만 한 마디씩 얹는 빈정거림 |
| `savage` | gajae SOUL급 매운맛 — 욕설 허용, 뼈 때리기 |
| `deadpan` | 건조 극단 — 감탄사·이모지 0, 팩트만 |
| `hype` | 텐션 최대 — 과몰입 응원형 |
| `uhehe` | 어흐흐 — 변태적 미소녀 톤 (능글+과몰입, 코드에 집착하는 미소녀 말투) |
| `custom` | 사용자 문안 — 아래 custom UX 참조 |
| `off` | 프리셋 제거, 기본 Jaw 프롬프트 복귀 |
| `status` | 현재 tone 표시 |

## Custom UX (both lanes)

- `/tone custom <text>` — inline args가 있으면 즉시 `identity.toneCustom`에 저장하고 `identity.tone=custom` 전환.
- `/tone custom` (args 없음) — `/identity-auto` 패턴으로 에이전트가 "문안을 붙여넣어 주세요" 프롬프트를 발사, 답을 받아 `jwc config set identity.toneCustom "<text>"` + `identity.tone=custom`으로 영속.

## Persistence

- `identity.tone` (string enum: sarcastic|savage|deadpan|hype|uhehe|custom, default undefined) — config.yml 전역 영속.
- `identity.toneCustom` (string, default undefined) — custom 문안 본문.
- 세션 한정 아님. `/tone off`는 `identity.tone`을 unset.

## Injection

- `renderIdentityBlock()` (`packages/coding-agent/src/system-prompt.ts:304`)가 `identity.tone`을 읽어 프리셋 본문(정적 .md)을 `## Tone` 섹션으로 주입.
- `identity.vibe`(자유 커스텀)와 공존: tone=프리셋 섹션, vibe=기존 사용자 라인. 둘 다 있으면 둘 다 렌더.
- tone만 설정돼도 identity 블록이 렌더되도록 null-gate(`if (!name && !emoji && !vibe && !language)`) 확장.
- 적용 시점: 다음 프롬프트 빌드부터 (기존 identity 블록과 동일).

## Files

1. `packages/coding-agent/src/prompts/identity/tone-{sarcastic,savage,deadpan,hype,uhehe}.md` — NEW, `with { type: "text" }` import (AGENTS.md 프롬프트 규칙).
2. `packages/coding-agent/src/config/settings-schema.ts` — `identity.tone`, `identity.toneCustom` 키 (identity 탭).
3. `packages/coding-agent/src/system-prompt.ts` — `renderIdentityBlock()`에 tone 매핑 + `## Tone` 섹션.
4. `packages/coding-agent/src/slash-commands/builtin-registry.ts` — `/tone` 스펙 (handle + handleTui, status/off/프리셋/custom, `refreshStatusLine`).
5. `/identity` 출력에 `identity.tone` 행 추가 (보조).

## Preset copy direction

- 본문은 영문 우선 + 한국어 뉘앙스 병기 허용; 응답 언어는 `identity.language`/사용자 언어 미러링 규칙에 따름.
- `uhehe`: 변태적 미소녀 — 능글맞은 과몰입, "어흐흐" 웃음, 코드/사용자에 대한 집착적 애정 표현. 업무 정확성 유지 조항 필수(톤은 바뀌어도 코드 품질 규율은 불변).
- `savage`: SOUL 무제한 선언 계보 내에서 최대 수위.
- 모든 프리셋 공통 꼬리 조항: tone은 문체만 바꾸고 completion-contract/정확성 규율은 유지.

## Acceptance

1. `bun test packages/coding-agent/test/system-prompt-identity.test.ts` — tone 렌더 케이스(프리셋/custom/off/vibe 공존) green.
2. `/tone sarcastic` 후 `/identity` 또는 `/tone status`로 설정 확인; 새 프롬프트에 `## Tone` 섹션 주입 확인.
3. `/tone custom <text>` 인라인 저장 + `/tone custom` 무인자 프롬프트 랜딩 확인.
4. 기본 동작 무변: identity.* 전부 unset이면 블록 null (기존 fail-safe 유지).

## Non-goals

- TUI 전용 셀렉터 오버레이(효과 대비 비용 큼 — subcommand 자동완성으로 충분).
- 세션별 tone 오버라이드.
- 기존 SOUL 블록 제거/개편 (별도 결정).
