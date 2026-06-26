# 010_shell — code facts (jwc_patched)
> **worktree**: jawcode @ `da23db8f217637412552c7a7b1e411a180c5ecc8`
> **gjc 대조**: `devlog/_gjc_chase/gajae-code/` @ `f0a8a3eb6e619392af4965273c3cf95c3faf4345`
> MOC: `devlog/_plan/260612_jawcode_fork/010_moc_shell_rename.md`
## 1. patched 앵커 경로

| # | path | status |
|---:|---|---|
| 1 | `packages/jwc/package.json` | present |
| 2 | `packages/jwc/bin/jwc.js` | present |
| 3 | `packages/jwc/src/sdk.ts` | present |
| 4 | `scripts/rebrand-inventory.ts` | present |

## 2. fork-delta (structure/40_fork-delta.md)

- packages/jwc/** NEW
- gjc bin REMOVED (085.5-M7)

## 3. 검증

```bash
git -C devlog/_gjc_chase/gajae-code rev-parse --short HEAD   # f0a8a3eb6e619392af4965273c3cf95c3faf4345
git rev-parse --short HEAD               # da23db8f217637412552c7a7b1e411a180c5ecc8
diff -u devlog/_gjc_chase/gajae-code/packages/jwc/package.json packages/jwc/package.json | head
```

## 부록

- **struct_har** 전수 갱신: `bun struct_har/_scripts/struct-har-regenerate.ts` (2026-06-13)
- **로드맵**: `devlog/_plan/260612_jawcode_fork/000_roadmap.md`

