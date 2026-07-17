# Evidence Receipt — chase cards 10.078 + 10.079 full recheck

Task: Deep-fill chase cards 10.078 and 10.079.

## Commands Actually Rerun

### 10.078 upstream range

Command:

```bash
git -C devlog/_gjc_chase/gajae-code log --oneline --stat db7938e1..b3b5b8a9 -- packages/coding-agent/src/slash-commands packages/coding-agent/src/skill* packages/coding-agent/src/modes/components/skill*
```

Output:

```text
4c3f401a Add /effort command and selector (#1825)
 .../src/slash-commands/builtin-registry.ts         | 79 +++++++++++++++++++++-
 1 file changed, 78 insertions(+), 1 deletion(-)
59f4c924 feat(slash-commands): add /quit alias for /exit (#1782)
 packages/coding-agent/src/slash-commands/builtin-registry.ts | 1 +
 1 file changed, 1 insertion(+)
003f39f5 Add clear slash command preserving session
 .../coding-agent/src/slash-commands/builtin-registry.ts  | 16 ++++++++++++++++
 1 file changed, 16 insertions(+)
43b42d4f Restore /changelog slash command (#1681)
 .../src/slash-commands/builtin-registry.ts         | 48 ++++++++++++++++++++++
 1 file changed, 48 insertions(+)
```

Judgement: the rewritten 10.078 card includes these slash-command range facts and separates adjacent model/deep-interview changes.

### 10.078 key commits

Command:

```bash
git -C devlog/_gjc_chase/gajae-code show --stat d3bc0f89 9912d7fd fd6817fa 4c3f401a c55783d3 003f39f5
```

Output summary:

```text
d3bc0f89 Add runtime skill discovery (#1847)
  packages/coding-agent/src/extensibility/runtime-skill-discovery.ts
  packages/coding-agent/src/tools/skill-discovery.ts
  packages/coding-agent/test/tools/skill-discovery.test.ts
9912d7fd Support inline skill invocation (#1510)
  packages/coding-agent/src/extensibility/skills.ts
  packages/coding-agent/src/modes/controllers/input-controller.ts
  packages/coding-agent/src/modes/prompt-action-autocomplete.ts
fd6817fa make skill tool default-registered instead of discoverable (#1513)
  packages/coding-agent/src/tools/skill.ts
4c3f401a Add /effort command and selector (#1825)
  packages/coding-agent/src/slash-commands/builtin-registry.ts
  packages/coding-agent/src/modes/controllers/selector-controller.ts
c55783d3 feat(deep-interview): add trace pre-skill option (#1555)
  packages/coding-agent/src/commands/deep-interview.ts
  packages/coding-agent/src/gjc-runtime/deep-interview-runtime.ts
003f39f5 Add clear slash command preserving session
  packages/coding-agent/src/session/agent-session.ts
  packages/coding-agent/src/session/session-manager.ts
```

Judgement: 10.078 contains per-commit file anchors for all six requested key commits.

### 10.079 upstream range

Command:

```bash
git -C devlog/_gjc_chase/gajae-code log --oneline --stat db7938e1..b3b5b8a9 -- packages/coding-agent/src/task packages/agent/src/agent-loop* packages/coding-agent/src/mcp
```

Output:

```text
6fe3b1c9 fix(token-log): bind root logs to current session (#1774)
da4a59ea feat(context): 13-finding token/context-window efficiency audit (#1723)
98cb3352 fix(agent,coding-agent): harden #1722 caches per review (#1763)
9055ed07 fix(task): reserve output ids from sidecars (#1742)
a20c15a5 perf(coding-agent,agent): prompt/hook lifecycle audit findings 1-13 (#1722)
efae80f6 Harden subagent yield result contract (#1694)
36843d09 Fix empty fork context seed notices (#1587)
bbc604d5 Gate subagent IRC guidance on tool availability (#1581)
f751105f fix: bound task receipt review correctness
29cd5931 fix(task): make AgentOutputManager id allocation concurrency-safe (#1541)
8adf5902 fix(task): don't log subagent abort as "Subagent prompt failed" error (#1463)
```

Judgement: the rewritten 10.079 card includes these task/fork/session hardening facts and separates task-output/receipt/context-adjacent work.

### 10.079 key commits

Command:

```bash
git -C devlog/_gjc_chase/gajae-code show --stat 64cce6fd 67d7789e efae80f6 bbc604d5 06fde238 2c548364
```

Output summary:

```text
64cce6fd fix fork context provider payload stripping (#1586)
  packages/coding-agent/src/session/agent-session.ts
  packages/coding-agent/test/task/fork-context-seed.test.ts
67d7789e fix(agent): preserve fork seed after child compaction (#1573)
  packages/agent/src/append-only-context.ts
  packages/agent/test/append-only-seeded-rebase.test.ts
efae80f6 Harden subagent yield result contract (#1694)
  packages/coding-agent/src/task/executor.ts
  packages/coding-agent/test/task/executor-warnings.test.ts
bbc604d5 Gate subagent IRC guidance on tool availability (#1581)
  packages/coding-agent/src/task/executor.ts
  packages/coding-agent/src/task/index.ts
06fde238 feat(mcp): stop inheriting MCP servers live from other hosts (#1490)
  packages/coding-agent/src/discovery/cursor.ts
  packages/coding-agent/src/discovery/gemini.ts
  packages/coding-agent/src/discovery/opencode.ts
  packages/coding-agent/src/discovery/vscode.ts
  packages/coding-agent/src/discovery/windsurf.ts
2c548364 feat(mcp): add per-server autoload flag for startup connection control (#1489)
  packages/coding-agent/src/runtime-mcp/config-writer.ts
  packages/coding-agent/src/runtime-mcp/types.ts
```

Judgement: 10.079 contains per-commit file anchors for all six requested key commits.

## File Shape Checks

Command:

```bash
wc -l struct_har/chase/10.078_gjc_chase_skill_discovery_slash_commands.md struct_har/chase/10.079_gjc_chase_subagent_fork_session_hardening.md
```

Output:

```text
     120 struct_har/chase/10.078_gjc_chase_skill_discovery_slash_commands.md
     131 struct_har/chase/10.079_gjc_chase_subagent_fork_session_hardening.md
     251 total
```

Judgement: both cards are within the requested 100-150 line range.

Command:

```bash
rg -n "^## Upstream Commit Anchors|^## JWC Worktree Verification|^## Owner Files|^## Concrete Decisions Per Slice|^## Jawdev chase expansion" struct_har/chase/10.078_gjc_chase_skill_discovery_slash_commands.md struct_har/chase/10.079_gjc_chase_subagent_fork_session_hardening.md
```

Output:

```text
struct_har/chase/10.078_gjc_chase_skill_discovery_slash_commands.md:26:## Upstream Commit Anchors
struct_har/chase/10.078_gjc_chase_skill_discovery_slash_commands.md:46:## JWC Worktree Verification
struct_har/chase/10.078_gjc_chase_skill_discovery_slash_commands.md:61:## Owner Files
struct_har/chase/10.078_gjc_chase_skill_discovery_slash_commands.md:73:## Concrete Decisions Per Slice
struct_har/chase/10.078_gjc_chase_skill_discovery_slash_commands.md:114:## Jawdev chase expansion
struct_har/chase/10.079_gjc_chase_subagent_fork_session_hardening.md:26:## Upstream Commit Anchors
struct_har/chase/10.079_gjc_chase_subagent_fork_session_hardening.md:50:## JWC Worktree Verification
struct_har/chase/10.079_gjc_chase_subagent_fork_session_hardening.md:69:## Owner Files
struct_har/chase/10.079_gjc_chase_subagent_fork_session_hardening.md:81:## Concrete Decisions Per Slice
struct_har/chase/10.079_gjc_chase_subagent_fork_session_hardening.md:125:## Jawdev chase expansion
```

Judgement: both cards contain the required deep-fill sections and footer.

## Overall Judgement

Verified. The relevant checks for this documentation task were rerun: both upstream evidence command families, key-commit stat checks, line counts, and section-marker checks. No build/test suite was run because only markdown chase cards were edited.
