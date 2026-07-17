# 020_omp_D18_tui_sixel_subagent_misc

> Range: `7aa1d581c..b0d04e517` (subset)
> Cluster: D18 — TUI SIXEL/subagent/operator misc
> Sol priority: P3
> Model-related: no
> Card target: 20.060_tui_sixel_subagent_misc
> Worker: OW5

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `71d269823` | SIXEL encode 높이를 6의 배수로 내리고 비율에 맞춰 폭 조정 | TUI terminal capabilities/image tests |
| 2 | `c46089681` | tmux 안에서 OSC 99 capability probe 억제 | TUI terminal/notification tests |
| 3 | `e6e7119f3` | subagent progress·retry·yield 출력의 제어문자 정리 | task renderer |
| 4 | `949ccaa24` | text/tool이 섞인 assistant segment의 원래 순서 보존 | chat transcript/event controller |
| 5 | `31c9f4850` | tool output에 빈 image placeholder가 들어가지 않게 방지 | OpenAI shared response conversion |
| 6 | `1626799f3` | CJK-aware word navigation에서 underscore를 word로 분류 | TUI Unicode word navigation |
| 7 | `4cfec9345` | 장기 실행 service용 daemon-backed launch tool 도입 | coding-agent launch/bash integration |
| 8 | `f83e40921` | launch/daemon tool 사용 여부 설정 추가 | settings, tool registry, bash |
| 9 | `4c1c5f40d` | daemon terminal byte stream에서 launch log 렌더링 | launch RPC/rendering |
| 10 | `3876f60d6` | self-update를 npm 경유로 실행 | coding-agent update CLI |
| 11 | `d670dd5d9` | 잘못된 `--max-time` 값을 간결한 usage error로 보고 | CLI args/usage errors |
| 12 | `6fab752eb` | `--max-time` duration suffix 파싱 | launch CLI flags |
| 13 | `f98ef2e1e` | Cursor max-mode discovery cache 무효화 | catalog Cursor discovery |
| 14 | `358811115` | Cursor max-mode flag 전달·보존 | Cursor provider/catalog |
| 15 | `ba7bcf4cd` | 코드 심볼 내부 magic keyword 오탐 방지 | magic-keyword boundary |
| 16 | `e7c678dbe` | 구두점이 붙은 magic keyword 허용 | prompting/workflow keyword parser |
| 17 | `63adfeece` | pinned git source를 plugin install에서 교체 가능하게 수정 | plugin manager |
| 18 | `449310eb1` | startup changelog의 현재 버전 판정 유지 | changelog utility |
| 19 | `f53411295` | startup changelog 렌더링 양 제한 | main/command controller/changelog utility |

## 주제 분석

이 클러스터는 하나의 큰 기능보다 운영 중 자주 만나는 작은 정확성 문제를 모은다. SIXEL은 protocol 단위에 맞는 높이와 aspect ratio가 중요하고, OSC 99는 tmux 안에서 잘못 probe하면 알림 협상이 흔들린다. subagent 출력과 mixed assistant segment는 제어문자 제거와 원래 순서 보존이 함께 지켜져야 한다.

나머지는 CLI 운영성이다. daemon-backed launch, npm self-update, duration suffix, Cursor max-mode, magic keyword 경계, pinned git plugin, startup changelog가 각각 독립적인 사용자 실패 지점을 줄인다. 기준 커밋 이전에 존재하는 CJK `grapheme_width`·editor CRLF 보정은 이 범위의 신규 커밋으로 다시 세지 않고 baseline 대조 항목으로 남긴다.

## Worktree 대조

현재 JWC에는 `packages/tui/src/terminal-capabilities.ts`, `packages/tui/src/components/image.ts`, `packages/tui/src/components/editor.ts`가 있고 모두 현재 변경과 맞닿아 있다. SIXEL·OSC·segment ordering은 기존 TUI 시각 계약을 보존하면서 선택적으로 대조해야 한다.

JWC는 launch보다 자체 session/notification 운영 계층이 더 강하다. daemon 기능은 통째로 가져오기보다 기존 장기 작업·tmux 흐름에서 부족한 설정과 로그 계약만 추출하는 편이 맞다. Cursor max-mode와 startup changelog는 provider/catalog 및 배포 버전 체계가 OMP와 다르므로 직접 cherry-pick 대상이 아니다.

## 누락 커밋 보완 (2026-07-17)

범위 전체와 기존 분류 파일의 정확한 해시 차집합에서 확인한 누락 커밋을 추가한다.

| # | hash | git one-line summary | classification |
|---|---|---|---|
| 1 | `0828c53ca` | feat(coding-agent): integrated liveness monitoring into irc wait operations | TUI/subagent/operator misc |
| 2 | `12c693a85` | fix(tools): preferred active image provider with fallback | TUI/subagent/operator misc |
| 3 | `1b0b18c7a` | fix(stats): handled malformed session entries to prevent sync crashes | TUI/subagent/operator misc |
| 4 | `3a75368b9` | fix(images): preserve replay and transcript invariants | TUI/subagent/operator misc |
| 5 | `56fb4c014` | fix(tools): recover from active OpenAI image HTTP failure | TUI/subagent/operator misc |
| 6 | `5878ed8f4` | fix(tools): gate generate_image behind setting and tool whitelist | TUI/subagent/operator misc |
| 7 | `748b2dff1` | fix(tools): allowed opaque codex image keys | TUI/subagent/operator misc |
| 8 | `a29627142` | fix(natives): verify disk before stale-process diagnosis | TUI/subagent/operator misc |
| 9 | `b6b947bdb` | fix(openai): rendered native response images | TUI/subagent/operator misc |
| 10 | `cc2041ab7` | fix(utils): bounded mermaid ascii pathfinder | TUI/subagent/operator misc |
| 11 | `e4a10450e` | fix(natives): distinguish process-stale from disk-stale sentinel mismatch | TUI/subagent/operator misc |
| 12 | `f9cc18c45` | fix(tools): skip incompatible image providers | TUI/subagent/operator misc |
