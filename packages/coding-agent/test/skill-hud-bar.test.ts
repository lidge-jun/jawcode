import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { renderSkillHudBar } from "../src/modes/components/skill-hud/render";
import { STATUS_LINE_PRESETS } from "../src/modes/components/status-line/presets";
import { readSessionStrictSkillActiveState } from "../src/skill-state/active-state";

function visibleWidth(text: string): number {
	return Bun.stripANSI(text).length;
}

async function withTempCwd(fn: (cwd: string) => Promise<void>): Promise<void> {
	const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-skill-hud-"));
	try {
		await fn(cwd);
	} finally {
		await fs.rm(cwd, { recursive: true, force: true });
	}
}

describe("skill HUD bar renderer", () => {
	it("omits the bar when no active skills exist", () => {
		expect(renderSkillHudBar([], 80)).toBeNull();
	});

	it("renders active skill and phase compactly", () => {
		const rendered = Bun.stripANSI(renderSkillHudBar([{ skill: "jaw-interview", phase: "intent-first" }], 80) ?? "");
		expect(rendered).toContain("hud");
		expect(rendered).toContain("jaw-interview:intent-first");
	});

	it("sanitizes dynamic text and truncates to width", () => {
		const rendered = renderSkillHudBar(
			[{ skill: "team\n\u001b[31mred", phase: "running\twith-a-very-long-phase-name" }],
			30,
		);
		expect(rendered).not.toBeNull();
		expect(Bun.stripANSI(rendered ?? "")).not.toContain("\n");
		expect(Bun.stripANSI(rendered ?? "")).not.toContain("\t");
		expect(visibleWidth(rendered ?? "")).toBeLessThanOrEqual(30);
	});

	it("is included as a native status-line rail without changing preset segments", () => {
		expect(STATUS_LINE_PRESETS.default.leftSegments).toEqual(["model", "mode", "pabcd", "git", "pr", "path"]);
		const rendered = Bun.stripANSI(renderSkillHudBar([{ skill: "team", phase: "running" }], 100) ?? "");
		expect(rendered).toContain("hud team:running");
	});

	it("omits inactive entries so statusLine.showSkillHud can gate the rail", () => {
		expect(renderSkillHudBar([{ skill: "team", phase: "running", active: false }], 100)).toBeNull();
	});
	it("renders normalized HUD chips in priority order with stale warning", () => {
		const rendered = Bun.stripANSI(
			renderSkillHudBar(
				[
					{
						skill: "plan",
						phase: "planning",
						stale: true,
						hud: {
							version: 1,
							summary: "consensus",
							chips: [
								{ label: "verdict", value: "ITERATE", priority: 40, severity: "warning" },
								{ label: "stage", value: "critic", priority: 10 },
							],
						},
					},
				],
				120,
			) ?? "",
		);
		expect(rendered).toContain("plan:planning consensus warn:stale stage=critic warn:verdict=ITERATE");
	});

	it("sanitizes HUD chips and keeps constrained rendering within width", () => {
		const rendered = renderSkillHudBar(
			[
				{
					skill: "team",
					phase: "running",
					hud: {
						version: 1,
						summary: "workers\nok",
						chips: [{ label: "latest\t", value: "a-very-long-message-with-\u001b[31mansi" }],
					},
				},
			],
			35,
		);
		expect(rendered).not.toBeNull();
		expect(Bun.stripANSI(rendered ?? "")).not.toContain("\n");
		expect(Bun.stripANSI(rendered ?? "")).not.toContain("\t");
		expect(visibleWidth(rendered ?? "")).toBeLessThanOrEqual(35);
	});
	it("renders gate and receipt status from canonical state entries", () => {
		const rendered = Bun.stripANSI(
			renderSkillHudBar(
				[
					{
						skill: "jaw-interview",
						phase: "interviewing",
						hud: {
							version: 1,
							chips: [
								{ label: "gate", value: "approval-required", priority: 5, severity: "warning" },
								{ label: "blocked", value: "execution approval missing", priority: 10, severity: "blocked" },
								{ label: "next", value: "ask user for approval", priority: 20 },
							],
						},
						receipt: {
							version: 1,
							skill: "jaw-interview",
							owner: "jwc-state-cli",
							command: "jwc state jaw-interview write",
							state_path: ".jwc/state/skill-active-state.json",
							storage_path: ".jwc/state/jaw-interview-state.json",
							mutated_at: new Date().toISOString(),
							fresh_until: new Date(Date.now() + 60_000).toISOString(),
							status: "fresh",
							mutation_id: "test",
						},
					},
				],
				160,
			) ?? "",
		);
		expect(rendered).toContain("jaw-interview:interviewing");
		expect(rendered).toContain("warn:gate=approval-required");
		expect(rendered).toContain("block:blocked=execution approval missing");
		expect(rendered).toContain("next=ask user for approval");
		expect(rendered).toContain("receipt=fresh");
	});

	it("shows only the callee after a D->R handoff (caller demoted to inactive entry, HUD filters it out)", () => {
		// After `jwc state jaw-interview handoff --to plan`, the caller
		// entry is preserved in active_skills with active:false and handoff_to
		// lineage for audit; the HUD filters on active!==false so only plan
		// appears in the rendered bar.
		const rendered = Bun.stripANSI(renderSkillHudBar([{ skill: "plan", phase: "planning" }], 80) ?? "");
		expect(rendered).toContain("plan:planning");
		expect(rendered).not.toContain("jaw-interview");
	});

	it("shows only the callee after an R->U handoff", () => {
		const rendered = Bun.stripANSI(renderSkillHudBar([{ skill: "goal", phase: "goal-planning" }], 80) ?? "");
		expect(rendered).toContain("goal:goal-planning");
		expect(rendered).not.toContain("plan:");
	});

	it("shows only the callee after a backward U->R handoff", () => {
		const rendered = Bun.stripANSI(renderSkillHudBar([{ skill: "plan", phase: "planning" }], 80) ?? "");
		expect(rendered).toContain("plan:planning");
		expect(rendered).not.toContain("goal");
	});

	it("collapses the planning pipeline to the most-recently-activated stage", () => {
		// `jwc plan` then `jwc goal` activate their own rows without
		// running the handoff verb, so both arrive at the HUD active. Only the
		// current (newest) stage should render.
		const rendered = Bun.stripANSI(
			renderSkillHudBar(
				[
					{ skill: "plan", phase: "final", active: true, updated_at: "2026-01-01T00:00:00.000Z" },
					{ skill: "goal", phase: "executing", active: true, updated_at: "2026-01-01T00:05:00.000Z" },
				],
				80,
			) ?? "",
		);
		expect(rendered).toContain("goal:executing");
		expect(rendered).not.toContain("plan:");
	});

	it("keeps team alongside goal since team is not part of the planning pipeline", () => {
		const rendered = Bun.stripANSI(
			renderSkillHudBar(
				[
					{ skill: "goal", phase: "executing", active: true, updated_at: "2026-01-01T00:00:00.000Z" },
					{ skill: "team", phase: "running", active: true, updated_at: "2026-01-01T00:05:00.000Z" },
				],
				80,
			) ?? "",
		);
		expect(rendered).toContain("goal:executing");
		expect(rendered).toContain("team:running");
	});

	it("collapses the pipeline NaN-safely: a valid timestamp wins over a missing one regardless of order", () => {
		const entries = [
			{ skill: "plan", phase: "final", active: true },
			{ skill: "goal", phase: "executing", active: true, updated_at: "2026-01-01T00:05:00.000Z" },
		];
		const forward = Bun.stripANSI(renderSkillHudBar(entries, 80) ?? "");
		const reversed = Bun.stripANSI(renderSkillHudBar([...entries].reverse(), 80) ?? "");
		expect(forward).toContain("goal:executing");
		expect(forward).not.toContain("plan:");
		expect(reversed).toContain("goal:executing");
		expect(reversed).not.toContain("plan:");
	});

	it("renders a single deterministic pipeline stage when no entry has a timestamp", () => {
		const rendered = Bun.stripANSI(
			renderSkillHudBar(
				[
					{ skill: "plan", phase: "final", active: true },
					{ skill: "goal", phase: "executing", active: true },
				],
				80,
			) ?? "",
		);
		// Exactly one planning-pipeline chip survives the collapse.
		const chips = (rendered.split("hud")[1] ?? "").split("+").filter(part => /plan|goal/.test(part));
		expect(chips).toHaveLength(1);
	});

	it("does not emit warn:stale for an entry without explicit stale flag (no 24h derivation)", () => {
		// Pre-G003 the renderer relied on withDerivedStale to flag aged entries.
		// Post-G003, only explicit `entry.stale === true` produces the chip.
		const rendered = Bun.stripANSI(
			renderSkillHudBar([{ skill: "team", phase: "running", updated_at: "2000-01-01T00:00:00.000Z" }], 80) ?? "",
		);
		expect(rendered).toContain("team:running");
		expect(rendered).not.toContain("warn:stale");
	});

	it("renders from strict session active-state instead of stale root HUD entries", async () => {
		await withTempCwd(async cwd => {
			const stateDir = path.join(cwd, ".jwc", "state");
			await fs.mkdir(stateDir, { recursive: true });
			await fs.writeFile(
				path.join(stateDir, "skill-active-state.json"),
				JSON.stringify({
					version: 1,
					active: true,
					skill: "jaw-interview",
					active_skills: [{ skill: "jaw-interview", phase: "root-only", active: true }],
				}),
			);

			const fresh = await readSessionStrictSkillActiveState(cwd, "fresh-session");
			expect(renderSkillHudBar(fresh?.active_skills ?? [], 100)).toBeNull();

			const scopedDir = path.join(stateDir, "sessions", "fresh-session");
			await fs.mkdir(scopedDir, { recursive: true });
			await fs.writeFile(
				path.join(scopedDir, "skill-active-state.json"),
				JSON.stringify({
					version: 1,
					active: true,
					skill: "team",
					active_skills: [{ skill: "team", phase: "scoped", active: true, session_id: "fresh-session" }],
				}),
			);

			const scoped = await readSessionStrictSkillActiveState(cwd, "fresh-session");
			const rendered = Bun.stripANSI(renderSkillHudBar(scoped?.active_skills ?? [], 100) ?? "");
			expect(rendered).toContain("team:scoped");
			expect(rendered).not.toContain("root-only");
		});
	});
});

describe("details rail rendering (99.00.03 P0-2)", () => {
	it("renders hud.details after chips (interview dimension gauges)", () => {
		const rendered = Bun.stripANSI(
			renderSkillHudBar(
				[
					{
						skill: "jaw-interview",
						phase: "interviewing",
						hud: {
							version: 1,
							chips: [{ label: "round", value: "2", priority: 30 }],
							details: [{ label: "dims", value: "G▰▰▰ C▰▱▱ S▰▰▱ O▱▱▱", priority: 40 }],
						},
					},
				],
				160,
			) ?? "",
		);
		expect(rendered).toContain("round=2");
		expect(rendered).toContain("dims=G▰▰▰ C▰▱▱ S▰▰▱ O▱▱▱");
	});

	it("width truncation drops details before chips", () => {
		const rendered = Bun.stripANSI(
			renderSkillHudBar(
				[
					{
						skill: "jaw-interview",
						phase: "interviewing",
						hud: {
							version: 1,
							chips: [{ label: "round", value: "2", priority: 30 }],
							details: [{ label: "dims", value: "G▰▰▰ C▰▱▱ S▰▰▱ O▱▱▱", priority: 40 }],
						},
					},
				],
				42,
			) ?? "",
		);
		expect(rendered).toContain("round=2");
		expect(rendered).not.toContain("O▱▱▱");
	});
});
