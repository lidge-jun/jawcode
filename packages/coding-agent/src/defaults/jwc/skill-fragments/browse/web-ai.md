# web-ai

Drive AI provider websites (ChatGPT, Gemini, Grok) via the `agbrowse` Chrome/CDP runtime.

## Preconditions

- Use the existing headed Chrome profile when provider login is required.
- Do not start a separate Chrome/profile unless explicitly asked.
- Prefer `agbrowse status` before mutation.
- For live provider smoke tests, pass `--url` so the runtime verifies the host before sending.

## Commands

```bash
agbrowse web-ai render       # inspect structured prompt shape (no mutation)
agbrowse web-ai status       # check provider state
agbrowse web-ai send         # submit prompt
agbrowse web-ai poll         # poll for response
agbrowse web-ai query        # send + poll in one
agbrowse web-ai stop         # stop generation
agbrowse web-ai context-dry-run   # preview context package
agbrowse web-ai context-render    # render context package
```

## Provider matrix

| Provider | Inline | File upload | Context upload | Model select | Copy fallback |
|---|:---:|:---:|:---:|:---:|:---:|
| ChatGPT | yes | yes | yes | yes | yes |
| Gemini | yes | yes | yes | yes | yes |
| Grok | yes | yes | yes | yes | yes |

Unsupported vendors or model aliases must fail before browser mutation.

## Render first

Always inspect the prompt shape before live mutation:

```bash
agbrowse web-ai render \
  --vendor chatgpt \
  --project "project name" \
  --goal "what the provider should do" \
  --prompt "question"
```

## Model aliases

### ChatGPT
- `instant`, `fast`, `gpt-5.3`
- `thinking`, `think`, `gpt-5.5-thinking`
- `pro`, `gpt-5.5-pro`

### Gemini
- `fast`, `flash`, `gemini-fast`
- `thinking`, `think`, `gemini-thinking` (Gemini 3 Flash Thinking)
- `pro`, `gemini-pro`, `3.1-pro`
- `deepthink`, `deep-think` (activates Deep think tool, separate from thinking model)

### Grok
- `auto`, `automatic`
- `fast`, `quick`
- `expert`, `thinking`, `think`
- `grok-4.3`, `grok43`, `grok-43`, `beta`
- `heavy`

## Live query examples

```bash
# ChatGPT Pro
agbrowse web-ai query \
  --vendor chatgpt --url https://chatgpt.com/ \
  --model pro --inline-only --allow-copy-markdown-fallback \
  --prompt "Reply exactly CHATGPT_OK"

# Gemini
agbrowse web-ai query \
  --vendor gemini --url https://gemini.google.com/app \
  --model fast --inline-only \
  --prompt "Reply exactly GEMINI_OK"

# Grok
agbrowse web-ai query \
  --vendor grok --url https://grok.com/ \
  --model expert --inline-only \
  --prompt "Reply exactly GROK_OK"
```

## File upload

```bash
agbrowse web-ai query \
  --vendor gemini --url https://gemini.google.com/app \
  --model fast --file /tmp/context.txt \
  --prompt "Read the attached file and reply with its sentinel."
```

Upload must verify visible attachment evidence and sent-turn evidence.

## Context package upload

```bash
# Dry run first
agbrowse web-ai context-dry-run \
  --vendor chatgpt --prompt "Review this context" \
  --context-from-files "web-ai/*.mjs" --json

# Live
agbrowse web-ai query \
  --vendor grok --url https://grok.com/ \
  --context-from-files "web-ai/*.mjs" --context-transport upload \
  --prompt "Reply exactly CONTEXT_OK if the package contains question.mjs."
```

## Copy markdown fallback

Use only when explicitly needed. The runtime intercepts `navigator.clipboard.writeText/write` during the provider Copy button click — it does not read the OS clipboard.

```bash
agbrowse web-ai query \
  --vendor chatgpt --inline-only --allow-copy-markdown-fallback \
  --prompt "Return a markdown table."
```

## Safety

- Never claim live success from render/dry-run alone.
- Headed Chrome is the valid path for provider smoke tests.
- Human verification and login screens must be completed by the user.
- If the active tab is ambiguous, run `agbrowse tabs` and `agbrowse tab-switch <targetId>` before mutation.
