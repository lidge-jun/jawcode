# 040 — sol dispatch priority + 작업 템플릿

worker 동시 실행 수가 제한되면 model·security·auth 경로를 먼저 처리한다. 각 wave 안에서는 아래 순서를 유지하고, worker가 맡은 exact card path 밖으로 write scope를 넓히지 않는다.

## Wave 우선순위

### Wave 1 — P1

model/security/auth critical 순서이다.

GW3 → OW1 → OW2 → OW3 → GW2 → GW1

### Wave 2 — P2

feature/UX/infra 순서이다.

GW4 → GW5 → GW6 → OW4 → OW5 → OW6 → OW7 → OW9(D19)

### Wave 3 — P3

CI/docs/misc 순서이다.

GW7 → OW8 → OW9(D14/D16) → OW10

OW9는 D19를 Wave 2에서 먼저 작성하고 D14/D16을 Wave 3에서 이어서 작성한다. 이때도 세 card path는 OW9만 소유한다.

## Worker instructions template

```text
TASK: Assigned chase cluster cards를 작성한다.

READ-ONLY CONTEXT:
- devlog/_plan/260717_chase_pull_delta_tracking/
- assigned cluster manifest/detail files

ASSIGNMENT:
- Worker: {worker_id}
- Clusters: {cluster_ids}
- Commit hashes: {assigned_cluster_commit_lists}

WRITE SCOPE:
- {exact_card_file_paths}

QUALITY BAR:
- GJC: struct_har/chase/10.086_gjc_chase_tui_tmux_telegram_operator_ux.md
- OMP: struct_har/chase/20.050e_omp_chase_providers_usage_orchestration_misc.md

CONSTRAINTS:
- struct_har/chase/ 신규 card만 작성한다.
- 다른 worker의 card를 수정하지 않는다.
- MOC, README, 002_gap_inventory, model/ 폴더와 product code를 수정하지 않는다.
- write scope 확장이 필요하면 작업을 멈추고 main session에 보고한다.

EVIDENCE:
- 모든 cited hash에 git cat-file -e <hash>^{commit}을 실행한다.
- card convention header를 grep으로 확인한다.

RUNTIME:
- model: gpt-5.6-sol
- fork_context: true
```

## model/ folder update plan

card write phase가 끝난 뒤 main session이 아래 순서로 처리한다.

1. C02/C03/C11/C12/C13/C17과 D01-D05/D10/D17/D19 신규 card를 모두 읽는다.
2. `030_model_gjc_delta.md`와 `030_model_omp_delta.md`의 hash·영향 파일 교차 참조를 card 근거와 대조한다.
3. `struct_har/chase/model/001_model_provider_inventory.md`를 갱신한다.
4. `struct_har/chase/model/002_model_catalog_contract.md`를 갱신한다.
5. `struct_har/chase/model/003_provider_auth_flow.md`를 갱신한다.
6. `struct_har/chase/model/005_upstream_model_delta.md`와 reviewed-through 핀을 갱신한다.
7. 실제 코드 패치 전에는 `004_cross_project_patch_index.md`를 변경하지 않는다.

## 완료 체크리스트

- [ ] Wave 1 worker의 exact write scope를 확인한다.
- [ ] Wave 2 worker의 exact write scope를 확인한다.
- [ ] Wave 3 worker의 exact write scope를 확인한다.
- [ ] 모든 cited hash의 commit object 존재를 검증한다.
- [ ] 신규 card의 convention header를 검증한다.
- [ ] model 관련 card 완료 후 model/ 갱신 순서를 실행한다.
