import { Command, Flags } from "@jawcode-dev/utils/cli";
import { runJwcGcCommand } from "../jwc-runtime/gc-runtime";

export default class Gc extends Command {
	static description = "Garbage-collect stale JWC session/PID records (dry-run by default)";
	static strict = false;
	static flags = {
		json: Flags.boolean({ char: "j", description: "Emit machine-readable JSON", default: false }),
		prune: Flags.boolean({ description: "Remove stale records (default: report only)", default: false }),
		force: Flags.boolean({ description: "Alias for --prune (eligible records only)", default: false }),
		"dry-run": Flags.boolean({ description: "Force report-only mode", default: false }),
	};

	static examples = ["jwc gc", "jwc gc --json", "jwc gc --prune", "jwc gc --prune --json"];

	async run(): Promise<void> {
		const result = await runJwcGcCommand(this.argv, process.cwd(), process.env);
		if (result.stdout) process.stdout.write(result.stdout);
		if (result.stderr) process.stderr.write(result.stderr);
		process.exitCode = result.status;
	}
}
