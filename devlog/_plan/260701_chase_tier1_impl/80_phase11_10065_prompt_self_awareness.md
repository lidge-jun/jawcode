# WP11 — 10.065 prompt self-awareness source grounding (ADAPT, identity-sensitive)

> Card: struct_har/chase/10.065_gjc_chase_prompt_self_awareness_grounding.md
> Goal f8909338-255 · cluster D (identity) 1st card.
> Source: GJC `aa7322f6` (v0.7.8) — +5 lines `<self-awareness>` block in system-prompt.md.
> Judgment: **ADAPT** — adopt grounding pattern; content ALWAYS JWC-authored (Jaw/Jawcode). Reject any gjc/Gajae leak.

## P — what GJC did vs what JWC adopts

GJC `aa7322f6` inserted a `<self-awareness>` block inside `</runtime-state></gjc-runtime>`:
- When the user asks about GJC usage/feature/command/the gajae-code system, do not answer from
  memory — clone `https://github.com/Yeachan-Heo/gajae-code` into /tmp, read the actual source, cite files.
- Reuse an existing fresh /tmp clone; base answers on cloned source, cite concrete paths.

JWC adopts the **pattern** (ground self/usage answers in authoritative JWC source instead of
memory) but the content is JWC-authored:
- JWC identity: "Jaw, the coding agent on the jwc runtime (Jawcode)".
- JWC canonical repo: `https://github.com/lidge-jun/jawcode` (packages/coding-agent/package.json).
- JWC already has a strong "Search before answering when the answer depends on repository facts"
  rule (system-prompt.md:328) — so the JWC block is framed as a self/usage-specific specialization
  of that existing rule, anchored to `jwc`/`.jwc` naming, NOT a verbatim clone instruction.

## Slice A — JWC self-awareness grounding block

### File
- MODIFY `packages/coding-agent/src/prompts/system/system-prompt.md`
  - Insert a `<self-awareness>` block immediately after `</runtime-state>` and before `</jwc-runtime>`
    (mirrors GJC placement). JWC-authored content:
    - When the user asks about jwc/Jawcode usage, a jwc feature/command/workflow, or the Jawcode
      system itself, do not answer from memory alone — read the actual jwc source (the local
      repository when working inside it, otherwise the canonical repo
      `https://github.com/lidge-jun/jawcode`) and ground the answer in what the source says.
    - Prefer the in-repo source when present; only clone the canonical repo into a temp dir when no
      local jwc source is available, and reuse an existing fresh clone instead of re-cloning.
    - Cite concrete `jwc`/`.jwc` files/paths from the source rather than guessing.

### Invariants
- Zero `gjc`/`gajae`/Gajae/Yeachan-Heo strings in added lines (identity safety — this is the gate).
- Only the JWC system-prompt.md changes; no runtime/code change.
- Block placed inside the existing `<jwc-runtime>` envelope, consistent with GJC structure.

### Acceptance
| check | expectation |
|---|---|
| identity | added lines contain `jwc`/Jawcode + lidge-jun/jawcode; NO gjc/gajae/Gajae/Yeachan-Heo |
| naming | `git diff` added lines pass naming contract 008 |
| diff | git diff --check clean |
| prompt-contract test | extend existing system-prompt identity test if one exists; else manual review |
| build | coding-agent tsgo EXIT 0 (prompt is bundled; confirm no build break) |

### Verification
```bash
git diff -- packages/coding-agent/src/prompts/system/system-prompt.md
rg -n "gjc|gajae|Gajae|Yeachan" packages/coding-agent/src/prompts/system/system-prompt.md   # added lines must be clean
# locate any existing system-prompt identity/contract test
rg -ln "system-prompt|self-awareness|Jawcode|identity" packages/coding-agent/test
cd packages/coding-agent && bun run check:types
```

## PABCD plan
- P: this doc.
- A: independent gpt-5.4 explorer audits — is the JWC block free of identity leak? does placement match? any existing test that must update? is the canonical repo URL correct?
- B: implement Slice A; independent reviewer PASS (identity focus).
- C: naming/identity scan + diff + tsgo + any prompt test.
- D: attest, close card → _fin/10, update MOC/007/009/10.001 cycle/_fin INDEX/slice-map.

## Depends / feeds
- Depends: none (isolated prompt change).
- Feeds: WP12 20.027 (subagent names) — sibling identity card.
