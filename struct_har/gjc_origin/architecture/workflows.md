# architecture / workflows (gjc_origin)

> **스냅샷 (2026-06-13)**: patched SoT는 [`structure/21_extensibility.md`](../../../structure/21_extensibility.md).
> fork `d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5` · gjc clone `269387babcbf02e33613032bc8e41ea395aa10ec`.

## structure/ 발췌 (첫 12줄)

```markdown
# Extensibility

> 확장 표면은 capability API가 중심이다. jaw brand(`jwc`)에서는 `~/.cli-jaw/skills` global root가 native user root를 대체하고, D5의 project-level 우선순위는 아직 미완이다.

## Capability / Source Path

| 항목 | 현재 구조 | 근거 |
|---|---|---|
| native source paths | native user base는 `getConfigDirName()`, project dir는 `.jwc`. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/helpers.ts:28`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/helpers.ts:36` |
| other provider paths | claude/codex/gemini/opencode/cursor 등 source path도 정의되어 있다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/helpers.ts:38`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/helpers.ts:43`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/helpers.ts:53` |
| source metadata | provider/path/level을 `SourceMeta`로 만든다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/helpers.ts:106` |

```

## 대조 메모

| side | 역할 |
|---|---|
| gjc_origin | upstream 클론 시점의 structure 동형 요약 (과거 har_struct) |
| jwc_patched | **structure/** 가 항상 최신 정본 — 본 파일은 인덱스·리베이스 전 훑기용 |

## 부록

- 전수 갱신: `bun struct_har/_scripts/struct-har-regenerate-architecture.ts`

