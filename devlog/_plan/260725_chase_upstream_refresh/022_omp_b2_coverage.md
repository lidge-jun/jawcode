# 022 — OMP band 2 coverage: v17.0.8..v17.1.0

## Scope and result

- Source: read-only `devlog/_omp_chase/oh-my-pi`.
- Delta: `v17.0.8..v17.1.0` = **539** non-merge commits; `v17.0.9..v17.1.0` = **472**.
- Card-cited: **422** commits across 12 cards.
- Explicit no-card: **117** commits.
- Residual / overflow: **0**.
- Coverage: **539 = 422 cited + 117 no-card + 0 residual**.

## Card allocation

| card | commits | classification | bucket | theme |
| --- | ---: | --- | --- | --- |
| [20.101](../../../struct_har/chase/20.101_omp_chase_secret_placeholder_redaction.md) | 140 | adapt | C | Secret placeholder identity, regex redaction, replay, and collision safety |
| [20.102](../../../struct_har/chase/20.102_omp_chase_error_notifications_terminal_title.md) | 10 | adapt | A | Terminal error notification lifecycle and run-state title |
| [20.103](../../../struct_har/chase/20.103_omp_chase_workspace_roots_session_lifecycle.md) | 22 | adapt | C | Multi-root workspace context and session lifecycle integrity |
| [20.104](../../../struct_har/chase/20.104_omp_chase_task_todo_subagent_quiescence.md) | 20 | split | C | Task batches, blocked todos, async delivery, and subagent quiescence |
| [20.105](../../../struct_har/chase/20.105_omp_chase_providers_oauth_usage_fallback.md) | 63 | split | C | Provider catalog, OAuth pools, usage, and model fallback policy |
| [20.106](../../../struct_har/chase/20.106_omp_chase_prompt_cache_policy_benchmark.md) | 11 | adapt | C | Cross-provider prompt-cache policy and benchmark diagnostics |
| [20.107](../../../struct_har/chase/20.107_omp_chase_compaction_retry_history_resilience.md) | 18 | adapt | A | Compaction frame rescue, retry tails, and history resilience |
| [20.108](../../../struct_har/chase/20.108_omp_chase_mcp_rpc_acp_protocol_hardening.md) | 24 | adapt | C | MCP auth, RPC framing, and ACP late-start protocol hardening |
| [20.109](../../../struct_har/chase/20.109_omp_chase_tools_platform_runtime_hardening.md) | 37 | import | A | Bash, direnv, file tools, browser, DAP/LSP, and runtime hardening |
| [20.110](../../../struct_har/chase/20.110_omp_chase_advisor_hindsight_vibe_runtime.md) | 20 | track-only | B | Advisor redaction, Hindsight lifecycle, and persisted vibe runtime |
| [20.111](../../../struct_har/chase/20.111_omp_chase_tui_export_extensions_status.md) | 21 | adapt | C | TUI status, exports, extension loading, and visual-state compatibility |
| [20.112](../../../struct_har/chase/20.112_omp_chase_misc_runtime_quality.md) | 36 | evidence-fill | B | Remaining runtime correctness and bounded quality deltas |

## Explicit no-card hashes

| hash | no-card reason | source subject |
| --- | --- | --- |
| `1b00ed7c2e5f349bffa78c65392b67c589e7d87a` | docs/changelog | Document error notifications |
| `d960dc4552971d62be7cf4815db904fa22793020` | test-only | Cover friendly secret obfuscation |
| `068dce0ba6be41bf94cbf046966b7961d94eae76` | docs/changelog | Document friendly secret placeholders |
| `ac6e7f4b5613a70ae4f96ab6849b9ebd13d3ed38` | CI retry/repair | Fix coding-agent CI after main merge |
| `d3210f620a26a87498f5d44a3b8f1233b25bccbf` | CI retry/repair | Fix coding-agent CI after main merge |
| `8aa5eb1710fa007d8f2ae160eadae156063df075` | test-only | Fix Antigravity system prompt assertion |
| `e3e055813e8b0bd12f680bc6cfcaadd557906ada` | test-only | Fix Antigravity system prompt assertion |
| `e9d9eba33e0738d8a24791f3e792c5e94103a343` | test-only | Update secret redaction guidance assertion |
| `5d13717a1a0650bc87a5fc7abe7ba27dfa820c77` | CI retry/repair | Retry CI after runner timeout |
| `2911784a75213ffa68381bbdbaccab086135954f` | docs/changelog | docs(coding-agent): move friendlyName changelog entry to Unreleased |
| `c9ec5ae478aa8db763af6c2848ba45b99b58fe2b` | test-only | test(secrets): assert redaction by structure, not base-collidable substrings |
| `e182125bc4538210511e78947d42a50728158c93` | test-only | test(coding-agent): give Julia prelude tests cold-start timeout headroom |
| `5dce675713fc15fc5607f99f82d52dccfc1002a8` | docs/changelog | docs(changelog): move friendlyName entries to [Unreleased] |
| `b011b6f49ca522ade2e94980eb456f92a82e151d` | docs/changelog | docs(secrets): correct placeholder key path to agent dir |
| `8a577038fcf98d75f30d5988aff1693122b305f3` | chore/merge hygiene | chore(ci): rerun flaky linux test jobs |
| `4fbd7b1630c7c846c40ffd7e264b5db99ea15b4d` | test-only | test(coding-agent): trip snapcompact non-ASCII fallback via threshold compaction |
| `e22a4dad1a0dcfff4b739dc4845937307d07e1eb` | CI retry/repair | chore: re-trigger CI after unrelated flaky tui parallel test (issue #1962) |
| `67df01a3495a0006c0ea6e0377c4a3d7e9bb5800` | test-only | test(ai): fix stale empty-id tool-call test after malformed-id drop |
| `10a2227576d2b890cb28c486d2ba310fcaf70fea` | test-only | test(ai): stabilize pi-native stream timing |
| `46e397049f2a6ab0fd9b4f86530d02346476f129` | test-only | test(ai): stabilize pi-native stream timing |
| `1b897aff6b360f40583da31d787b191f472caca9` | test-only | test(ai): avoid fake timer stream coverage |
| `8ccb560587ed624fa2b1a3af56e4f25a151023f5` | test-only | test(secrets): expect obfuscated assistant replay state |
| `a209e5283db8066ec44d39ff1e1fccc43ececba3` | test-only | test(plan): expect durable approved-plan reference |
| `8abbe550b2f73322d41dd52de9b64e2b9559e602` | test-only | test(ai): match responses replay id stripping |
| `422588197aa4b2eb1546ebd6d3d041c99911be49` | test-only | test(ai): align azure replay-history msg id expectations with upstream fix |
| `662d9138bc8dacc179444576b008418240e31e77` | style-only | style(coding-agent): sort worktree test imports |
| `9ce2bc6774ac3edd84b3ca141d5da86563cfa4f3` | test-only | test(coding-agent): widen timeout for clone tests exercising real fs work |
| `2882d67fda35d342d9c6b1f8fffae7ba16a64904` | test-only | test(ai): align azure replay assertions with id-preserving fallback |
| `c1ea6ca7dc975d205cb3f6fac2c679fbbfb7c88a` | test-only | test: fix azure msg-id preservation and retry-diagnostics log shape |
| `c25de0a295e1c3d35a0db97b78ba78c7c3136551` | test-only | test(coding-agent): fix real hang risk in git clone timeout tests |
| `8ec1c5aa84f118aab3eb9db72e9df4a31e9ae193` | test-only | test(coding-agent): raise timeout on slow git subprocess safety tests |
| `e7f3f2b79686b53fd7767d486244c5094036dfc2` | test-only | test(tools): migrate multi-path-missing test to single path argument |
| `49e848929044c800d33161fcc58da41cd9dd676d` | test-only | test(tools): migrate remaining legacy paths array call sites |
| `21e2f361a85d245a9bef48c7fa4b59331aef6a3b` | CI retry/repair | chore: retrigger CI |
| `fa260a6dfdbff92febbf96477ebef7e43d4cabfc` | test-only | test(coding-agent): align loader recovery status fake |
| `1d678514776b90ff041f90acb30d78cdf2f126ee` | style-only | style(rust): apply process formatting |
| `4bbcddfb22fe2e99e03aabefd7101edd93ef5a5a` | test-only | test: align merged fixture contracts |
| `5e88b241627618cef5fdc7f4477d82446b579a4b` | test-only | test(coding-agent): cover terminal title extension-override precedence |
| `5615f1ca8ad95563635c9003ee52af8d645d1934` | test-only | test(task): use batch parameters in async fallback test |
| `2bb570f2651988bcd08b54935ecc400ce87e6dfb` | style-only | style(natives): format merged grep source |
| `d6567528bdfc35a83bd0c58ac7cf32f6cdfaa7e3` | docs/changelog | docs(coding-agent): move error.notify changelog entries to Unreleased |
| `7a2944ded7f8860268a680c4d6080f609bbc705c` | test-only | test(coding-agent): init global Settings before renderInitialMessages calls |
| `18ca86746d2e1ee771206717d625bbfaf188c26e` | docs/changelog | docs(coding-agent): drop duplicate serverSideFallback/softRequestBudgetNotice bullets |
| `6829251768a9ac53a0843cf33e0ff45a03f8512e` | test-only | test(coding-agent): raise browser-tab-evaluate timeout for CI |
| `e817507cc8f2d1252f841cb3aa0994d2cc6cbd9e` | docs/changelog | docs(coding-agent): move error.notify bullets back to Unreleased |
| `6825354683b1905ffc1fa65b04a795a97160a5cb` | CI retry/repair | chore: rerun CI after flaky timeout |
| `63ece0218a27dcd08de1a6715f9db4ab5dca11dc` | test-only | test(coding-agent): repair stale CI contracts |
| `05667ae02cf1a4f372491e18c9807469a42a4aa1` | test-only | test(coding-agent): align CI fixtures |
| `859bb1ff45972b9ec58149c4d214fad749b812a1` | test-only | test(coding-agent): complete executor fixtures |
| `95a0a1e2a51c4a7ea59ee113470bac825e7a5c63` | docs/changelog | docs(coding-agent): preserve release changelog history |
| `79d3947e8dd1e59db95b58670cd2939dc6b3955f` | test-only | test(eval): match spawn policy description |
| `486e2ceb90383d2047e092566baeb5cbd358a3c5` | docs/changelog | docs: note wrapped oauth link fix |
| `e51b848043e7d55595385aace3739b04cffa5e24` | docs/changelog | docs(omp): document webSearch fallback cascade in changelog |
| `cfe2ebd7a1f5d0203b6e56d6e7086b671e1b398f` | docs/changelog | docs(ai): moved SuperGrok usage changelog to Unreleased |
| `6340b9a52ec68dd33877a399129474ee74d74326` | CI retry/repair | chore: re-trigger CI after unrelated workspace-fast flake |
| `e210a85c400e89165b70e8d62646e1c64208b7a5` | docs/changelog | docs(ai): moved SuperGrok usage changelog to Unreleased |
| `775b185f2f8b8ccace667e51edea2699583f93cd` | docs/changelog | docs(ai): move SuperGrok usage changelog to Unreleased |
| `1dd1ec65d0bf3dad32dcd23e6235af13d05096ac` | docs/changelog | docs(ai): add SuperGrok usage to Unreleased |
| `27172e06f0b041f6374d89cbd3e7c97846ea2ce7` | docs/changelog | docs(contributing): noted open-pr policy is a temporary trial |
| `061aeb1d0746a8f928f76f60b8b41194fa8f6710` | docs/changelog | docs(contributing): noted open-pr policy is a temporary trial |
| `a81e26157c0cd7c81d9c2ad1558ddea623dcf4ef` | docs/changelog | docs(readme): moved open-pr trial notice above install section |
| `9b3820e1e5cd987bb81e44f3615f8be2380ceb61` | docs/changelog | docs(changelog): move Hindsight fix under unreleased |
| `7c7726645a9905d7171fce63a893310a58a06650` | test-only | test(ai): isolate Synthetic usage fixture |
| `10e1ba911c162106bb95b618210bfff8d82570d6` | test-only | test(task): cover model override precedence |
| `c43f5d72c85cfc987af09431052f36505200e9b2` | docs/changelog | docs(coding-agent): add changelog entry for Firecrawl keyless mode (#4332) |
| `3566b78817e030dc788eeb198cc9921715dc0a9c` | test-only | test(internal-urls): cover hasResolvableTranscript availability contract |
| `d109f389d8496bba37a48f70cf63fd5e7149e82d` | docs/changelog | docs(coding-agent): move format-on-write changelog entry to Unreleased |
| `ef8643547e3861d9c90decdb8f111a01d00f11b2` | docs/changelog | docs: normalized changelog entries under [Unreleased] after PR merges |
| `8205d3ee3171da5a4e9ea4e4e4005d2c8b2f0c64` | style-only | style: applied biome formatting to merged fix commits |
| `a3687ef4441e9cbc38c1bbe32eacc3241752dc13` | chore/merge hygiene | chore: removed stray node_modules symlink committed during PR integration |
| `42d705f4a7ef9834b3a3d0e97123d8d09532259c` | test-only | test: use transcript-mode session context in model persistence assertions |
| `0babb55fbd53987b2463ec18479bf2ecccf3cef3` | CI retry/repair | ci: retried test chunks when bun crashes due to GC bugs |
| `639bac596d94b5993349f3f6696176cb2bf9b5d3` | version bump | chore: bump version to 17.0.9 |
| `03686ba32f0c0a28537f9a521ec14f43faff6095` | docs/changelog | docs: place wrapped oauth link changelog under Unreleased Fixed |
| `5b3cfb4b5f6fbecef3f48b763faba1900dde9330` | docs/changelog | docs: keep wrapped oauth link note under Unreleased |
| `ffd0ea727f997bc021dc7c70dfea121edf45cb28` | docs/changelog | chore: promoted merged changelog entries to unreleased |
| `130578acedf13576d0bb61b8622fcdeab58c9c98` | chore/merge hygiene | chore: bump models |
| `30a0d67567f1ae4be1c4415491fca15789c0a046` | chore/merge hygiene | removed stray watermark comment markers from usage provider |
| `66f132a6e2bb9b51ef77d3c5cf0b95769797b7de` | docs/changelog | docs(changelog): recorded jj-aware statusline git segment under unreleased |
| `1d2779cf7ca89fae4f2664c1a58a839b34e14b95` | docs/changelog | docs(coding-agent): added changelog entry for run-state terminal title |
| `2da45f9f9a0cf8d0febec2a3799f5ba6fe32386d` | chore/merge hygiene | chore: aligned blocked-todo test, added robomp sandbox scaffolding |
| `33f3cea9cee83375752453a188dc51e27707ab03` | chore/merge hygiene | chore(robomp): carried over sandbox test from shared worktree |
| `e50d67d4714718925e5ad6f4ea710586d9cd7af4` | chore/merge hygiene | chore(coding-agent): dropped drive-by prompt and spinner drift unrelated to error.notify |
| `43cc7f42aedbca687b49e27a0efa11f44e9dffad` | test-only | test: added flushPendingCommandOutput to event-controller ctx fakes |
| `424458e99dace10dc1ea8cead69840d9fbf20ee9` | chore/merge hygiene | chore(secrets): dropped drive-by changes unrelated to secret placeholders |
| `2cccaedbecabb8f5227f0f6dab07f09b66dd8f4a` | docs/changelog | chore: promoted merged changelog entries to unreleased |
| `3a62af9dc03ab3403fd5175fc20fc455fa3fbdaa` | docs/changelog | chore: promoted vibe persistence changelog entry to unreleased |
| `e5c33ad0fae450ed824ff2a1c307e595499d7633` | docs/changelog | chore: promoted xai web search changelog entry to unreleased |
| `c2eeaa640d95fd919dd3ca0696b0c9f675134cb1` | docs/changelog | docs: added central utilities guidance and merge commit conventions |
| `33ecf0b3aedba5e3c3f2e497981278018a64f590` | docs/changelog | docs(changelog): note DAP unix socket connect hang fix |
| `3e445dccd95dd80a2e60b4dc8f7ea2324cf85f9e` | test-only | test(mcp): use Promise.withResolvers in hanging-fetch helper per AGENTS.md |
| `ffc4cec4e771ac6dbc14969265c659dd95e8d9db` | test-only | test(ai): occupy 127.0.0.1 explicitly in the port-fallback blocker |
| `bebcc8003f02c877ab99e20555bf1b9b12d61c70` | test-only | test(robomp): cover issues opened/reopened -> triage_issue dispatch mapping |
| `8e895f6c9687c055a1dfee5240dfce2d79c7a4f4` | docs/changelog | docs(gateway): clarify Vercel cache TTL cap |
| `9c35eb225ab6e79e8b9cfcf1fc0fb7c7c6525b79` | docs/changelog | chore(changelog): normalized unreleased sections after merges |
| `69056ac7f2dde3c95f1a428d2d92fce77b20d715` | docs/changelog | chore(changelog): restored released sections and added missing tui entry |
| `b326e79e6ec6cf695aa6c73069256453c5059e8f` | chore/merge hygiene | chore: applied formatter and dropped unused catch binding from merged lsp fix |
| `944ff76b773b9e5d455b2d4f4112a14d07612a95` | test-only | test(openai): cover future cache boundaries |
| `48be4674e96108c4203b27998a7376238fc1adf9` | docs/changelog | docs: document /vibe mode and /fresh command |
| `a2044703b03d34a73127f613b6fefc1f71ff3031` | test-only | test(extensions): write service-tier fixture asynchronously |
| `68193c82409385ab6b5e758a0e223e50b4a50f7f` | test-only | test(extensibility): drop dynamic import from #6449 regression test |
| `6cd742bf92a728cae59d8bf4685034c1c7a7f57a` | docs/changelog | docs(changelog): noted xdev prompt-doc modes under Unreleased |
| `c127cbef18f139b1adfbd540733518efeb5c5c66` | test-only | test(ai): cover concurrent usage windows |
| `2810c4145204f37c5713578099f2c2216c2b2c33` | docs/changelog | docs(coding-agent): reworded omfg amend-cancel changelog to state the bug |
| `cce87f7e601cac8efb4ba18f1119a69b7e7fb325` | test-only | test: replaced banned Promise executor with withResolvers in 4085 repro |
| `81254e45a1989c8f9f06ab8d2a3262f34149791f` | docs/changelog | fixed changelog markdown spacing before Added heading |
| `99fa84e2fa20f9d21eb3646f635eab18f07f7101` | docs/changelog | docs(coding-agent): merged duplicate Added changelog heading |
| `2fce6c1d8ed6d514f344d3d7787ff5ef1456d052` | docs/changelog | docs: normalized changelog headings after merges |
| `fc3e9970c752aff2f83be89e648caa79e9273704` | style-only | style: organized imports in session modules after fallback merge |
| `f1875dc45a8217f1a6f8b8c65ff9581b9396c469` | style-only | style: applied biome fixes to live module |
| `1e1d2e91ea4c1a040f4fc560979034955abc5bb7` | style-only | style: applied biome formatting |
| `6cf5b2539911c9d03d19ae8b608a84d1b3793327` | docs/changelog | chore: update changelogs |
| `0868861abd3285aded57fe9b341a6e65d6475a5c` | test-only | test(eval): matched allowed-agents wording in tool description |
| `995814b499d12bcfec3147b6420862b3d96ce67a` | test-only | test(coding-agent): stubbed agent.continue in test to isolate queue observation |
| `5e63cc56966532fef13d17fd3ec678db2cc9219a` | version bump | chore: bump version to 17.1.0 |
| `031d687325cd5166e363c6c668ac6620b5366642` | test-only | test(coding-agent): aligned transcript compaction test with superseded-summary elision |
| `4e5cb4d40059bdcf6d09c42333cb6ce6f8ff4450` | test-only | test(coding-agent): fixed environment-sensitive and stale-trigger test failures |

## Hash-set proof

```bash
git -C devlog/_omp_chase/oh-my-pi rev-list --no-merges v17.0.8..v17.1.0 | sort -u > /tmp/omp-b2-delta
rg -No '\\`[0-9a-f]{9}\\`' struct_har/chase/20.10[1-9]_*.md struct_har/chase/20.11[0-9]_*.md | tr -d '\\`' | while read -r h; do git -C devlog/_omp_chase/oh-my-pi rev-parse "$h"; done | sort -u > /tmp/omp-b2-cited
sed -n '/## Explicit no-card hashes/,/## Hash-set proof/p' devlog/_plan/260725_chase_upstream_refresh/022_omp_b2_coverage.md | rg -o '[0-9a-f]{40}' | sort -u > /tmp/omp-b2-no-card
comm -23 /tmp/omp-b2-delta <(sort -u /tmp/omp-b2-cited /tmp/omp-b2-no-card)
```

Observed proof:

```text
delta_count=539
cited_count=422
no_card_count=117
set_diff_count=0
set_diff=[]
```

No numbers beyond 20.119 were used. **RESIDUAL: none.**

