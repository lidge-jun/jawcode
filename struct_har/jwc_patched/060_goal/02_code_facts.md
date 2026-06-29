# 060_goal — code facts (jwc_patched)
> **worktree**: jawcode @ `da23db8f217637412552c7a7b1e411a180c5ecc8`
> **gjc 대조**: `devlog/_gjc_chase/gajae-code/` @ `f0a8a3eb6e619392af4965273c3cf95c3faf4345`
> MOC: `devlog/_plan/260612_jawcode_fork/060_moc_goal_merge.md`
## 1. patched 앵커 경로

| # | path | status |
|---:|---|---|
| 1 | `packages/coding-agent/src/defaults/jwc/skills/goal/SKILL.md` | present |
| 2 | `packages/coding-agent/src/jwc-runtime/goal-cli.ts` | present |
| 3 | `packages/coding-agent/src/jwc-runtime/goal-engine.ts` | present |
| 4 | `packages/coding-agent/src/commands/goal.ts` | present |

## 2. fork-delta (structure/40_fork-delta.md)

- goal-runtime.ts NEW
- commands/goal.ts NEW

## 3. 검증

```bash
git -C devlog/_gjc_chase/gajae-code rev-parse --short HEAD   # f0a8a3eb6e619392af4965273c3cf95c3faf4345
git rev-parse --short HEAD               # da23db8f217637412552c7a7b1e411a180c5ecc8
diff -u devlog/_gjc_chase/gajae-code/packages/coding-agent/src/defaults/jwc/skills/goal/SKILL.md packages/coding-agent/src/defaults/jwc/skills/goal/SKILL.md | head
```

## 부록

- **struct_har** 전수 갱신: `bun struct_har/_scripts/struct-har-regenerate.ts` (2026-06-13)
- **로드맵**: `devlog/_plan/260612_jawcode_fork/000_roadmap.md`

