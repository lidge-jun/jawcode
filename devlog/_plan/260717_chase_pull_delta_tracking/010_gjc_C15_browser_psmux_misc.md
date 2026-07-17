# 010_gjc_C15_browser_psmux_misc

> Range: `4a80bac9..3ddf26079`
> Cluster: C15 — browser/psmux/misc
> Sol priority: P3
> Model-related: ✗
> Card target: 10.102_browser_psmux_misc
> Worker: GW6

이 클러스터는 장시간 세션에서 브라우저 탭, 격리 프로필, psmux/tmux owner가 사라지거나 재사용될 때의 복구 경계를 다룬다. managed assistant shell과 mid-run context maintenance도 같은 장기 실행 안정성 축으로 묶는다.

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `1e6774405` | fix(coding-agent): recover expired dead browser tabs (#2454) | browser tab supervisor |
| 2 | `2511ff95f` | fix(agent): preserve managed assistant message shells (#2450) | managed agent messages |
| 3 | `ed06df2a3` | fix(browser): keep configured geo surfaces coherent (#2286) | browser launch/profile config |
| 4 | `a5f0fdc9d` | fix(browser): keep configured geo surfaces coherent (#2283) | browser launch/profile config |
| 5 | `6579d9d83` | feat(browser): WebRTC IP-leak suppression + opt-in geo; gate UA cleanliness (#2273) | browser profile/stealth |
| 6 | `fbde4e2d6` | feat(browser): patch headless Notification.permission tell (CreepJS) (#2270) | browser launch/stealth |
| 7 | `1196b1d41` | fix(dev): recognize Windows Bun workspace gjc shim | Windows dev launcher |
| 8 | `02312d5ef` | fix(browser): harden isolated profile reuse (#2266) | browser profile reuse |
| 9 | `343f1253b` | feat(browser): anti-detection benchmark suite + auto-default profile reuse (#2264) | browser benchmark/profile reuse |
| 10 | `62997044f` | fix(coding-agent): classify midrun SDK test seams (#2244) | mid-run SDK lifecycle |
| 11 | `2ff0daa31` | fix(coding-agent): cooperative mid-run context maintenance (#2213) | session context maintenance |
| 12 | `e5cdc46f1` | fix(psmux): add explicit compatibility lifecycle and artifact authority (#2231) | psmux compatibility |
| 13 | `decc1a621` | fix(coding-agent): recognize VTE tmux owner scopes (#2166) | tmux owner detection |
| 14 | `5e5c61883` | fix(coding-agent): identify Windows psmux tmux aliases | Windows psmux detection |
| 15 | `32ffa1e6f` | fix(coding-agent): recognize VTE tmux owner scopes (#2166) | tmux owner detection |
| 16 | `bc13c2cb2` | fix(coding-agent): harden Windows psmux coordinator | Windows psmux coordinator |
| 17 | `287dcef87` | fix(coding-agent): bound browser close/close-all teardown with an end-to-end deadline (#2046) | browser resource GC |

## 주제 분석

브라우저 쪽은 tab registry와 실제 프로세스 수명을 다시 맞추고, profile reuse가 격리와 stealth 설정을 깨뜨리지 않게 한다. psmux 쪽은 Windows alias와 VTE owner scope를 명시해 잘못된 coordinator 재사용을 막는다. mid-run maintenance는 이 장기 실행 표면에서 메시지 shell과 context 정리가 서로의 authority를 침범하지 않는지 함께 확인한다.

## model/ 교차 참조

직접적인 model/provider 변경은 없다. 다만 context maintenance가 모델 교체나 fallback 중 실행될 수 있으므로 C03/C16의 세션 상태 전이와 회귀 테스트 경계만 교차 확인한다.

## Worktree 대조

JWC에는 browser tab supervisor가 있지만 upstream의 `profile-reuse.ts`와 `gjc-runtime/tmux-owner-isolation.ts`는 현재 같은 경로에 없다. browser 복구는 기존 JWC 도구 구조에 맞춰 비교하고, psmux 코드는 JWC의 현재 tmux/launcher 소유권 구현을 먼저 찾아 경로를 재매핑해야 한다.

