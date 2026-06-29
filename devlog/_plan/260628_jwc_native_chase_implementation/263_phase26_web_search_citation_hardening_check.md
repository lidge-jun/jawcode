# 263 Phase 26 check — 10.043-C web search citation/read hardening

## Local verification

```text
$ bun test packages/coding-agent/test/web/search/anthropic-citations.test.ts packages/coding-agent/test/tools/web-search-codex.test.ts packages/coding-agent/test/web/search/xai.test.ts packages/coding-agent/test/web/search/codex-broker.test.ts
21 pass
0 fail
55 expect() calls
Ran 21 tests across 4 files.
```

```text
$ cd packages/coding-agent && bun run check:types
$ tsgo -p tsconfig.json --noEmit
exit 0
```

## Pending C checks

- scoped `git diff --check`
- final Backend read-only verification
- final intended-file-only commit

