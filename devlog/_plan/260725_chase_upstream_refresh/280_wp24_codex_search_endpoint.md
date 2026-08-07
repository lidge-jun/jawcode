# 280 — wp24: search ignored the endpoint you configured

Source: named residual in the wp9 `_fin` card for `20.087` — *"codex search transport hardcodes ChatGPT
transport, ignores configured transport"*.

| phase | evidence |
|---|---|
| P | source comparison of chat vs search paths |
| A | **pass**, after my planned approach was disproved |
| B | `66f1229` |
| C | gates green; both guards ablation-verified |

## An asymmetry between two paths to the same backend

`packages/ai/src/providers/openai-codex-responses.ts` resolves
`const baseUrl = model.baseUrl || CODEX_BASE_URL` — the constant is a *fallback*.
`web/search/providers/codex.ts` built its URL straight from the constant.

So someone pointing `openai-codex` at a proxy or enterprise gateway had it honored for conversation and
silently ignored for search, which sent their OAuth token to `chatgpt.com`. Nothing errors; the search just
works against the wrong host.

## The audit disproved my plan

I intended to read the endpoint from `getBundledModels("openai-codex")`, which the file already loads for
other reasons. Checked it before building:

```
getBundledModels("openai-codex")[0].baseUrl  →  "https://chatgpt.com/backend-api"
```

Bundled metadata carries the **vendor default**. A user-configured endpoint would never appear there, so the
fix would have been a no-op that read as correct — the worst kind. The real endpoint is on `ctx.model` at
the tool boundary, where only `id` and `provider` were being forwarded, so `sessionModelBaseUrl` is now
threaded through `SearchParams` and all five call sites.

Second audit finding: adopting the session model's endpoint unconditionally would let an **Anthropic**
session redirect Codex search at Anthropic's base URL. The call site gates on
`sessionModelProvider === "openai-codex"`.

## Ablation found a hole in my own tests

My first three tests exercised `resolveCodexSearchBaseUrl` directly. Reverting the call site to the
hardcoded constant left **all three green** — they proved the helper worked, not that anything used it.
That is the same shape as the wp12 and wp21 findings, and I walked into it again.

Added assertions on the call site itself. Now reverting the URL construction fails, and removing the
provider guard fails, each independently.

## Two residuals probed and found already satisfied

Recorded rather than reworked:

- **bash timeout output drainage** — three live `executeBash` cases keep pre-timeout output, including a
  400-line tail streaming right up to the deadline, and the abort path too.
- **unsigned PTY pids** — `crates/pi-natives/src/ps.rs` uses `i32` for `pid`, `ppid` and `from_pid`
  throughout.

The `diff.ts` word-diff residual stays out: `modes/components/diff.ts` is protected TUI scope.
