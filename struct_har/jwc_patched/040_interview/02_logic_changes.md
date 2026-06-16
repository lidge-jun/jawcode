# 040_interview — 02 logic changes (jwc_patched)

> worktree @ `d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5` · gjc @ `269387ba`.

## 런타임·표면

- **슬러그·번들**: `deep-interview` → **`jaw-interview`** — `defaults/jwc/skills/jaw-interview/SKILL.md`, `jwc-defaults.ts` embedded default.
- **IPABCD I-stage**: 시스템 프롬프트·`orchestrate i`가 jaw-interview 엔진을 요구사항 수집 전용으로 라우팅; 산출 `.jwc/specs/jaw-interview-<slug>.md` (P 진입은 spec **선택**).
- **mutation guard (INVERTED-GUARD)**: interview 활성 중 product source·`.jwc/` 비스펙 쓰기 및 **jwc CLI** 일부를 차단 — `skill-state/jaw-interview-mutation-guard.ts`.
- **구조화 ask**: structured ask + `structured-renderer` (D041); 라운드별 ambiguity·dimensions HUD 필드.
- **설정**: `jwc.interview.*`; read-compat로 legacy `deep-interview` 슬러그 인식 유지.

## upstream 대비

| 항목 | gjc | jwc |
|------|-----|-----|
| skill name | deep-interview | jaw-interview |
| public `/skill:` | — | `/skill:jaw-interview` |
| orchestrate I | — | `jwc orchestrate i` + `orchestrate-i.md` |

## 코드 앵커

| path:line | 역할 |
|-----------|------|
| `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/defaults/jwc-defaults.ts:17` | default slug |
| `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md:1` | I-stage SKILL |
| `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/skill-state/jaw-interview-mutation-guard.ts:1` | INVERTED-GUARD |
| `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/prompts/jaw/orchestrate-i.md:16` | I→P shell 전이 |

## 커밋 (대표)

`eb4273c2`, `1be32975`, `8ced9eb2`, `063114c9`, `c7c748ec`

## 정본

- [structure/21_extensibility.md](../../../structure/21_extensibility.md)
- [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)