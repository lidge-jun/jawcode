# PABCD prefix 주입 메커니즘 (jwc)

> 상태: 🔨 구현 중 (260613)

## 문제

`/orchestrate p` → `session.prompt(stdout)` 제거 후 stage prompt가 주입 안 됨.
cli-jaw는 pipeline.ts에서 매 턴마다 prefix를 prepend하지만, jawcode에는 이 메커니즘이 없음.

## 목표 동작

```
1. /orchestrate p → 상태만 전환, 에이전트 미트리거
2. 유저가 메시지 입력
3. 메시지 + stage prompt가 합쳐져서 LLM에 전달
4. 에이전트가 P 모드로 응답
```

## 설계

### 접근: pending stage prompt 패턴

```
/orchestrate p
  → runNativeOrchestrateCommand(["p"], cwd)
  → 상태 파일 기록
  → stage prompt를 pendingStagePompt에 저장
  → UI에 상태 변경 표시

유저 메시지 입력
  → prompt submit 경로에서 pendingStagePrompt 확인
  → 있으면 prepend: stagePrompt + "\n\n" + userMessage
  → pendingStagePrompt 소비 (1회용)
  → LLM에 합성된 프롬프트 전달
```

### 구현 위치

1. `InteractiveMode` 인스턴스에 `#pendingStagePrompt: string | null` 필드
2. `/orchestrate` handler에서 stageEntered일 때 `this.#pendingStagePrompt = result.stdout`
3. prompt submit 경로 (`handleUserInput` 또는 유사)에서 pending 확인 + prepend
4. 후속 턴 prefix: PABCD 상태 active일 때 매 턴 phase 컨텍스트 배너 추가

### cli-jaw 비교

| | cli-jaw | jawcode (구현 후) |
|---|---|---|
| 최초 진입 | `getStatePrompt()` 교체 | `pendingStagePrompt` prepend |
| 후속 턴 | `getPrefix(state, source)` prepend | PABCD active 시 phase 배너 prepend |
| 저장 | pipeline.ts | InteractiveMode 인스턴스 |
