# External Integrations Matrix

This page is the JWC-facing index for external integration surfaces. It summarizes current shipped behavior and links to the detailed contract docs. It is intentionally conservative: an upstream GJC document is not a JWC feature claim until the JWC implementation and tests exist.

## Current status

| Surface | JWC status | Source of truth | Notes |
| --- | --- | --- | --- |
| Telegram notifications | Shipped operator runtime | `docs/notifications-sdk.md`, `docs/telegram-onboarding.md`, `docs/bot-integration.md` | JWC ships the local notification SDK, managed daemon logic, private-chat verification, threaded topics, remote answers, lifecycle commands, and connection-gated `telegram_send`. A live bot still requires an operator token and running daemon. |
| Discord and Slack notification adapters | Deferred, not shipped | `docs/notifications-sdk.md`, `docs/bot-integration.md` | Do not document these as supported adapters until a user-requested implementation lands. |
| Bridge mode | Experimental, fail-closed by default | `docs/bridge.md`, `docs/rpc.md` | HTTPS and bearer token are required. Session events, commands, controller ownership, UI responses, host tool results, and host URI results are disabled unless explicitly re-enabled by a future release. |
| Hermes coordinator MCP bridge | Shipped outward bridge, fail-closed by default | `docs/hermes-mcp-bridge.md`, `docs/environment-variables.md` | `jwc mcp-serve coordinator` and `jwc setup hermes` are the JWC surface. Mutations require startup opt-in plus per-call consent. |
| Grok Build provider | Design-only, owner decision required | `docs/grok-build-provider-design.md` | No bundled provider implementation ships from this card. Authorized use, bundled loading, selector naming, and trademark/display-name remain owner gates. |
| CodeGraph custom tool notes from upstream | Not shipped in JWC docs | this page | JWC should not claim a CodeGraph integration until a JWC-owned contract and tests exist. |
| Standalone MCP registration notes from upstream | Not shipped as a JWC product doc | this page | Current JWC MCP product surface is the coordinator bridge above. Do not imply a separate standalone MCP registration command unless implemented and tested. |
| OpenClaw / Gajae Remote upstream notes | Translated into JWC bridge/coordinator boundaries only | `docs/bridge.md`, `docs/hermes-mcp-bridge.md` | JWC is an external runner for other orchestrators; it is not embedded runtime injection into Hermes, Claw Code, OpenClaw, or another coding tool. |

## Documentation rules

- Product-facing examples use `jwc`, `.jwc`, and `@jawcode-dev/*`.
- Upstream names such as GJC, Gajae Remote, OpenClaw, CodeGraph, Discord, or Slack may appear only as cited source facts, deferred items, or explicit non-shipped boundaries.
- Docs must use placeholder secrets such as `<bot-token>` and `<chat-id>`.
- New integration docs should add a focused docs regression test before being linked from this matrix.
