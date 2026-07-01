# 70_phase7_10052_docs_external_integrations

## PABCD phase

- Card: `10.052_gjc_chase_docs_external_integrations`
- Classification: C2 docs-plus-regression clean-follow closure.
- Source anchors: GJC `a791d72a` docs/external integration cluster, especially `fff4c292`, `70266665`, `56865418`, `7775c454`, `95ee49a6`, `ddf50634`, `53acb5df`, and `4a972aa7`.
- JWC posture: docs-only/product-contract closure. Do not implement Grok Build, Gajae Remote, CodeGraph, OpenClaw, standalone MCP, Discord, or Slack. Document only current JWC surfaces and explicitly mark upstream-only or owner-decision-gated surfaces.

## Research notes

- Existing JWC docs already cover:
  - `docs/grok-build-provider-design.md`: design-only Grok Build provider contract, blocked on owner sign-off.
  - `docs/bridge.md`: HTTPS-only, fail-closed bridge mode and Hermes/Claw runner layering.
  - `docs/hermes-mcp-bridge.md`: shipped outward coordinator MCP bridge, read-only/fail-closed by default.
  - `docs/notifications-sdk.md`, `docs/telegram-onboarding.md`, `docs/bot-integration.md`: Telegram notification status, operator runtime, `telegram_send`, Discord/Slack deferred.
- `docs/tools/telegram-send.md` does not exist. Do not invent that path; keep Telegram docs in the existing notification docs.
- `packages/coding-agent/test/bot-integration-docs.test.ts` does not exist in JWC. Current coverage is `packages/coding-agent/test/notifications-docs.test.ts`.
- `docs/bridge.md` and `docs/rpc.md` still cite `@gajae-code/bridge-client`, while the actual package is `@jawcode-dev/bridge-client`.
- The docs index generator is package-local: `bun --cwd=packages/coding-agent run generate-docs-index`.

## Part 1: user-level change

Close the external-integration docs card by adding one JWC-facing integration matrix that says what is actually shipped, what is fail-closed, what is design-only, and what is not shipped. The patch also corrects stale bridge-client package naming in bridge/RPC docs and adds tests so future docs cannot accidentally claim unsupported integrations as available. No new runtime integration, command, provider, or adapter is introduced.

## Part 2: diff-level plan

### NEW: `docs/external-integrations.md`

Complete planned content:

```md
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
```

### MODIFY: `docs/codebase-overview.md`

Add one paragraph under `## Product shape` after the `.jwc/` runtime-state paragraph:

```diff
 Runtime state, specs, plans, goals, team state, and local overrides live under `.jwc/`.
+
+External integration status is summarized in `docs/external-integrations.md`. Use that matrix before
+copying upstream integration docs into JWC: only shipped JWC surfaces should be described as supported,
+while design-only or upstream-only surfaces must stay explicitly gated or deferred.
```

### MODIFY: `docs/bridge.md`

Replace stale bridge-client package name:

```diff
-`@gajae-code/bridge-client` exposes `BridgeClient` with handshake, command
+`@jawcode-dev/bridge-client` exposes `BridgeClient` with handshake, command
```

### MODIFY: `docs/rpc.md`

Replace stale bridge-client package name in heading and TypeScript import:

```diff
-`@gajae-code/bridge-client` (TypeScript):
+`@jawcode-dev/bridge-client` (TypeScript):
 
 ```ts
-import { BridgeClient } from "@gajae-code/bridge-client";
+import { BridgeClient } from "@jawcode-dev/bridge-client";
 ```
```

### NEW: `packages/coding-agent/test/external-integrations-docs.test.ts`

Complete planned content:

```ts
import { describe, expect, it } from "bun:test";
import * as path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "..", "..", "..");

async function readRepoFile(file: string): Promise<string> {
	return await Bun.file(path.join(repoRoot, file)).text();
}

describe("external integration docs", () => {
	it("summarizes shipped, fail-closed, design-only, and deferred integration surfaces", async () => {
		const doc = await readRepoFile("docs/external-integrations.md");
		expect(doc).toContain("Telegram notifications");
		expect(doc).toContain("Shipped operator runtime");
		expect(doc).toContain("Bridge mode");
		expect(doc).toContain("Experimental, fail-closed by default");
		expect(doc).toContain("Hermes coordinator MCP bridge");
		expect(doc).toContain("Shipped outward bridge, fail-closed by default");
		expect(doc).toContain("Grok Build provider");
		expect(doc).toContain("Design-only, owner decision required");
		expect(doc).toContain("Discord and Slack notification adapters");
		expect(doc).toContain("Deferred, not shipped");
	});

	it("does not overclaim upstream-only integration docs as shipped JWC features", async () => {
		const lower = (await readRepoFile("docs/external-integrations.md")).toLowerCase();
		expect(lower).toContain("codegraph custom tool notes from upstream");
		expect(lower).toContain("not shipped in jwc docs");
		expect(lower).toContain("standalone mcp registration notes from upstream");
		expect(lower).toContain("not shipped as a jwc product doc");
		expect(lower).toContain("openclaw / gajae remote upstream notes");
		expect(lower).toContain("translated into jwc bridge/coordinator boundaries only");
		expect(lower).not.toContain("discord adapter | shipped");
		expect(lower).not.toContain("slack adapter | shipped");
	});

	it("keeps bridge client package examples on the JWC package namespace", async () => {
		for (const file of ["docs/bridge.md", "docs/rpc.md"]) {
			const text = await readRepoFile(file);
			expect(text).toContain("@jawcode-dev/bridge-client");
			expect(text).not.toContain("@gajae-code/bridge-client");
		}
	});

	it("embeds the external integrations matrix in the local docs index", async () => {
		const generated = await readRepoFile("packages/coding-agent/src/internal-urls/docs-index.generated.ts");
		expect(generated).toContain("\"external-integrations.md\"");
		expect(generated).toContain("External Integrations Matrix");
	});
});
```

### GENERATED: `packages/coding-agent/src/internal-urls/docs-index.generated.ts`

Run:

```sh
bun --cwd=packages/coding-agent run generate-docs-index
```

Expected generated change: add `external-integrations.md` to `EMBEDDED_DOC_FILENAMES` and `EMBEDDED_DOCS`.

### CHASE CLOSURE DOCS

At B/D close:

- move `struct_har/chase/10.052_gjc_chase_docs_external_integrations.md` to `struct_har/chase/_fin/10/10.052_gjc_chase_docs_external_integrations.md`;
- update the moved `_fin/10` card body with a final close section that records the import/adapt/reject decisions, JWC implementation/docs evidence, verification commands, and residual risks;
- update `struct_har/chase/10_gjc_chase_MOC.md`;
- update `struct_har/chase/007_follow_index.md`;
- update `struct_har/chase/009_follow_tiers.md`;
- update `struct_har/chase/002_gap_inventory.md`;
- update `struct_har/chase/10.001_gjc_chase_cycle.md`;
- update `struct_har/chase/_fin/INDEX.md`.

## Verification plan

Focused:

```sh
bun test packages/coding-agent/test/external-integrations-docs.test.ts
bun test packages/coding-agent/test/notifications-docs.test.ts
bun test packages/coding-agent/test/docs-utility-surface-cleanup.test.ts
bun --cwd=packages/coding-agent run generate-docs-index
git diff --check
```

Global gate:

```sh
bun run check:ts
```

Static docs scan:

```sh
rg -n "@gajae-code/bridge-client|gjc notify|\\.gjc/state|Discord adapter \\| shipped|Slack adapter \\| shipped" docs/external-integrations.md docs/bridge.md docs/rpc.md docs/notifications-sdk.md docs/telegram-onboarding.md docs/bot-integration.md
```

Expected: no stale bridge-client package, no stale public `gjc notify`, no `.gjc/state`, no shipped Discord/Slack adapter claim in product docs. Existing legacy `GJC_NOTIFICATIONS*` mentions are allowed only as backward-compatibility notes in notification docs/tests. Tests may contain forbidden strings as negative assertions and are covered by `external-integrations-docs.test.ts` / `notifications-docs.test.ts`, not by this raw product-doc scan.

## Acceptance criteria

- `docs/external-integrations.md` gives a conservative JWC status matrix for external integration surfaces.
- Bridge/RPC docs use the actual `@jawcode-dev/bridge-client` package namespace.
- Regression tests prevent unsupported upstream-only surfaces from being documented as shipped.
- The generated embedded docs index includes the new matrix.
- The 10.052 chase card is moved to `_fin/10`, contains final closure evidence, and all chase indexes/changelog rows point to the `_fin` card.
