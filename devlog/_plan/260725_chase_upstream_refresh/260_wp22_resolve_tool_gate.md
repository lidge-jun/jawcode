# 260 — wp22: the N/A that wasn't

Source: **residual gap 5** in the wp8 `_fin` card for `20.089` (anchor `8b0402b32`). Four of five residuals
now closed.

| phase | evidence |
|---|---|
| P | structural probe of the registry wrapping order |
| A | **pass**, after refusing the paper N/A |
| B | `4c7d77c` |
| C | gates green; ablation-verified |

## The card set a trap and said so

The residual read: *"cursor mounted-device approval closes N/A once a focused approval-denial test confirms
the bypass is absent."* That wording exists because closing it by inspection was the obvious move — and
`rg xdevRegistry` returns nothing in JWC, so upstream's literal defect (mounted `xd://` devices reaching
`tool.execute()` past the approval gate) genuinely does not exist here.

Declaring N/A on that basis is precisely my documented failure mode: checking whether upstream's **path**
exists instead of asking what enforces the **capability**.

## Asking the capability question found a live gap

What enforces the deny/prompt gate in JWC is `ExtensionToolWrapper` — its `execute` fires the `tool_call`
hook and throws when an extension returns `{ block: true }`.

`sdk.ts` wraps the entire registry in one pass:

```
for (const tool of toolRegistry.values())
    toolRegistry.set(tool.name, new ExtensionToolWrapper(tool, extensionRunner));
```

…and then inserts `resolve` **after** it, with only `wrapToolWithMetaNotice`. So `resolve` was the single
registry entry that never fired `tool_call`: an extension that denies the call was never asked.

This is not extensions-only. Cursor's exec handlers resolve tools straight out of this registry via
`options.tools.get`, so the unwrapped entry is reachable at runtime.

Same class of bug as upstream's, one layer over. The card was right to demand a test rather than accept a
paper N/A.

## Tests

Two halves, deliberately:

- **Structural** — scan `sdk.ts` after the wrapping pass and assert no `toolRegistry.set(...)` lacks
  `ExtensionToolWrapper`. This is what catches the *next* late insert, which is the recurring shape.
- **Behavioral** — a runner returning `{ block: true }` stops a wrapped `execute`, and the same tool
  unwrapped runs anyway. Without this the structural test would just be enforcing a code convention with no
  demonstrated consequence.

Ablation restores the unwrapped insert and turns the structural test red.

## Not mine

`cursor-exec-handlers.test.ts` fails 4 of 10. Verified pre-existing by stashing every change and re-running:
identical 6 pass / 4 fail. Recorded rather than absorbed into this phase's result.

## Residual tracker

`20.089`: gaps 1, 2, 4 and 5 are closed (wp19, wp21, wp20, wp22). Only gap 3 (`e00eb7cfb`, OTLP log
construction) remains, and it stays open on purpose — it needs a live collector probe, not a blind port.
