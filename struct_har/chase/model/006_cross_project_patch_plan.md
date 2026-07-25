# 006 — Cross-Project Patch Plan (non-jawcode repos)

> Created: 2026-07-09
> Interview decision: "전부 import하고 opencodex 패치 플랜도 model에 적어놔"
> Scope: jawcode 구현 완료 후, 다른 700_projects 레포에 필요한 후속 패치 목록

## Overview

Chase cards 10.074-081의 구현 작업은 jawcode에서 먼저 진행. 이 문서는 jawcode 패치 완료 후 다른 프로젝트에 필요한 후속 작업을 기록한다.

## opencodex

Path: `/Users/jun/Developer/new/700_projects/opencodex`

### Provider registry updates needed after jawcode patches

| jawcode patch | opencodex impact | files to patch |
|---|---|---|
| Safety refusal terminal classification (10.080) | OCX proxy should forward refusal errors transparently, not retry | `src/providers/registry.ts` — verify retry policy per provider |
| Bounded 429 retries (10.080) | OCX has its own retry logic; verify bounded rate limit behavior | `src/providers/key-failover.ts`, `src/providers/quota.ts` |
| Fugu/Sakana login URL (10.080) | If OCX routes Fugu, update registry entry baseUrl/auth | `src/providers/registry.ts` — add/update fugu entry |
| ZAI limit detection (10.080) | If OCX routes ZAI, verify limit detection forwarding | `src/providers/registry.ts` — zai entry |
| New provider additions | Each new JWC KnownProvider may need OCX registry entry | `src/providers/registry.ts`, `src/router.ts` |
| Model catalog updates | OCX may need model metadata sync | `src/providers/antigravity-models.ts`, `src/providers/kiro-models.ts` |

### Priority: after jawcode model/provider patches are stable

## cli-jaw

Path: `/Users/jun/Developer/new/700_projects/cli-jaw`

| jawcode patch | cli-jaw impact | files to patch |
|---|---|---|
| New slash commands (/effort, /quit, /clear) | CLI may expose these or reference them | CLI command registry |
| Model selector batch assignment | CLI model list/defaults | CLI registry, OCX model fetch |
| Skill discovery runtime | CLI skill loading | CLI skill registry |

### Priority: after jawcode skill/slash command patches are stable

## codexclaw

Path: `/Users/jun/Developer/new/700_projects/codexclaw`

| jawcode patch | codexclaw impact | files to patch |
|---|---|---|
| Provider catalog changes | Codexclaw subagent model config | `plugins/codexclaw/components/subagent-config/` |
| New model defaults | Codexclaw may reference model IDs | Plugin config files |

### Priority: after jawcode model/provider patches are stable

## cli-jaw-skills

Path: `/Users/jun/Developer/new/700_projects/cli-jaw-skills`

| jawcode patch | skills impact | files to patch |
|---|---|---|
| Provider capability changes | Skills mentioning provider capabilities | Individual SKILL.md files |
| New tool surfaces (bisect, etc.) | Skills referencing new tools | Relevant SKILL.md files |

### Priority: documentation-only updates after jawcode patches land

## Execution sequence

1. jawcode patches stable + tests green
2. opencodex provider registry sync
3. codexclaw model config sync
4. cli-jaw command/model sync
5. cli-jaw-skills documentation sync
