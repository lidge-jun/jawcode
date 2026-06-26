# 050_plan — code facts (jwc_patched)
> **worktree**: jawcode @ `da23db8f217637412552c7a7b1e411a180c5ecc8`
> **gjc 대조**: `devlog/_gjc_chase/gajae-code/` @ `f0a8a3eb6e619392af4965273c3cf95c3faf4345`
> MOC: `devlog/_plan/260612_jawcode_fork/050_moc_plan_pabcd.md`
## 1. patched 앵커 경로

| # | path | status |
|---:|---|---|
| 1 | `packages/coding-agent/src/defaults/jwc/skills/plan/SKILL.md` | present |
| 2 | `packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts` | present |
| 3 | `packages/coding-agent/src/prompts/jaw/orchestrate-d.md` | present |
| 4 | `packages/coding-agent/src/commands/orchestrate.ts` | present |

## 2. fork-delta (structure/40_fork-delta.md)

- orchestrate-runtime NEW
- prompts/jaw/orchestrate-* NEW

## 3. 검증

```bash
git -C devlog/_gjc_chase/gajae-code rev-parse --short HEAD   # f0a8a3eb6e619392af4965273c3cf95c3faf4345
git rev-parse --short HEAD               # da23db8f217637412552c7a7b1e411a180c5ecc8
diff -u devlog/_gjc_chase/gajae-code/packages/coding-agent/src/defaults/jwc/skills/plan/SKILL.md packages/coding-agent/src/defaults/jwc/skills/plan/SKILL.md | head
```

## 부록

- **struct_har** 전수 갱신: `bun struct_har/_scripts/struct-har-regenerate.ts` (2026-06-13)
- **로드맵**: `devlog/_plan/260612_jawcode_fork/000_roadmap.md`

