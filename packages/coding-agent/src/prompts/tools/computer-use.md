Control desktop applications through the lazy cua-driver backend. The backend process starts only when this tool is called.

<instruction>
- Use `list_apps` to discover running apps before targeting a process.
- Use `observe` or `window_state` with `pid` and `window_id` before element-based actions.
- Prefer `element_index` clicks from observed window state; coordinates are fallback only.
- Pass a stable `session` to `start_session` and subsequent calls when visual agent cursor/session identity matters.
</instruction>

<critical>
- This tool does not provide screenshots in the MVP. Use supported window/app observation actions instead.
- `click` requires `pid` plus either `element_index` or both `x` and `y`.
- `scroll` requires `pid` plus at least one of `dx` or `dy`.
- `type_text` requires `pid` and non-empty `text`; `press_key` requires `pid` and non-empty `key`.
</critical>
