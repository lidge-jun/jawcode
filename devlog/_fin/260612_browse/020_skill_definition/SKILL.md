---
name: browse
description: Use the browser tool for interactive, JS-rendered, authenticated, or visually-sensitive web/app workflows.
---

# browse

Use this skill when a task needs browser interaction beyond static URL reading.
Prefer `read` for static pages, docs, JSON, PDFs, issues, and articles.

Planning note: this file is the draft source text for a future non-workflow browser tool-help artifact. It is not yet registered as a bundled workflow skill or public `/skill:browse` entrypoint.

## Tool contract

The `browser` tool has four actions:

- `open`: create or attach to a named tab; optionally navigate.
- `act`: execute structured steps such as navigate, click, type, fill, select, press, scroll, wait, observe, extract, screenshot.
- `run`: execute JavaScript in the tab with `page`, `browser`, `tab`, `display`, `assert`, and `wait` helpers.
- `close`: release one tab or all tabs.

Always `open` before `act` or `run`.
After navigation, re-observe before using element ids.

## Default strategy

1. Open the page.
2. Observe before screenshot unless visual appearance matters.
3. Prefer element ids from observe for click/type.
4. Use selectors when ids are unavailable.
5. Use `run` only when structured `act` cannot express the operation.
6. Close tabs when the task is done unless state must persist.

## Structured actions

Example:

```json
{
  "action": "act",
  "name": "main",
  "actions": [
    { "verb": "navigate", "url": "https://example.com", "wait_until": "domcontentloaded" },
    { "verb": "observe", "include_all": false },
    { "verb": "click", "id": 3 }
  ]
}
```

Available verbs:

- `navigate`: requires `url`.
- `click`: requires `id` or `selector`.
- `type`: requires `id` or `selector`, plus `text`.
- `fill`: requires `selector`, plus `value`.
- `select`: requires `selector`, plus `values`.
- `press`: requires `key`.
- `scroll`: requires `dx` or `dy`.
- `wait`: requires `selector` or `ms`.
- `back`, `observe`, `extract`, `screenshot`: no required fields.

## Raw JS helper patterns

Use `run` for stateful or conditional flows:

```js
const obs = await tab.observe();
const link = obs.elements.find(e => e.role === "link" && /sign in/i.test(e.name));
assert(link, "sign in link missing");
await (await tab.id(link.id)).click();
return await tab.waitForUrl(/login|auth/);
```

Useful helpers:

- `tab.goto(url, { waitUntil })`
- `tab.observe({ includeAll, viewportOnly })`
- `tab.id(n)`
- `tab.click(selector)`, `tab.type(selector, text)`, `tab.fill(selector, value)`, `tab.press(key, { selector })`
- `tab.waitFor(selector)`, `tab.waitForUrl(pattern)`, `tab.waitForResponse(pattern)`
- `tab.extract("markdown" | "text" | "html")`
- `tab.screenshot({ selector, fullPage, save, silent })`

## Attached apps

For Electron/CDP apps, use `app.path` or `app.cdp_url` on `open`.
Do not apply stealth assumptions to real desktop apps.
Use `app.target` when multiple windows exist.

## Safety

- Do not screenshot just to inspect page state; observe first.
- Do not rely on stale element ids after navigation.
- Treat `run` code as trusted local code with Node access.
- Prefer bounded extraction over dumping huge DOM/HTML.
