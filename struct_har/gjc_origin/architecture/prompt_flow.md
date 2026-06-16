# architecture / prompt_flow (gjc_origin)

> **스냅샷 (2026-06-13)**: patched SoT는 [`structure/20_prompt_flow.md`](../../../structure/20_prompt_flow.md).
> fork `d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5` · gjc clone `269387babcbf02e33613032bc8e41ea395aa10ec`.

## structure/ 발췌 (첫 12줄)

```markdown
# Prompt Flow

> 현재 jwc 프롬프트는 `system-prompt.md` 템플릿 + `SYSTEM.md` customization + project context + tools + skills + memory append instructions로 조립된다.

## 전체 흐름

```text
createAgentSession()
  -> rebuildSystemPrompt(toolNames, tools)
     -> resolveMemoryBackend(...).buildDeveloperInstructions(...)
     -> buildSystemPromptInternal(...)
        -> loadSystemPromptFiles(SYSTEM.md)
```

## 대조 메모

| side | 역할 |
|---|---|
| gjc_origin | upstream 클론 시점의 structure 동형 요약 (과거 har_struct) |
| jwc_patched | **structure/** 가 항상 최신 정본 — 본 파일은 인덱스·리베이스 전 훑기용 |

## 부록

- 전수 갱신: `bun struct_har/_scripts/struct-har-regenerate-architecture.ts`

