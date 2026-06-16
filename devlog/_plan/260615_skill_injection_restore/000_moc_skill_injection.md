# 260615 — Skill Injection Restore

## Problem

`87d8c733` (chore: checkpoint remaining workspace changes) 체크포인트 커밋에서 다수의 스킬 관련 시스템 프롬프트 블록이 의도치 않게 삭제됨. browse/search 스킬은 defaults에 파일만 존재하고 번들 코드 등록이 누락.

## Scope

### M1: browse/search 번들 등록 (`jwc-defaults.ts`)
- browse/search SKILL.md import 추가
- `DEFAULT_JWC_DEFINITION_NAMES` 확장 → 워크플로 4개와 별도 타입
- `DEFAULT_GJC_DEFINITIONS` 배열에 browse/search 엔트리 추가
- `skill-fragments/browse/web-ai.md` 프래그먼트 등록
- 테스트 기대값 업데이트 (`default-jwc-definitions.test.ts`)

### M2: `<dev-skill-routing>` 복원 + cli-jaw 스킬 메타데이터 주입 (`system-prompt.md`)
- `<dev-skill-routing>` 블록 복원 (도메인→스킬 라우팅 테이블)
- `/skill:search`, `/skill:browse` 참조 복원 (`<search-mandate>` 내)
- cli-jaw 스킬 디스커버리 결과를 시스템 프롬프트에 동적 주입하는 템플릿 변수 추가

### M3: cli-jaw 스킬 목록 동적 주입 (`system-prompt.ts`)
- `buildSystemPrompt`에서 loaded skills 중 cli-jaw source 스킬 메타데이터 수집
- 템플릿 변수로 전달하여 `<dev-skill-routing>` 블록에서 동적 렌더링

## Design Decisions

- browse/search는 `hide: true` 유지 → `<skills>` 섹션에는 안 나오지만 `/skill:` 커맨드로 접근 가능
- `DEFAULT_JWC_DEFINITION_NAMES`는 **워크플로 스킬 4개만** 유지 (AGENTS.md 계약). browse/search는 별도 'utility' 카테고리로 번들 배열에만 추가
- dev-skill-routing은 정적 라우팅 테이블 + cli-jaw 스킬 목록 동적 열거 병용

## Affected Files

- `packages/coding-agent/src/defaults/jwc-defaults.ts`
- `packages/coding-agent/src/prompts/system/system-prompt.md`
- `packages/coding-agent/src/system-prompt.ts`
- `packages/coding-agent/test/default-jwc-definitions.test.ts`

## Verification

- `bun test packages/coding-agent/test/default-jwc-definitions.test.ts`
- `bun scripts/check-visible-definitions.ts`
- `bun scripts/verify-g002-gates.ts`
- `bun run check:ts` (타입 체크)
