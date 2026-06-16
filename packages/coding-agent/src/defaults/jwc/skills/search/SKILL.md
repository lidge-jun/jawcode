---
name: search
description: Search strategy — tool routing, query normalization, temporal anchoring, dual-search mandate, citation rules.
hide: true
---

# search

Reference this skill when planning web or codebase searches. It covers tool selection, query construction, verification, and citation.

## Quick reference

| I need... | 1st tool | 2nd tool (required) |
|---|---|---|
| Exact symbol / function | `grep` / `find` | `search` (BM25) or `read` |
| External library docs | Context7 MCP | `web_search` |
| Latest pricing / versions | `web_search` | cross-check with official docs |
| Deep web interaction (JS/auth) | `browser` tool | `web_search` for corroboration |
| Code logic understanding | `search` (BM25) | `grep` → `read` |

**Always 2+ tools. Always cite sources.**

## Decision rules

### When NOT to search

- General knowledge answerable from training data
- Code syntax, language specs, math (static knowledge)
- Questions about local files already in workspace

### When to search

- Latest versions, release dates, changelogs
- Specific library/API usage (accuracy required)
- Current prices, news, events
- Error messages, bug solutions
- Plugin/extension comparisons

## Query normalization

Informal or Korean queries must be decomposed before searching.

```
User: "코파일럿 3000크레딧 꼼수"

1. DECOMPOSE: Copilot + 3000 credits + billing trick
2. SEARCH English: "GitHub Copilot premium request reset date"
3. SEARCH English: "GitHub Copilot cancel subscription keep access"
4. COMBINE + VERIFY with official docs
```

**Rule**: search in English first (more results), then Korean if English yields nothing.

## Temporal anchoring

Every web search query MUST include a time anchor to avoid outdated results.

| Situation | Anchor | Example |
|---|---|---|
| Default (no date from user) | `YYYY-MM` | `"Claude pricing 2026-06"` |
| User specified year | `YYYY` | `"React 19 features 2025"` |
| User gave exact date | `YYYY-MM-DD` | `"OpenAI outage 2026-01-15"` |
| Pricing/plan question | `YYYY-MM` + `pricing` | `"Copilot pricing 2026-06"` |

QDF trigger keywords (temporal anchor mandatory):
- Korean: 최신, 최근, 가격, 요금, 플랜, 버전, 출시, 뉴스, 비교
- English: latest, newest, pricing, version, release, news, comparison

## Multi-hop iteration (max 3 rounds)

```
ROUND 1: query + YYYY-MM → results
  └─ Fresh & sufficient? → cite. Done.
  └─ Outdated / vague? → continue.

ROUND 2: refine query using hints from Round 1
  └─ Confirmed? → cite. Done.
  └─ Still uncertain? → continue.

ROUND 3: search official docs directly
  (e.g., "site:anthropic.com pricing")
  └─ Extract + tag with confidence.
```

## Fact verification (high-risk claims)

High-risk claims (pricing, plans, versions, compatibility) require 2+ independent sources.

```
1. SEARCH    → find initial answer
2. GENERATE  → draft answer
3. PLAN      → generate verification questions per claim
4. VERIFY    → search each question INDEPENDENTLY
5. COMPARE   → sources agree? YES → 🟢  NO → flag 🟡/🔴
6. REVISE    → correct draft
```

Source hierarchy: official docs > changelogs/blogs > tech news > community posts.

## Confidence tagging

Every web-search-sourced claim must carry a tag:

| Tag | Meaning | Condition |
|---|---|---|
| 🟢 Confirmed | 2+ sources agree, within 6 months | Official docs or 2 independent sources |
| 🟡 Single source | Only 1 source found | Add "추가 검증 권장" |
| 🟠 Stale | Info >6 months old | Add date + "이후 변경 가능" |
| 🔴 Unverified | Cannot confirm | State "확인되지 않음", no guessing |

## Citation (mandatory)

Every search-sourced claim must have its source linked immediately below.

```
Claude Sonnet 4.5: input $3, output $15. 🟢 (2026-02 확인)
> 출처: [Anthropic Pricing](https://anthropic.com/pricing)
```

**"I don't know" is always better than a hallucination.**
