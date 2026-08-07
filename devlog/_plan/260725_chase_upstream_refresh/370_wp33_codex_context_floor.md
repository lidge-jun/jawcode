# 370 — wp33: a one-token session that looked like a broken model

Source: named residual in the wp10 `_fin` card for `20.088` — *"codex context-window floor in
`packages/ai/src/utils/discovery/codex.ts`"*.

| phase | evidence |
|---|---|
| P | reproduced through `fetchCodexModels` |
| A | **pass**, floor derived from the real model range |
| B | `3569569` |
| C | full `packages/ai` suite green; ablation-verified |

## The gap

`toPositiveInt` accepts anything above zero, and discovery only fell back to a default when *both* window
fields were absent or non-positive. So a degraded, truncated or placeholder backend response was trusted
verbatim. Measured, not assumed:

| reported | resulting window |
|---|---|
| `context_window: 1` | **1** |
| `context_window: 500, max: 400` | **500** |
| `context_window: 1000, max: 1000` | **1000** |

A one-token window cannot hold the system prompt. Worse, it is silent: compaction thresholds and the context
display are computed from it, so the user sees a model that appears broken with nothing pointing at
discovery as the cause.

## The floor came from the data, not from taste

The failure mode of any floor is clamping something legitimate, so the value had to be derived. Bundled
`openai-codex` windows are 128K, 272K, 373K, 400K and 1M — the smallest real model is `gpt-5.3-codex-spark`
at 128K. A floor of 8192 sits roughly fifteen times below that: low enough that it cannot touch a real
model, high enough to reject everything reproduced above.

Both directions are pinned. A test asserts 128K survives untouched alongside 1M, and the ablation relaxing
back to `> 0` turns 4 of 5 red while that control stays green.

## Two things the audit added

- **`maxTokens` is derived** from the window, so a bogus window also produced a one-token *output* cap. That
  is asserted explicitly rather than left to follow by implication.
- **`gpt-5.6` has its own larger default**, so the fallback must not flatten every model to the generic one.
  Also pinned.
