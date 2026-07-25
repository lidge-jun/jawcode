# 040 — wp3 cycle 2: card 20.109 tool/platform runtime hardening (import 20/37)

## Stale check (P, 2026-07-25)

Full 37-anchor survey by sol surveyor (Laplace), each verified against the actual upstream diff and the current JWC tree (`5aba3c7`):

| class | count | handling |
|---|---|---|
| import (pre-fix defect present in JWC, path:line evidence) | 20 | implement this cycle |
| already-fixed | 3 (`9d5f158e2`, `9c44ad185`, `e23359fd1`) | no-op, record |
| no-surface (JWC lacks the whole feature: pi-walker, direnv, vibe, TTS, live, xdev, mupdf-external-removal… wait: mupdf IS import) | 13 | residual, record |
| na-test-only | 1 (`009f3ec58` rustfmt) | no-op, record |

## Implement slices (dependency-ordered, 3 parallel worker packets with disjoint write sets)

> **A-audit amendments (041 synthesis):** (1) `6d7457663`+`09d02c641` approval-rules slice DEScoped — upstream presumes a tool-owned dynamic approval declaration abstraction JWC lacks; porting is a C4 security-boundary redesign requiring its own unit (AgentSession permission bridge, pattern matcher, precedence tests through the real public permission path). (2) `5a1f227a6` memory-backend lifecycle DEScoped — JWC backend contract (start/clear/enqueue only, fire-and-forget local startup) diverges enough that this is a JWC-native lifecycle redesign, not a port; needs its own approved design unit. (3) `d1f279971` corrected: `read.renderMarkdown` defaults **false** and applies ONLY to local `.md` tagging; protocol-supplied `contentType: text/markdown` (internal URLs) keeps rendering regardless — exactly the upstream `9d5f158e2` contract and JWC's current visible behavior. (4) Packets are disjoint after descope: T1 owns settings-schema.ts (only T1 needs it), T2 runtime files, T3 build-binary/settings/executor; **no worker touches CHANGELOG.md** — main integrates it once. (5) activation scenarios corrected (DAP: exported transport helper + nonexistent path + short timeout; settings: save-spy + debounce timer control, "discard" = resetSettingsForTest/test-reset semantics unless a production disposal API is added). (6) mupdf gate upgraded to full binary build + isolated smoke.

### Packet T1 — tools safety (8 commits)

| commit | change | JWC owner |
|---|---|---|
| ~~`6d7457663` + `09d02c641`~~ | **DEScoped → residual (C4 security redesign unit)** | — |
| `70e92d32a` + `418076e44` | expand internal URLs inside backtick substitutions; escaped quotes inside double-quoted backticks are inner quoting | `tools/bash-skill-urls.ts` (+tests) |
| `c232c3af7` | reject local read-selector-shaped write targets | `tools/write.ts`, `tools/path-utils.ts` (+test) |
| `662e4392d` + `cf886d8d8` | shared relative/workspace path resolution in edit; reuse resolved target across apply_patch hunks for the same authored path | `edit/index.ts`, `tools/path-utils.ts` (+tests) |
| `d1f279971` | opt-in Markdown read previews — **`read.renderMarkdown` default false, local `.md` tagging only; internal-URL protocol-supplied markdown keeps rendering.** Tests pin 4 cases: local default-off, local opt-in, internal URL default-on, `:raw` bypass. | `tools/read.ts`, `config/settings-schema.ts` (+tests) |
| `7877df00e` | content-aware PDF image cache (source digest invalidation on same-path replacement) | `tools/read.ts` (+test) |

### Packet T2 — runtime (7 commits)

| commit | change | JWC owner |
|---|---|---|
| `1778ab93b` + `4e78d1242` | bound interactive bash live display write queue; compact consumed prefix + parser resync under sustained backlog | `tools/bash-interactive.ts` (+tests) |
| `d866532bd` + `eeb3fa6ac` | format-on-write latency (parallel diagnostics capture, active-client-only LSP); propagate cancellation from LSP reload instead of false restart | `lsp/client.ts`, `lsp/index.ts` (+tests) |
| `d4b1fd510` | bound browser open timeout + lease browser across tab acquisition | `tools/browser.ts`, `tools/browser/tab-supervisor.ts` (+test) |
| `3b194a3e3` | reject and bound the DAP unix socket connect on Linux | `dap/client.ts` (+test) |
| `6a98c4eb2` | reset cursor-key and keypad mode on terminal teardown | `packages/tui/src/terminal.ts` (+test) |

### Packet T3 — foundations (5 commits)

| commit | change | JWC owner |
|---|---|---|
| `6b6e39ff6` | bundle mupdf in compiled CLI (drop `--external mupdf`) — gate: full binary build + isolated smoke | `packages/coding-agent/scripts/build-binary.ts` |
| `fcf2274b2` | cancel pending saves on discarded settings instances (test via save-spy + debounce control) | `config/settings.ts` (+test) |
| `03489d1eb` | coalesce python kernel replacement (shared replacement promise/generation) | `eval/py/executor.ts` (+test) |
| ~~`5a1f227a6`~~ | **DEScoped → residual (JWC-native memory lifecycle redesign unit)** | — |

## Out of scope / residual

- 13 no-surface commits (direnv family, vibe sessions, TTS family, Codex Live, xdev family, pi-walker): recorded in card residual — JWC feature absent, no chase action.
- 3 already-fixed + 1 rustfmt: no-op.
- `6d7457663` + `09d02c641` (per-command bash approval + bypass closure): needs a C4 security design unit — JWC lacks the tool-owned approval declaration abstraction; AgentSession permission bridge must be designed first.
- `5a1f227a6` (memory backend lifecycle): needs a JWC-native lifecycle design unit — backend contract has no stop/dispose, local startup is fire-and-forget.

## Accept criteria

- A1: each ported behavior has a focused test pinning the NEW contract (e.g. bash approval deny precedence, queue cap eviction, DAP connect timeout rejection, settings discard cancels save, kernel replacement coalescing single-flight).
- A2: `bun run check:ts` green; affected package tests green; `git diff --check` clean.
- A3: mupdf slice validated by a FULL compiled binary build; run the binary in an isolated directory WITHOUT node_modules and smoke a PDF read/convert; record before/after binary size + startup smoke.
- A4: card 20.109 updated post-B: implemented/already-fixed/no-surface dispositions + residual list.
- Activation scenarios: bash approval bypass test issues a raw shell-control command that must hit deny/prompt; DAP test connects to a nonexistent unix socket and asserts bounded rejection; settings test discards an instance mid-debounce and asserts no write; kernel test fires concurrent replacements and asserts one shutdown/start.
