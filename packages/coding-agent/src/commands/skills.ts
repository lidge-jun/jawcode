import { APP_NAME } from "@gajae-code/utils";
/**
 * Inspect bundled workflow skills.
 */
import { Args, Command, Flags, renderCommandHelp } from "@gajae-code/utils/cli";
import { runSkillsCommand, type SkillsAction, type SkillsCommandArgs } from "../cli/skills-cli";

const ACTIONS: SkillsAction[] = ["list", "read"];

export default class Skills extends Command {
	static description = `Inspect bundled ${APP_NAME.toUpperCase()} workflow skills`;

	static args = {
		action: Args.string({
			description: "Skills action",
			required: false,
			options: ACTIONS,
		}),
		name: Args.string({
			description: "Bundled skill name to read",
			required: false,
		}),
	};

	static flags = {
		json: Flags.boolean({ description: "Output JSON" }),
	};

	static examples = [
		"# List bundled workflow skills\n  jwc skills list",
		"# Read an embedded workflow skill without requiring .jwc files\n  jwc skills read goal",
		"# Machine-readable embedded skill content\n  jwc skills read plan --json",
	];

	async run(): Promise<void> {
		const { args, flags } = await this.parse(Skills);
		if (!args.action) {
			renderCommandHelp("gjc", "skills", Skills);
			return;
		}

		const cmd: SkillsCommandArgs = {
			action: args.action as SkillsAction,
			name: args.name,
			flags: { json: flags.json },
		};
		await runSkillsCommand(cmd);
	}
}
