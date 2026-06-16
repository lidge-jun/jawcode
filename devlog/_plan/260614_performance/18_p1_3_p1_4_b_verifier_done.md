DONE

P1.3 Box committed-child skip, all-committed `[]`, and invalidate recursion match the plan and are covered by `packages/tui/test/box-committed-skip.test.ts`.

P1.4 `runRootCommand` exposes injection seams (`discoverAndLoadMCPTools`, `buildSessionOptions`, `applyStartupModelProfiles`, `runPrintMode`, `runBridgeMode`, `postmortemQuit`) and implements cleanup ownership paths: ACP discovery skip, CLI-owned cleanup before session creation, post-create disposal on fatal exits, print no-double-dispose, bridge startup cleanup, and external-manager non-disconnect.

Focused tests observed by parent:

```text
bun test packages/tui/test/box-committed-skip.test.ts packages/coding-agent/test/main-cli-mcp-cleanup.test.ts packages/coding-agent/test/mcp-lifecycle-cleanup.test.ts packages/coding-agent/test/acp-mcp-isolation.test.ts
→ 17 pass, 0 fail

bun --cwd=packages/coding-agent run check:types
→ pass

bun biome check changed source/test files
→ OK
```

Out-of-scope note: `packages/tui/test/commit-lane.test.ts` currently fails in this environment because `tui.commitLines()` returns false; the Box-only regression test passed and the verifier did not treat that as a P1.3 regression.
