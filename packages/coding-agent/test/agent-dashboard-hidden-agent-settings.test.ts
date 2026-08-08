/**
 * The agent dashboard rebuilds `task.disabledAgents` and
 * `task.agentModelOverrides` from its own list of agents, but that list is
 * filtered by `filterVisibleAgents` and therefore excludes every `hide: true`
 * definition. Rebuilding wholesale wiped the persisted state of agents the
 * user was never shown, and both keys have live consumers in `task/index.ts`,
 * so the wipe silently re-enabled a disabled agent and reverted its model.
 *
 * These drive a real dashboard through real keystrokes against an isolated
 * Settings, and pair every preservation case with a deletion control so the
 * fix cannot pass by simply never removing anything.
 */
import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Settings } from "@jawcode-dev/coding-agent/config/settings";
import { AgentDashboard } from "@jawcode-dev/coding-agent/modes/components/agent-dashboard";
import { initTheme } from "@jawcode-dev/coding-agent/modes/theme/theme";

const tempDirs: string[] = [];

beforeAll(async () => {
	// The dashboard builds a real TUI layout during create().
	await initTheme();
});

afterEach(async () => {
	// Swept here rather than per-call: bun kills the runner on failure and a
	// local `finally` would not run.
	for (const dir of tempDirs.splice(0)) {
		await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
	}
});

/**
 * A project with two visible agents. `reviewer`, `explore`, `plan` and `task`
 * are bundled with `hide: true`, so they are discoverable but never listed.
 */
async function projectWithVisibleAgents(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-dashboard-"));
	tempDirs.push(dir);
	const agentsDir = path.join(dir, ".jwc", "agents");
	await fs.mkdir(agentsDir, { recursive: true });
	for (const name of ["alpha", "beta"]) {
		await Bun.write(
			path.join(agentsDir, `${name}.md`),
			`---\nname: ${name}\ndescription: visible test agent ${name}\n---\n\nBody.\n`,
		);
	}
	return dir;
}

async function dashboardFor(cwd: string, settings: Settings): Promise<AgentDashboard> {
	return AgentDashboard.create(cwd, settings, 40);
}

/**
 * Narrow the list to exactly one agent using the dashboard's own search box,
 * which leaves the selection on it. Typing the name is far less brittle than
 * scraping the rendered rows for a cursor glyph.
 */
function selectByName(dashboard: AgentDashboard, name: string): void {
	for (const ch of name) dashboard.handleInput(ch);
}

describe("agent dashboard does not wipe settings for agents it never shows", () => {
	it("keeps a hidden agent disabled when a visible agent is toggled", async () => {
		const cwd = await projectWithVisibleAgents();
		const settings = Settings.isolated();
		settings.set("task.disabledAgents", ["reviewer"]);

		const dashboard = await dashboardFor(cwd, settings);
		selectByName(dashboard, "alpha");
		dashboard.handleInput(" ");

		const disabled = settings.get("task.disabledAgents");
		expect(disabled).toContain("reviewer");
		expect(disabled).toContain("alpha");
	});

	it("still removes a visible agent when it is re-enabled", async () => {
		// Control: a fix that merely never deletes would leave `alpha` behind.
		const cwd = await projectWithVisibleAgents();
		const settings = Settings.isolated();
		settings.set("task.disabledAgents", ["reviewer", "alpha"]);

		const dashboard = await dashboardFor(cwd, settings);
		selectByName(dashboard, "alpha");
		dashboard.handleInput(" ");

		const disabled = settings.get("task.disabledAgents");
		expect(disabled).not.toContain("alpha");
		expect(disabled).toContain("reviewer");
	});

	it("keeps a hidden agent's model override when a visible override is edited", async () => {
		const cwd = await projectWithVisibleAgents();
		const settings = Settings.isolated();
		settings.set("task.agentModelOverrides", { reviewer: "anthropic/claude-sonnet-4-6" });

		const dashboard = await dashboardFor(cwd, settings);
		selectByName(dashboard, "alpha");
		dashboard.handleInput("\n");
		for (const ch of "openai/gpt-5.6") dashboard.handleInput(ch);
		dashboard.handleInput("\n");

		const overrides = settings.get("task.agentModelOverrides");
		expect(overrides.reviewer).toBe("anthropic/claude-sonnet-4-6");
		expect(overrides.alpha).toBe("openai/gpt-5.6");
	});

	it("still clears a visible agent's override when it is blanked", async () => {
		// Control for the override half.
		const cwd = await projectWithVisibleAgents();
		const settings = Settings.isolated();
		settings.set("task.agentModelOverrides", {
			reviewer: "anthropic/claude-sonnet-4-6",
			alpha: "openai/gpt-5.6",
		});

		const dashboard = await dashboardFor(cwd, settings);
		selectByName(dashboard, "alpha");
		dashboard.handleInput("\n");
		// ctrl+k clears to line end. `#beginModelEdit` prefills via `setValue`,
		// which leaves the cursor at position 0, so a delete-to-line-START would
		// remove nothing.
		dashboard.handleInput("\u000b");
		dashboard.handleInput("\n");

		const overrides = settings.get("task.agentModelOverrides");
		expect(overrides.alpha).toBeUndefined();
		expect(overrides.reviewer).toBe("anthropic/claude-sonnet-4-6");
	});

	it("keeps an entry for an agent that is not discoverable at all", async () => {
		// A plugin root that failed to load looks exactly like a deleted agent.
		// Absence from one discovery pass is not a decision to forget the setting.
		const cwd = await projectWithVisibleAgents();
		const settings = Settings.isolated();
		settings.set("task.disabledAgents", ["agent-from-a-plugin-that-did-not-load"]);
		settings.set("task.agentModelOverrides", { "agent-from-a-plugin-that-did-not-load": "openai/gpt-5.6" });

		const dashboard = await dashboardFor(cwd, settings);
		selectByName(dashboard, "alpha");
		dashboard.handleInput(" ");

		expect(settings.get("task.disabledAgents")).toContain("agent-from-a-plugin-that-did-not-load");
		expect(settings.get("task.agentModelOverrides")["agent-from-a-plugin-that-did-not-load"]).toBe("openai/gpt-5.6");
	});

	it("does not promote a hidden agent's session-only runtime override into persisted settings", async () => {
		// Model profiles install overrides through `override()`, which is a
		// runtime layer that `get()` merges but `set()` must never write back.
		// Preserving from the merged view would persist a profile's choices the
		// first time anything on this screen is touched.
		//
		// Scope note: this pins the unmanaged/hidden half, which is what the
		// preservation path owns. A VISIBLE agent's runtime override is still
		// promoted, because `#reloadData` seeds the row from the merged view and
		// the persist path writes the row back. That is a separate pre-existing
		// defect needing a product decision (should this screen edit the global
		// layer, or the effective one?) and is tracked on card 20.082.
		const cwd = await projectWithVisibleAgents();
		const settings = Settings.isolated();
		settings.set("task.agentModelOverrides", { reviewer: "anthropic/claude-sonnet-4-6" });
		settings.override("task.agentModelOverrides", {
			reviewer: "anthropic/claude-sonnet-4-6",
			// `explore` is hide:true, so it is never listed on this screen.
			explore: "session-only/from-a-profile",
		});

		const dashboard = await dashboardFor(cwd, settings);
		selectByName(dashboard, "alpha");
		dashboard.handleInput("\n");
		for (const ch of "openai/gpt-5.6") dashboard.handleInput(ch);
		dashboard.handleInput("\n");

		const persisted = settings.getGlobal("task.agentModelOverrides") ?? {};
		expect(persisted.explore).toBeUndefined();
		expect(persisted.reviewer).toBe("anthropic/claude-sonnet-4-6");
		expect(persisted.alpha).toBe("openai/gpt-5.6");
	});

	it("survives repeated edits without an intervening reload", async () => {
		const cwd = await projectWithVisibleAgents();
		const settings = Settings.isolated();
		settings.set("task.disabledAgents", ["reviewer"]);

		const dashboard = await dashboardFor(cwd, settings);
		selectByName(dashboard, "alpha");
		dashboard.handleInput(" ");
		dashboard.handleInput(" ");
		dashboard.handleInput(" ");

		const disabled = settings.get("task.disabledAgents");
		expect(disabled).toContain("reviewer");
		expect(disabled).toContain("alpha");
	});
});
