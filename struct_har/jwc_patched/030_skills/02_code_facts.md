# 030_skills — code facts (jwc_patched)
> **worktree**: jawcode @ `d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5`
> **gjc 대조**: `devlog/_upstream_gjc/` @ `269387babcbf02e33613032bc8e41ea395aa10ec`
> MOC: `devlog/_plan/260612_jawcode_fork/030_moc_skills_discovery.md`
## 1. patched 앵커 경로

| # | path | status |
|---:|---|---|
| 1 | `packages/coding-agent/src/defaults/jwc-defaults.ts` | present |
| 2 | `packages/coding-agent/src/extensibility/skills.ts` | present |
| 3 | `packages/coding-agent/src/jwc-runtime/cli-jaw-vocab.ts` | present |

## 2. fork-delta (structure/40_fork-delta.md)

- jaw-interview slug
- cli-jaw-vocab.ts NEW (057)

## 3. 검증

```bash
git -C devlog/_upstream_gjc rev-parse --short HEAD   # 269387babcbf02e33613032bc8e41ea395aa10ec
git rev-parse --short HEAD               # d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5
diff -u devlog/_upstream_gjc/packages/coding-agent/src/defaults/jwc-defaults.ts packages/coding-agent/src/defaults/jwc-defaults.ts | head
```

## 부록

- **struct_har** 전수 갱신: `bun struct_har/_scripts/struct-har-regenerate.ts` (2026-06-13)
- **로드맵**: `devlog/_plan/260612_jawcode_fork/000_roadmap.md`

