import { APP_NAME } from "@gajae-code/utils";
import { Command, Flags } from "@gajae-code/utils/cli";
import { runNativeMemoryCommand } from "../jwc-runtime/memory-runtime";

export default class Memory extends Command {
	static description =
		`Search, read, save, and trace ${APP_NAME} long-term memory (cli-jaw-shaped surface over the memory backend)`;
	static strict = false;
	static flags = {
		cloud: Flags.boolean({ description: "Search Hindsight cloud recall (memory search only)", allowNo: true }),
		lines: Flags.string({ description: 'Line range for read, e.g. "3-12"' }),
		kind: Flags.string({ description: "Kind tag for save: profile | shared | episode" }),
	};
	static examples = [
		`$ ${"{"}APP_NAME{'}'} memory search "es modules"`,
		`$ ${"{"}APP_NAME{'}'} memory search "topic" --cloud`,
		`$ ${APP_NAME} memory browse --limit 20`,
		`$ ${APP_NAME} memory list`,
		`$ ${APP_NAME} memory status`,
		`$ ${APP_NAME} memory reindex`,
		`$ ${APP_NAME} memory read summary --lines 1-20`,
		`$ ${APP_NAME} memory save decisions.md "we chose sqlite" --kind shared`,
		`$ ${APP_NAME} memory context stage1:manual:decisions.md`,
	];

	async run(): Promise<void> {
		const result = await runNativeMemoryCommand(this.argv, process.cwd());
		if (result.stdout) process.stdout.write(result.stdout);
		if (result.stderr) process.stderr.write(result.stderr);
		// Settings.init keeps the event loop alive (same as read/shell/config-cli)
		// — exit explicitly or local-backend invocations linger as ~300MB zombies.
		process.exit(result.status);
	}
}
