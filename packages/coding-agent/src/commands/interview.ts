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
			description:
				'Legacy compatibility: after --write, hand off to a P-stage workflow target (currently "plan"). Cannot combine with --handoff-status.',
		}),
		deliberate: Flags.boolean({
			description:
				"Legacy compatibility shortcut for --write handoff to plan. Cannot combine with --handoff-status.",
		}),
		force: Flags.boolean({ description: "Overwrite corrupt existing jaw-interview state during --write" }),
		"ambiguity-score": Flags.string({ description: "Strict handoff final ambiguity score, 0 <= value <= 1" }),
		"ambiguity-threshold": Flags.string({ description: "Strict handoff ambiguity threshold, usually 0.05" }),
		"ambiguity-status": Flags.string({ description: 'Strict handoff ambiguity status: "passed" | "early_exit"' }),
		"closure-status": Flags.string({ description: 'Strict closure guard status: "pass" | "override" | "fail"' }),
		"restated-goal-confirmed": Flags.boolean({ description: "Strict handoff: user confirmed the restated goal" }),
		"pre-p-summary-presented": Flags.boolean({ description: "Strict handoff: short full-spec summary was shown" }),
		"pre-p-summary-confirmed": Flags.boolean({
			description: "Strict handoff: user acknowledged the summary before P",
		}),
		"handoff-status": Flags.string({
			description:
				'Strict pre-P handoff status: "summary_pending" | "summary_confirmed" | "early_exit_summary_pending" | "early_exit_summary_confirmed"',
		}),
		"handoff-outcome": Flags.string({
			description: 'Strict handoff outcome persisted as spec metadata: "PASSED" | "BELOW_THRESHOLD_EARLY_EXIT"',
		}),
		json: Flags.boolean({ description: "Output JSON" }),
	};
	static examples = [
		'$ jwc interview --standard "<idea>"',
		"$ jwc interview --write --stage final --slug my-feature --spec ./final-spec.md",
		"$ jwc interview --write --stage final --slug my-feature --spec ./final-spec.md --ambiguity-score 0.03 --ambiguity-threshold 0.05 --ambiguity-status passed --closure-status pass --restated-goal-confirmed --handoff-outcome PASSED --pre-p-summary-presented --handoff-status summary_pending --json",
		"$ jwc interview --write --stage final --slug my-feature --spec ./final-spec.md --ambiguity-score 0.03 --ambiguity-threshold 0.05 --ambiguity-status passed --closure-status pass --restated-goal-confirmed --handoff-outcome PASSED --pre-p-summary-presented --pre-p-summary-confirmed --handoff-status summary_confirmed --json",
	];

	async run(): Promise<void> {
		const result = await runNativeJawInterviewCommand(this.argv, process.cwd());
		if (result.stdout) process.stdout.write(result.stdout);
		if (result.stderr) process.stderr.write(result.stderr);
		process.exitCode = result.status;
	}
}
