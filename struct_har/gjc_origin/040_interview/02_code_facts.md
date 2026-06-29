# 040_interview — code facts (gjc_origin)
> **upstream 클론**: `devlog/_gjc_chase/gajae-code/` @ `f0a8a3eb6e619392af4965273c3cf95c3faf4345`
> MOC: `devlog/_plan/260612_jawcode_fork/040_moc_interview_merge.md`
## 1. upstream 앵커 경로

| # | path | status |
|---:|---|---|
| 1 | `packages/coding-agent/src/defaults/gjc/skills/deep-interview/SKILL.md` | present |
| 2 | `packages/coding-agent/src/defaults/gjc-defaults.ts` | present |

## 2. 검증

```bash
git -C devlog/_gjc_chase/gajae-code rev-parse --short HEAD   # f0a8a3eb6e619392af4965273c3cf95c3faf4345
git rev-parse --short HEAD               # da23db8f217637412552c7a7b1e411a180c5ecc8
diff -u devlog/_gjc_chase/gajae-code/packages/coding-agent/src/defaults/gjc/skills/deep-interview/SKILL.md packages/coding-agent/src/defaults/gjc/skills/deep-interview/SKILL.md | head
```

## 부록

- **struct_har** 전수 갱신: `bun struct_har/_scripts/struct-har-regenerate.ts` (2026-06-13)
- **로드맵**: `devlog/_plan/260612_jawcode_fork/000_roadmap.md`

