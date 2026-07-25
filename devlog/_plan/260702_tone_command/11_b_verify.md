DONE

B-stage read-only verification of commits 5de9a79 (feat) + 2d5ba0c (docs) against plan a-r2. Verifier model: openai/gpt-5.5:high (사용자 지시 — 감사/검증 렌즈 gpt-5.5 고정).

Checklist:
1. Prompt presets: PASS. All 5 files exist and are imported by system-prompt.ts. Each file is English-primary with optional Korean nuance and the common tail clause as the final content line: tone-sarcastic.md:1-4, tone-savage.md:1-4, tone-deadpan.md:1-4, tone-hype.md:1-4, tone-uhehe.md:1-4. system-prompt.ts imports the five concrete paths at packages/coding-agent/src/system-prompt.ts:14-18.
2. settings-schema.ts: PASS. identity.vibe description disambiguated (281-287); identity.tone enum + identity.toneCustom after identity.language (290-317); SettingValue default-undefined enum branch before the generic enum branch (3102-3115).
3. system-prompt.ts: PASS. Imports 14-18; TONE_PRESETS 303-310; tone/toneCustom read inside try 325-331; ARCH-B1 guarded toneBody 336; null-gate includes toneBody 337; ## Tone after Vibe and before language 346-360.
4. builtin-registry.ts: PASS. Helpers 48-71; /identity union + 2 rows 607-624; /tone spec 8 subcommands, allowArgs, handle-only (no handleTui) 1013-1073; first-token-only lowercase dispatch 1033-1038; off/custom/preset/bogus branches 1039-1070 with notifyConfigChanged after mutations; TUI handle delegation 2007-2019, notifyConfigChanged forwarding 2048-2051.
5. Tests: PASS. Six tone cases at test/system-prompt-identity.test.ts:88-95, 97-104, 106-114, 116-128 (vibe<tone<language ordering), 130-152 (diff-0), 154-170 (config round-trip, no null resurrection).
6. Schema/docs/commits: PASS. config.schema.json 40-62 tone additions only; CHANGELOG:3-5; fork-delta NEW row 31-40 + 3 HARD-EDIT rows 148-150; feat commit carries all 8 Fork-Delta trailers; docs commit adds plan artifacts.
7. Integration/static consistency: PASS. Target paths clean vs HEAD (2d5ba0c, 5de9a79 ancestor); no stale "Tone and personality lines" wording; identity.tone references confined to expected surfaces.

Issues: none.

Main-session gate evidence (run before verification): bun test system-prompt-identity → 11 pass/0 fail; packages/coding-agent bun run check (biome+tsgo) clean; root bun run check:ts (incl. check:schemas) green; live surface script (status/sarcastic/custom-inline/custom-noargs/off/bogus + /identity + config.yml no-null-resurrection) all pass.
