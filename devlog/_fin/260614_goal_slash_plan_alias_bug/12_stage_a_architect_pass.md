PASS
Most likely break: An executor implements the TUI `plan` subcommand but forgets the ACP/text `handle` for `/goalplan` and `/goal-plan`, causing those aliases to fall through as ordinary prompts again.
