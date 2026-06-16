# Goal HOTL 매턴 주입 메커니즘

> 상태: 📋 계획 (260613)

## 문제

goal 모드 + PABCD 활성 시 에이전트가 P에서 멈추고 A→B→C→D로 자동 진행하지 않음.
cli-jaw에서는 dev-pabcd Rule 4가 매 턴 prefix로 주입되지만, jawcode에는 이 메커니즘 없음.

## cli-jaw 동작 (참고)

```
dev-pabcd SKILL.md Rule 4:
"Goal-mode precedence: when a jaw goal is active, P/A/B approval gates
are satisfied by evidence-backed checkpoints (cli-jaw goal update)
instead of waiting for user approval."
```

cli-jaw pipeline.ts는 매 턴 `getPrefix(state, source)`를 prepend하고,
goal active일 때 `scheduleGoalContinuation`이 자동 continuation prompt 주입.

## jawcode 현재 상태

- `#buildPabcdStageMessage()` → 매 턴 stage context 주입 ✅
- `#scheduleGoalContinuation()` → goal active일 때 continuation prompt 주입 ✅
- **HOTL "자동 진행하라" 가이드** → ❌ 누락

## 구현

`#buildPabcdStageMessage()`에서 goal 모드 활성 여부를 확인하고,
HOTL 가이드를 stage context에 append.

```
[PABCD P stage context]
...
[HOTL MODE — Goal Active]
You are in goal-mode HOTL. Do NOT wait for user approval at P/A/B gates.
Record evidence-backed checkpoints (jwc goal update --evidence "...") and
self-advance to the next phase. If truly impossible, pause and ask.
```

### 위치

`packages/coding-agent/src/session/agent-session.ts`
- `#buildPabcdStageMessage()` 내부에서 goal mode 체크
- goal active → HOTL suffix append
