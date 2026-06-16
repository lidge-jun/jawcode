import { APP_NAME } from "@jawcode-dev/utils";
import { Command, Flags } from "@jawcode-dev/utils/cli";
import { runNativeOrchestrateCommand } from "../jwc-runtime/orchestrate-runtime";

export default class Orchestrate extends Command {
	static description = `Run the native ${APP_NAME.toUpperCase()} IPABCD orchestration (i|p|a|b|c|d)`;
	static strict = false;
	static flags = {
		"session-id": Flags.string({
			description: "Route state through a session-scoped .jwc state directory",
		}),
		deliberate: Flags.boolean({ description: "Force deliberate mode (stage-a dual audit)" }),
		"audit-mode": Flags.string({ description: 'Stage-a audit mode: "solo" | "dual" (D050-21)' }),
		"spec-ref": Flags.string({ description: "Record the interview spec path (.jwc/specs/jaw-interview-<slug>.md)" }),
		"plan-ref": Flags.string({ description: "Record the devlog plan path produced in stage p" }),
		"worker-output": Flags.string({
			description: "With the verdict subcommand: parse PASS|FAIL|DONE|NEEDS_FIX from this file",
		}),
		"audit-lens": Flags.string({
			description: 'With verdict in stage a: audit lens identity, "planner" | "architect"',
		}),
		"revision-id": Flags.string({
			description: "With verdict in stage a: synthesized plan revision id under audit",
		}),
		"review-override-ref": Flags.string({
			description: "With verdict/transition: path or section ref containing main-session waiver/override synthesis",
		}),
		"user-approved": Flags.boolean({ description: "Explicit user approval override for a gated transition" }),
		shared: Flags.boolean({
			description: "Target shared .jwc/state PABCD state instead of the current session scope",
		}),
		complete: Flags.boolean({
			description: "With stage d: explicit close alias (stage d also closes with `jwc orchestrate d`)",
		}),
		json: Flags.boolean({ description: "Output JSON" }),
	};
	static examples = [
		"$ jwc orchestrate i",
		"$ jwc orchestrate p --spec-ref .jwc/specs/jaw-interview-my-feature.md",
		"$ jwc orchestrate a --audit-mode dual",
		"$ jwc orchestrate verdict --audit-lens planner --revision-id a-r1 --worker-output ./audit-report.md",
		"$ jwc orchestrate verdict --worker-output ./critic-review.md --review-override-ref devlog/_plan/.../synthesis.md",
		"$ jwc orchestrate b --user-approved",
		"$ jwc orchestrate status --json",
		"$ jwc orchestrate status --shared",
		"$ jwc orchestrate d",
	];

	async run(): Promise<void> {
		const result = await runNativeOrchestrateCommand(this.argv, process.cwd());
		if (result.stdout) process.stdout.write(result.stdout);
		if (result.stderr) process.stderr.write(result.stderr);
		process.exitCode = result.status;
	}
}
