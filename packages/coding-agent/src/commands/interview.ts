import { APP_NAME } from "@jawcode-dev/utils";
import { Command, Flags } from "@jawcode-dev/utils/cli";
import { runNativeJawInterviewCommand } from "../jwc-runtime/jaw-interview-runtime";

export default class JawInterview extends Command {
	static description = `Run native ${APP_NAME.toUpperCase()} I-stage interview workflow (jaw-interview engine)`;
	static strict = false;
	static flags = {
		quick: Flags.boolean({ description: "Seed a quick jaw-interview run" }),
		standard: Flags.boolean({ description: "Seed a standard jaw-interview run" }),
		deep: Flags.boolean({ description: "Seed a deep jaw-interview run" }),
		threshold: Flags.string({ description: "Override ambiguity threshold for kickoff" }),
		"threshold-source": Flags.string({ description: "Describe the threshold override source" }),
		"session-id": Flags.string({
			description: "Route state/spec handoff through a session-scoped .jwc state directory",
		}),
		write: Flags.boolean({ description: "Persist a final jaw-interview spec through the sanctioned GJC CLI/API" }),
		stage: Flags.string({ description: 'Spec stage for --write (currently "final")' }),
		slug: Flags.string({ description: "Safe slug for .jwc/specs/jaw-interview-<slug>.md" }),
		spec: Flags.string({ description: "Final spec markdown or a path to the final spec markdown" }),
		handoff: Flags.string({
			description: 'After --write, hand off to a P-stage workflow target (currently "plan")',
		}),
		deliberate: Flags.boolean({
			description: "Shortcut for --write handoff to plan in deliberate consensus mode",
		}),
		force: Flags.boolean({ description: "Overwrite corrupt existing jaw-interview state during --write" }),
		json: Flags.boolean({ description: "Output JSON" }),
	};
	static examples = [
		'$ jwc interview --standard "<idea>"',
		"$ jwc interview --write --stage final --slug my-feature --spec ./final-spec.md",
		"$ jwc interview --write --stage final --slug my-feature --spec ./final-spec.md --deliberate",
	];

	async run(): Promise<void> {
		const result = await runNativeJawInterviewCommand(this.argv, process.cwd());
		if (result.stdout) process.stdout.write(result.stdout);
		if (result.stderr) process.stderr.write(result.stderr);
		process.exitCode = result.status;
	}
}
