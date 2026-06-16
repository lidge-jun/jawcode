import { APP_NAME } from "@gajae-code/utils";
import { Command, Flags } from "@gajae-code/utils/cli";
import { runNativeChatCommand } from "../jwc-runtime/memory-runtime";

export default class Chat extends Command {
	static description = `Search past ${APP_NAME} conversations across this project's sessions`;
	static strict = false;
	static flags = {
		days: Flags.string({ description: "Limit to sessions touched in the last N days (default 7)" }),
		recent: Flags.string({ description: "Stop after the N most recent hits" }),
		context: Flags.string({ description: "Show N surrounding messages per hit" }),
	};
	static examples = [
		`$ ${APP_NAME} chat search "migration plan"`,
		`$ ${APP_NAME} chat search "빌드 실패" --days 3 --context 2`,
	];

	async run(): Promise<void> {
		const result = await runNativeChatCommand(this.argv, process.cwd());
		if (result.stdout) process.stdout.write(result.stdout);
		if (result.stderr) process.stderr.write(result.stderr);
		// Explicit exit — mirrors memory.ts (Settings/storage can hold the loop).
		process.exit(result.status);
	}
}
