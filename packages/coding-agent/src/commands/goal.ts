import { APP_NAME } from "@gajae-code/utils";
import { Command, Flags } from "@gajae-code/utils/cli";
import { runNativeGoalCommand } from "../jwc-runtime/goal-cli";

export default class Goal extends Command {
	static description = `Manage the durable ${APP_NAME} goal ledger (cli-jaw verb surface — goal-ledger engine)`;
	static strict = false;
	static flags = {
		evidence: Flags.string({ description: "Checkpoint evidence (repeatable; joined with '; ')", multiple: true }),
		agent: Flags.boolean({ description: "Mark an agent-initiated pause (2-tap audit gate)" }),
		audit: Flags.string({ description: "Independent stop-audit summary for an agent pause (2nd tap)" }),
		force: Flags.boolean({ description: "Human-only override skipping adapter pre-checks" }),
		"quality-gate-json": Flags.string({ description: "Completion quality gate JSON (path or inline)" }),
		shared: Flags.boolean({ description: "Target the shared .jwc/goal ledger even when a session scope is active" }),
		"session-id": Flags.string({
			description:
				"Override session id for workflow-state reconciliation (precedence: flag, JWC_SESSION_ID, GJC_SESSION_ID)",
		}),
	};
	static examples = [
		`$ ${APP_NAME} goal set "ship the importer"`,
		`$ ${APP_NAME} goal update "parser done" --evidence "bun test parser 12 pass"`,
		`$ ${APP_NAME} goal done --quality-gate-json .jwc/state/pabcd-quality-gate.json`,
		`$ ${APP_NAME} goal pause --agent --audit "reviewer found no remaining path"`,
		`$ ${APP_NAME} goal status`,
		`$ ${APP_NAME} goal status --shared`,
		`$ ${APP_NAME} goal status --session-id my-session`,
		`$ ${APP_NAME} goal history 20`,
	];

	async run(): Promise<void> {
		const result = await runNativeGoalCommand(this.argv, process.cwd());
		if (result.stdout) process.stdout.write(result.stdout);
		if (result.stderr) process.stderr.write(result.stderr);
		process.exitCode = result.status;
	}
}
