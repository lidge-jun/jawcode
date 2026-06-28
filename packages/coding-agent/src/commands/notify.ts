import { Args, Command, Flags } from "@jawcode-dev/utils/cli";
import { type NotifyAction, parseNotifyFlags, runNotifyCommand } from "../cli/notify-cli";

const ACTIONS: NotifyAction[] = ["status", "setup", "verify"];

export default class Notify extends Command {
	static description = "Manage notification settings";

	static args = {
		action: Args.string({
			description: "Notify action",
			required: false,
			options: ACTIONS,
		}),
	};

	static flags = {
		json: Flags.boolean({ description: "Output JSON" }),
		token: Flags.string({ description: "Telegram bot token for setup" }),
		"chat-id": Flags.string({ description: "Telegram chat id for setup" }),
		redact: Flags.string({ description: "Whether to redact sensitive notification content" }),
		verbosity: Flags.string({ description: "Notification verbosity: lean or verbose" }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(Notify);
		const action = (args.action ?? "status") as NotifyAction;
		const parsed = parseNotifyFlags({
			json: flags.json,
			token: flags.token,
			chatId: flags["chat-id"],
			redact: flags.redact,
			verbosity: flags.verbosity,
		});

		await runNotifyCommand({
			action,
			token: parsed.token,
			chatId: parsed.chatId,
			redact: parsed.redact,
			verbosity: parsed.verbosity,
			flags: { json: parsed.json },
		});
	}
}
