# 10 Phase 1A — GJC Telegram active card hardening

## Scope

Harden only Telegram/notifications active cards:

- `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/10.028_gjc_chase_notifications_sdk.md`
- `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/10.029_gjc_chase_notify_config_cli.md`
- `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/10.030_gjc_chase_telegram_managed_daemon.md`
- `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/10.031_gjc_chase_telegram_threaded_surface.md`
- `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/10.032_gjc_chase_telegram_remote_answers.md`
- `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/10.033_gjc_chase_telegram_session_lifecycle.md`
- `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/10.034_gjc_chase_telegram_media_file_transfer.md`
- `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/10.035_gjc_chase_notifications_adapters_docs.md`

## Source evidence

GJC source:

```bash
git -C /Users/jun/Developer/new/700_projects/jawcode/devlog/_gjc_chase/gajae-code log --oneline --reverse --grep='telegram\|notify\|notification' -i 498d86bb..HEAD
git -C /Users/jun/Developer/new/700_projects/jawcode/devlog/_gjc_chase/gajae-code diff --name-only 498d86bb..HEAD -- crates/gjc-notifications crates/pi-natives/src/notifications.rs packages/coding-agent/src/notifications docs/notifications-sdk.md docs/telegram-onboarding.md
```

Key findings:

- Notifications SDK introduced by `61f31536` and expanded through `e2cdaf35`; later concrete fixes to record on `10.028` include `01868580`, `584a8efb`, `82c222bd`, `76bad3b7`, `06c15d72`, `d474c47d`, `fb07a1f2`, and `8b94c54a` where they touch SDK tests/docs/daemon resilience.
- Telegram daemon/threaded surface is grounded in `eb379ebc`, `0794372d`, `7384e76a`, `a450402d`, `04c65cf7`, `67672318`, `9c50168c`.
- Remote answer flow is grounded in `8b88cb31`, `90cf0b4e`, `f693048e`, `a3f312de`, `69158355`, `37b51179`, `08c073e0`, `d6ebca4a`, `915ad56f`, `e2eeffcb`, `03401058`, `477b4146`.
- Session lifecycle is grounded in `92ef72a4` plus daemon control support from `2f903777`; prior `5932f4b5` citation must be removed. Topic create/delete commits `cd7af534` and `1c08c27c` belong on threaded/topic surface card `10.031`, not lifecycle `10.033`.
- Media/file transfer is grounded in `187f9928` and `5a28dfe0`.
- Adapter/docs surface is grounded in `d474c47d`, `fb07a1f2`, `23192d1c`, `8b94c54a`, `dffe42c6`, `153f4082`, `a44bb69b`, `e75a6b09`.

## Planned edits

- Replace vague or unverified commit phrases:
  - `10.028`: replace `later fixes through a791d72a` with explicit later SDK/docs/test/resilience SHAs: `01868580`, `584a8efb`, `82c222bd`, `76bad3b7`, `06c15d72`, `d474c47d`, `fb07a1f2`, `8b94c54a`.
  - `10.031`: add topic lifecycle SHAs `cd7af534` and `1c08c27c` because they create/delete Telegram topics on connect/shutdown.
  - `10.033`: remove `5932f4b5` and `plus daemon-control commits`; cite only `92ef72a4` and `2f903777`, with a cross-card note that topic lifecycle belongs to `10.031`.
  - `10.035`: replace `0.7.x changelog/docs` with exact docs/changelog commits `153f4082` and `a44bb69b`.
- Add a `Phase 1A Hardening Note` section to exactly `10.028`, `10.031`, `10.033`, and `10.035`, recording the command family used and the source head.
- Do not touch non-Telegram 10.036+ cards in this phase.

## Verification

- `rg 'plus .*commits|0\.7\.x|5932f4b5|later fixes through' struct_har/chase/10.02{8,9}_*.md struct_har/chase/10.03{0,1,2,3,4,5}_*.md` must return no stale match.
- `rg -l "Phase 1A Hardening Note" struct_har/chase/10.028_gjc_chase_notifications_sdk.md struct_har/chase/10.031_gjc_chase_telegram_threaded_surface.md struct_har/chase/10.033_gjc_chase_telegram_session_lifecycle.md struct_har/chase/10.035_gjc_chase_notifications_adapters_docs.md | wc -l` must equal `4`.
- `git diff --check -- struct_har/chase/10.02* struct_har/chase/10.03* devlog/_plan/260628_chase_hardening_gjc_omp/10_phase1a_gjc_telegram_plan.md` must pass.
- Commit only this plan and touched Telegram chase cards.
