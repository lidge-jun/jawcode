# 010_gjc_C06_tui_irc_sidebar_kitty_tmux

> Range: `4a80bac9..3ddf26079` (subset)
> Cluster: C06 — IRC sidebar 70:30, Kitty anchored-wrap, ghost IRC, Korean prose wrapping, sixel probe, graphics suppression, viewport anchors
> Sol priority: P2
> Model-related: no
> Card target: 10.096_tui_irc_sidebar_kitty_tmux
> Worker: GW4

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `decc1a621` | fix(coding-agent): recognize VTE tmux owner scopes (#2166) | `packages/coding-agent/src/gjc-runtime/tmux-owner-isolation.ts`<br>`packages/coding-agent/test/gjc-runtime/tmux-owner-isolation.test.ts` |
| 2 | `3f34d2022` | fix(irc): commit roster claim before flush | `packages/coding-agent/src/session/agent-session.ts`<br>`packages/coding-agent/test/agent-session-irc-ghost-message.test.ts` |
| 3 | `5e5c61883` | fix(coding-agent): identify Windows psmux tmux aliases | `packages/coding-agent/src/defaults/gjc/skills/team/SKILL.md`<br>`packages/coding-agent/src/gjc-runtime/psmux-detect.ts` |
| 4 | `3e6fa6117` | fix(tui): preserve scrollback during live rendering | `packages/coding-agent/src/internal-urls/docs-index.generated.ts`<br>`packages/coding-agent/src/modes/components/custom-editor.ts` |
| 5 | `32ffa1e6f` | fix(coding-agent): recognize VTE tmux owner scopes (#2166) | `packages/coding-agent/src/gjc-runtime/tmux-owner-isolation.ts`<br>`packages/coding-agent/test/gjc-runtime/tmux-owner-isolation.test.ts` |
| 6 | `42f1d4460` | fix(irc): commit roster claim before flush | `packages/coding-agent/src/session/agent-session.ts`<br>`packages/coding-agent/test/agent-session-irc-ghost-message.test.ts` |
| 7 | `3208f7cff` | fix(tui): preserve scrollback during live rendering | `packages/coding-agent/src/internal-urls/docs-index.generated.ts`<br>`packages/coding-agent/src/modes/components/custom-editor.ts` |
| 8 | `03c1d3736` | fix(coding-agent): stop surfacing ghost IRC messages when reply generation fails (#2087) | `packages/coding-agent/src/internal-urls/docs-index.generated.ts`<br>`packages/coding-agent/src/session/agent-session.ts` |
| 9 | `ca81dc52a` | docs(tui): correct stale suppression comment — the probe never runs under multiplexers | `packages/tui/src/terminal-capabilities.ts` |
| 10 | `390b95240` | fix(tui): suppress graphics under multiplexers unconditionally; fix probe semantics and pet restore | `packages/coding-agent/src/modes/interactive-mode.ts`<br>`packages/coding-agent/src/slash-commands/builtin-registry.ts` |
| 11 | `8357a84a8` | fix(tui): stop assuming graphics protocols under tmux/screen and probe sixel instead | `packages/tui/src/terminal-capabilities.ts`<br>`packages/tui/src/tui.ts` |
| 12 | `bbd4e506b` | feat(tui): chat-room IRC sidebar — 70:30 responsive split, Discord-style blocks, default-on (#2018) | `packages/coding-agent/src/config/settings-schema.ts`<br>`packages/coding-agent/src/internal-urls/docs-index.generated.ts` |
| 13 | `cc9b9496b` | fix(tui): stabilize markdown viewport anchors across topology-changing reflow (#2053) | `packages/tui/src/components/markdown.ts`<br>`packages/tui/test/markdown-anchor-reflow.test.ts` |
| 14 | `c0933709d` | fix(coordinator-mcp): recognize tmux ≥3.7 'error connecting to' no-server diagnostic (deterministic delegate failure) (#2060) | `packages/coding-agent/src/commands/harness.ts`<br>`packages/coding-agent/src/coordinator-mcp/server.ts` |
| 15 | `891361a07` | fix(coordinator-mcp): resilient tmux owner-server probe (transient spawn failures no longer abort delegate) (#2059) | `packages/coding-agent/src/coordinator-mcp/server.ts`<br>`packages/coding-agent/test/coordinator-mcp-server.test.ts` |
| 16 | `c32908558` | test(tui): cover Kitty anchored-wrap + persisted IRC-sidebar lifecycle (#2033) (#2039) | `packages/coding-agent/test/interactive-mode-irc-sidebar-lifecycle.test.ts`<br>`packages/tui/src/utils.ts` |
| 17 | `7ab091046` | fix(coding-agent): isolate tmux owner lifecycle (#2004) | `packages/coding-agent/src/cli.ts`<br>`packages/coding-agent/src/commands/harness.ts` |
| 18 | `b1a719d53` | fix(coding-agent): honor persisted irc.sidebar.enabled at startup (#2013) | `packages/coding-agent/src/modes/interactive-mode.ts` |
| 19 | `8f4b55398` | fix(tui): stop Kitty terminals treating anchored prose as image lines (#2012) | `packages/tui/src/utils.ts`<br>`packages/tui/test/viewport-scroll.test.ts` |
| 20 | `ec546f72d` | fix(tui): preserve Korean assistant prose wrapping (#1996) | `packages/coding-agent/test/issue-1979-korean-wrap.test.ts`<br>`packages/tui/src/utils.ts` |
| 21 | `1f36f6806` | fix(tui): preserve completion viewport across transcript rebuilds (#1983) | `packages/coding-agent/src/deep-interview/render-middleware.ts`<br>`packages/coding-agent/src/modes/components/assistant-message.ts` |

## 주제 분석

이 묶음은 TUI의 협업 메시지를 별도 IRC sidebar로 시각화하고, 좁은 화면에서는 70:30 split이 무너지지 않도록 반응형 레이아웃을 정의한다. reply 생성 실패 시 ghost IRC 메시지를 남기지 않고, roster claim과 flush 순서를 고정하며, sidebar enable 상태를 시작 시 복원한다.

동시에 Kitty의 anchored prose, Korean line wrapping, transcript rebuild viewport, live rendering scrollback을 보존한다. tmux/screen에서는 graphics protocol을 추정하지 않고 sixel을 실제 probe하며, 멀티플렉서 아래 graphics를 억제한다. JWC의 현재 scroll 모델은 사용자 조정이 많이 들어간 영역이므로 upstream 코드를 통째로 덮지 말고 결함 단위로 대조해야 한다.

## Worktree 대조

JWC에는 `packages/coding-agent/src/tools/irc.ts`와 IRC prompt가 있고, `packages/tui/src/tui.ts`에는 SIXEL probe와 multiplexer-aware viewport/scrollback 경로가 이미 있다. `packages/tui/src/terminal-capabilities.ts`도 tmux/screen 그래픽 제약을 처리한다. 반면 `irc.sidebar`나 chat-room sidebar 구현은 검색되지 않는다. 포팅 시 `structure/31_scroll.md`의 현행 scrollback 불변식과 사용자 보존 규칙을 우선해야 한다.

