# chase/bands — 밴드 카드

> 횡단 표: [002_gap_inventory.md](../002_gap_inventory.md)  
> 구체 갭: `chase/10.NNN_*` · `20.NNN_*` · 완료 `_fin/`

## 밴드 요약 (2026-06-26 · `50_status` 동형)

| 밴드 | G1 gjc | G3 jwc (제품) | struct_har 대조 |
|------|--------|---------------|-----------------|
| 010 | 🟡 publish/bin | ✅ `jwc` only | [jwc_patched/010_shell](../../jwc_patched/010_shell/) |
| 020 | 🟡 prompt drift | ✅ **99.03 M1–M3** | [020_prompt](../../jwc_patched/020_prompt/) |
| 030 | 🟡 team profile | 🟡 D5 cli-jaw | [030_skills](../../jwc_patched/030_skills/) |
| 040 | 🟡 deep-interview | ✅ jaw-interview | [040_interview](../../jwc_patched/040_interview/) |
| 050 | 🟡 ralplan upstream | ✅ orchestrate | [050_plan](../../jwc_patched/050_plan/) |
| 060 | 🟡 goal busy-loop | ✅ goal · 🟡 steering | [060_goal](../../jwc_patched/060_goal/) |
| 070 | 🟡 hooks | ✅ **99.01** memory CLI | [070_memory](../../jwc_patched/070_memory/) |
| 080 | 🟡 TUI fixes | 🟡 **99.04** HUD | [080_tui](../../jwc_patched/080_tui/) |
| 081 | 🟡 cursor **높음** | 🟡 kiro WIP | [081_cursor](../../jwc_patched/081_cursor/) |
| 083 | 🟡 compaction class | ✅ segment/collapse | [083_output](../../jwc_patched/083_output/) |
| 099 | — | 🟡 99.02·04·05·06 | [099_stabilization](../../jwc_patched/099_stabilization/) |
| 100 | 🟡 runtime | ✅ Node M2 | [100_node](../../jwc_patched/100_node/) |

## 050_plan — jwc 앵커 (코드 스니펫)

Public planning은 native `jwc orchestrate`; bundled skill은 `defaults/jwc/skills/plan/SKILL.md`.

```typescript
// packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts (entry)
// packages/coding-agent/src/commands/orchestrate.ts
// packages/coding-agent/src/prompts/jaw/orchestrate-*.md
```

`struct_har` 재생성 앵커: `struct_har/_scripts/struct-har-regenerate.ts` 밴드 `050_plan` → 위 경로 **present** @ `da23db8`.

## 060_goal — continuation 타이머 (jwc)

Upstream #616은 “busy일 때 continuation 재시도” 패턴. jwc는 `interactive-mode`에서 스케줄한다:

```typescript
// packages/coding-agent/src/modes/interactive-mode.ts (~749+)
#scheduleGoalContinuation(): void {
  this.#cancelGoalContinuation();
  if (!this.session.settings.get("goal.continuationModes").includes("interactive")) return;
  if (!this.goalModeEnabled || this.goalModePaused) return;
  // … active goal + buildContinuationPrompt() …
  this.#goalContinuationTimer = setTimeout(() => {
    this.onInputCallback(/* goal-continuation custom message */);
  }, …);
}
```

**chase 10.022**: upstream과 diff — `isStreaming` / `isCompacting` 일 때 타이머를 건너뛰는지, `AgentBusyError` 루프가 없는지 수동 시나리오로 확인.

## 030_skills / team — profile gap (10.007)

jwc는 launch marker는 있으나 upstream식 **self-heal retag**는 아직 없음:

```typescript
// packages/coding-agent/src/jwc-runtime/tmux-common.ts
export const GJC_TMUX_PROFILE_OPTION = "@gjc-profile";
export const GJC_TMUX_PROFILE_VALUE = "1";

// packages/coding-agent/src/jwc-runtime/team-runtime.ts (~1655)
if (readJwcTmuxProfileValue(tmuxCommand, sessionName) !== GJC_TMUX_PROFILE_VALUE)
  throw new Error(buildTeamTmuxLeaderRequirementMessage(`unmanaged_tmux_session:${sessionName}`));
```

Upstream (#546): `GJC_TMUX_LAUNCHED_ENV === "1"` 일 때만 `retagGjcLaunchedTmuxSession` — [10.007](../10.007_gjc_chase_team_profile_self_heal.md).

*갱신: `002_gap_inventory` · `50_status`와 함께.*
