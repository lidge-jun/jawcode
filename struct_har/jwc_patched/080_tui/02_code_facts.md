# 080_tui — code facts (jwc_patched)
> **worktree**: jawcode @ `d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5`
> **gjc 대조**: `devlog/_upstream_gjc/` @ `269387babcbf02e33613032bc8e41ea395aa10ec`
> MOC: `devlog/_plan/260612_jawcode_fork/080_moc_tui.md`
## 1. patched 앵커 경로

| # | path | status |
|---:|---|---|
| 1 | `packages/tui/` | present |
| 2 | `packages/coding-agent/src/modes/` | present |
| 3 | `packages/coding-agent/src/status-line/` | missing (verify path) |

## 2. fork-delta (structure/40_fork-delta.md)

- TUI jaw branding WIP
- status-line segments 085

## 3. 검증

```bash
git -C devlog/_upstream_gjc rev-parse --short HEAD   # 269387babcbf02e33613032bc8e41ea395aa10ec
git rev-parse --short HEAD               # d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5
diff -u devlog/_upstream_gjc/packages/tui/ packages/tui/ | head
```

## 부록

- **struct_har** 전수 갱신: `bun struct_har/_scripts/struct-har-regenerate.ts` (2026-06-13)
- **로드맵**: `devlog/_plan/260612_jawcode_fork/000_roadmap.md`

