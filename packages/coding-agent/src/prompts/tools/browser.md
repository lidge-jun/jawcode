Control a real Chromium tab — JS execution, interactive actions, authentication flows.

<instruction>
- For static web content (articles, docs, issues, JSON, PDFs), prefer `read` with a URL. Use `browser` when you need JS, authentication, or interaction.
- Four actions: `open` (acquire a named tab, optionally navigate), `close` (release tab(s)), `run` (execute JS with `page`/`tab` helpers), `act` (structured `[{verb, …}]` steps — preferred for routine interaction).
- Default to `observe` over `screenshot` for understanding page state. Screenshot only when visual appearance matters.
- For attached desktop apps, use `app.path` or `app.cdp_url` on `open`.
- For detailed usage — tab helpers, action verbs, selectors, examples — reference the `browse` skill.
</instruction>

<critical>
- You MUST call `open` before `run` or `act`. Neither implicitly creates a tab.
- After navigation, prior element ids from `observe` are invalidated. Re-observe before referencing them.
</critical>
