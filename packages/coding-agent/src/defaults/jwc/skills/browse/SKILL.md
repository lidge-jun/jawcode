---
name: browse
description: Detailed browser tool usage — tab helpers, action verbs, selectors, attached apps, and safety patterns.
hide: true
---

# browse

Detailed usage guide for the `browser` tool. Reference this skill when planning multi-step browser interactions, using tab helpers in `run` code, or attaching to desktop apps.

## Actions

- `open` — acquire (or reuse) a named tab. `name` defaults to `"main"`. Optional `url` navigates after the tab is ready. Optional `viewport` sets dimensions. Optional `dialogs: "accept" | "dismiss"` auto-handles `alert`/`confirm`/`beforeunload` so navigation/clicks don't hang (default: leave dialogs unhandled).
- `close` — release a tab by `name`, or every tab with `all: true`. For spawned-app browsers, set `kill: true` to terminate the process tree (default leaves it running).
- `run` — execute JS against an existing tab. `code` is the body of an async function with `page`, `browser`, `tab`, `display`, `assert`, `wait` in scope. The return value is JSON-stringified into the tool result; multiple `display(value)` calls accumulate text/images.
- `act` — run a list of structured `actions` against an existing tab without writing JS (preferred for routine interaction). Each step is `{ verb, … }`; steps run in order; the tool returns an array of per-step results. Use `run` only when a verb does not cover what you need.

## Strategy

1. Open the page.
2. Observe before screenshot unless visual appearance matters.
3. Prefer element ids from observe for click/type.
4. Use selectors when ids are unavailable.
5. Use `run` only when structured `act` cannot express the operation.
6. Close tabs when the task is done unless state must persist.

## Browser kinds

Selected by the `app` field on `open`:

- default (no `app`) → headless Chromium with stealth patches.
- `app.path` → spawn an absolute binary (Electron/CDP). If a running instance already exposes a CDP port, it is reused; otherwise stale instances are killed and a fresh one spawned. No stealth patches.
- `app.cdp_url` → connect to an existing CDP endpoint (e.g. `http://127.0.0.1:9222`).
- `app.target` (with `path`/`cdp_url`) — substring matched against url+title to pick a BrowserWindow when multiple exist.

## Tab helpers (inside `run`)

- `tab.goto(url, { waitUntil? })` — clears the element cache and navigates.
- `tab.observe({ includeAll?, viewportOnly? })` — accessibility snapshot. Returns `{ url, title, viewport, scroll, elements: [{ id, role, name, value, states, … }] }`. Element ids are stable until the next observe/goto.
- `tab.id(n)` — resolves an element id from the most recent observe to a real `ElementHandle`.
- `tab.click(selector)` / `tab.type(selector, text)` / `tab.fill(selector, value)` / `tab.press(key, { selector? })` / `tab.scroll(dx, dy)` — selector-based actions.
- `tab.waitFor(selector)` — waits until attached, returns `ElementHandle` for chaining.
- `tab.drag(from, to)` — drag between points. Each endpoint is a selector or `{ x, y }`.
- `tab.scrollIntoView(selector)` — scroll element to viewport center (use before clicking off-screen elements).
- `tab.select(selector, …values)` — set selected option(s) on a `<select>`. `tab.fill` never works for selects.
- `tab.uploadFile(selector, …filePaths)` — attach files to `<input type="file">`. Paths resolve relative to cwd.
- `tab.waitForUrl(pattern, { timeout? })` — pattern is substring or `RegExp`. Polls `location.href` (works for SPA pushState).
- `tab.waitForResponse(pattern, { timeout? })` — pattern is substring, `RegExp`, or predicate. Returns raw `HTTPResponse`.
- `tab.evaluate(fn, …args)` — sugar for `page.evaluate` with abort signal wired.
- `tab.screenshot({ selector?, fullPage?, save?, silent? })` — auto-attaches image to output unless `silent: true`. Saves full-res to `save` path and downscaled copy to model.
- `tab.extract(format = "markdown")` — Readability-extracted page content.

## Structured action verbs (inside `act`)

- `navigate` — requires `url`, optional `wait_until`.
- `click` — requires `id` or `selector`.
- `type` — requires `id` or `selector`, plus `text`.
- `fill` — requires `selector`, plus `value`.
- `select` — requires `selector`, plus `values`.
- `press` — requires `key`, optional `selector`.
- `scroll` — requires `dx` or `dy`.
- `back` — no required fields.
- `wait` — requires `selector` or `ms`.
- `observe` — optional `viewport_only`, `include_all`.
- `extract` — optional `format` (`markdown` | `text` | `html`).
- `screenshot` — no required fields.

## Selectors

CSS as well as puppeteer query handlers: `aria/Sign in`, `text/Continue`, `xpath/…`, `pierce/…`. Playwright-style `p-aria/[name="…"]`, `p-text/…` are normalized.

## Examples

```jsonc
// Open a tab and observe
{"action":"open","name":"docs","url":"https://example.com"}
{"action":"run","name":"docs","code":"const obs = await tab.observe(); display(obs); return obs.elements.length;"}

// Click an observed element by id
{"action":"run","name":"docs","code":"const obs = await tab.observe(); const link = obs.elements.find(e => e.role === 'link' && e.name === 'Sign in'); assert(link, 'Sign in link missing'); await (await tab.id(link.id)).click();"}

// Save a full-page screenshot
{"action":"run","name":"docs","code":"await tab.screenshot({ fullPage: true, save: 'screenshot.png' });"}

// Fill and submit a form
{"action":"run","name":"docs","code":"await tab.fill('input[name=email]', 'me@example.com'); await tab.click('text/Continue');"}

// Structured act — navigate, observe, click
{"action":"act","name":"main","actions":[{"verb":"navigate","url":"https://example.com","wait_until":"domcontentloaded"},{"verb":"observe","include_all":false},{"verb":"click","id":3}]}

// Attach to an Electron app
{"action":"open","name":"cursor","app":{"path":"/Applications/Cursor.app/Contents/MacOS/Cursor"}}

// Close every tab and kill spawned apps
{"action":"close","all":true,"kill":true}
```

## Safety

- You MUST call `open` before `run` or `act`. Neither implicitly creates a tab.
- Never screenshot just to see page state — `tab.observe()` returns structured data with element ids.
- After `tab.goto()` or any navigation, prior element ids are invalidated. Re-observe before referencing them.
- `code` runs with full Node access. Treat it as your code, not sandboxed code.
- Tabs survive across `run`/`act` calls and across in-process subagents.
- Prefer bounded extraction over dumping huge DOM/HTML.

## Fragments

- **web-ai**: Drive AI provider websites (ChatGPT, Gemini, Grok) via `agbrowse` — model aliases, provider matrix, file/context upload, copy-markdown fallback.

## Output

Per call: any `display(value)` outputs (text/images) followed by the JSON-stringified return value of the `code` function. `run` always produces at least a status line.
