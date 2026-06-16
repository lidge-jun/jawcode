# 040_interview — code facts (jwc_patched)
> **worktree**: jawcode @ `d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5`
> **gjc 대조**: `devlog/_upstream_gjc/` @ `269387babcbf02e33613032bc8e41ea395aa10ec`
> MOC: `devlog/_plan/260612_jawcode_fork/040_moc_interview_merge.md`
## 1. patched 앵커 경로

| # | path | status |
|---:|---|---|
| 1 | `packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md` | present |
| 2 | `packages/coding-agent/src/defaults/jwc-defaults.ts` | present |
| 3 | `packages/coding-agent/src/skill-state/jaw-interview-mutation-guard.ts` | present |

## 2. fork-delta (structure/40_fork-delta.md)

- deep-interview → jaw-interview HARD-EDIT
- mutation-guard INVERTED-GUARD

## 3. 검증

```bash
git -C devlog/_upstream_gjc rev-parse --short HEAD   # 269387babcbf02e33613032bc8e41ea395aa10ec
git rev-parse --short HEAD               # d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5
diff -u devlog/_upstream_gjc/packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md | head
```

## 부록

- **struct_har** 전수 갱신: `bun struct_har/_scripts/struct-har-regenerate.ts` (2026-06-13)
- **로드맵**: `devlog/_plan/260612_jawcode_fork/000_roadmap.md`

