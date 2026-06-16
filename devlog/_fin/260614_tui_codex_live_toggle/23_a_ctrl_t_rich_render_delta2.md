# Stage A Delta2 — ctrl+t rich render plan

## Planner

FAIL

[high] Plan needs a single full-function hunk showing `toolCallsById` declared once before the `for (const message of messages)` loop, so assistant branch and toolResult branch share the same map.

[medium] ToolExecutionComponent replay passes `tool` as `undefined`; plan must state this is accepted generic/built-in rendering degradation for tools without registry metadata, or add lookup.

[low] Bash fixture includes `truncated` while implementation uses `meta?.truncation`; clarify fixture fields.

## Architect

PASS

Low comments:
- Add explicit `const toolCallsById = new Map<string, ToolCall>();` after `const lines: string[] = []`.
- `tool: undefined` is acceptable for current AC because built-in `toolRenderers` still apply; custom tool registry lookup can be follow-up.
