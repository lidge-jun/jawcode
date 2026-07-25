# 10 — pull delta evidence

Date: 2026-07-03

## Before

| Clone | Before HEAD |
|---|---|
| GJC `devlog/_gjc_chase/gajae-code` | `79b42377db34a3b1de847119e99e2b77c797ff8c` |
| OMP `devlog/_omp_chase/oh-my-pi` | `0ea6ea630bf8ff67ffa191d92c1ee04052b30288` |
| JWC root worktree | `89371141df169d667da2c98ab698bfc1186513d7` |

## Commands run

```bash
git -C devlog/_gjc_chase/gajae-code fetch upstream dev
git -C devlog/_gjc_chase/gajae-code pull --ff-only upstream dev
git -C devlog/_omp_chase/oh-my-pi fetch origin main
git -C devlog/_omp_chase/oh-my-pi pull --ff-only origin main
```

## After

| Clone | After HEAD | Range | Commit count |
|---|---|---|---:|
| GJC | `db7938e1f81477cda8823269f0ca392be91f538b` | `79b42377..db7938e1` | 34 |
| OMP | `d0c1890a6c0809507d534840f0e31a6b31a76619` | `0ea6ea630..d0c1890a6` | 216 |

## GJC commit cluster evidence

Representative commits from `79b42377..db7938e1`:

- `cc5e4937` workflow intent routing.
- `77bbca23` ralplan decision artifacts.
- `28887239` deep-interview blank gate rejection.
- `171e8dc7` stamped state envelopes.
- `1a7cc54e` web_search timeout/hedging/prewarm.
- `f9019e06` glob exclude precompile.
- `57559d50` compact unit rounding.
- `044f14da` UTF-8 BOM preserve in edit replace mode.
- `1db3c9f5`, `2713165b`, `08c6e59a` model selector / command UX.
- `2595426a`, `10964b08`, `477a1d58`, `f831abf9`, `e4a9f2ae` tmux/coordinator UX.
- `c960eec8`, `b55284c2`, `ebbf03c5` session close / Telegram recent / Python RPC protocol.

## OMP commit cluster evidence

Representative commits from `0ea6ea630..d0c1890a6`:

- `4c18cc1a1`, `a81e532c2`, `a17ec8147`, `d064563c5` AI catalog/auth/usage.
- `234a46fa3`, `01ab7e26`, `326a3406a`, `69db80fbe`, `0d23cb75c` session/async/plan integrity.
- `0059aed4f`, `367a002e4`, `2c8daf057`, `a76a33476`, `ecbf0760c` hashline/tool/plugin/task safety.
- `30527aee0`, `49b4ef50f`, `fb2804247`, `603791283`, `e04316dc5` TUI/terminal/render resilience.
- `16600e89a`, `dfaa41f6b`, `22e9224ae`, `2335c717a`, `8c648e4d0` robomp/ISO/release/update references.

## Root worktree preservation

The root repo already had unrelated dirty files before this task. This refresh intentionally adds/updates only chase documentation/evidence files and fast-forwards the two gitignored chase clones.
