# 030_skills — 02 logic changes (jwc_patched)

> worktree @ `d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5` · gjc @ `269387ba`.

## 런타임·표면

- **번들 4 workflow skill** (삭제 불가): `jaw-interview`, `plan`, `goal`, `team` — `defaults/jwc-defaults.ts` + `defaults/jwc/skills/*/SKILL.md`.
- **디스커버리 계층**: `extensibility/skills.ts` `loadSkills()` — project `.jwc/skills`, agent dir, bundled defaults; `discovery/cli-jaw.ts`가 `~/.cli-jaw/skills` 글로벌 루트를 추가 스캔.
- **브랜딩 치환**: skill 본문·경로에 jaw/jwc 어휘 (`skills.ts` jaw-brand); dev 스킬 문구는 `jwc-runtime/cli-jaw-vocab.ts`.
- **plan/goal/team handoff**: SKILL.md가 `skill` 도구 체인 시 `jwc state <skill> handoff --to …` in-process 동기화를 명시 (`plan/SKILL.md`, `goal/SKILL.md`, `team/SKILL.md`).

## upstream 대비

| 항목 | gjc | jwc |
|------|-----|-----|
| interview slug | `deep-interview` | **`jaw-interview`** |
| P-stage entry | (varies) | **`plan`** → native `jwc orchestrate p` |
| 글로벌 스킬 루트 | — | **`~/.cli-jaw/skills`** (`discovery/cli-jaw.ts`) |

## 코드 앵커

| path | 역할 |
|------|------|
| `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/defaults/jwc-defaults.ts:17` | public default slugs |
| `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/skills.ts:105` | load/discover |
| `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/cli-jaw.ts` | cli-jaw global skills |
| `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/jwc-runtime/cli-jaw-vocab.ts` | dev vocabulary |

## 정본

- [structure/21_extensibility.md](../../../structure/21_extensibility.md)
- [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)