import { repoMap } from "@jawcode-dev/natives";
import { Args, Command, Flags } from "@jawcode-dev/utils/cli";

export default class RepoMapCommand extends Command {
	static description = "Ranked structure map of a directory";

	static args = {
		path: Args.string({ description: "File or directory to map", required: true }),
	};

	static flags = {
		budget: Flags.integer({ description: "Approximate output token budget", default: 4096 }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(RepoMapCommand);
		if (!args.path) {
			throw new Error("path is required");
		}
		const output = await repoMap({ path: args.path, budget: flags.budget });
		process.stdout.write(`${output}\n`);
	}
}
