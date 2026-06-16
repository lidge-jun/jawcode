Start a background monitor that streams events from a long-running script. Each stdout line is an event — you keep working and notifications arrive in the chat. Events arrive on their own schedule and are not replies from the user, even if one lands while you're waiting for the user to answer a question.

Pick by how many notifications you need:
- **One** ("tell me when the server is ready / the build finishes") → use `bash` with `async: true`. That returns a single completion notification when the command exits.
- **Many ongoing events** (logs, polling, file watching) → use `monitor`. The script keeps running and every new line of stdout becomes one event delivered into the conversation between turns.

`monitor` uses the same permission rules as `bash`. Monitor rows appear in `background list/detail/follow` because they are background rows. Use `background` for row visibility and supported cancellation semantics; cron deletion remains with `CronDelete`.

## When to reach for `monitor`

- Tail a log file and flag errors as they appear (`tail -F server.log | grep -i error`).
- Poll a PR or CI job and report when its status changes.
- Watch a directory for file changes (`fswatch -r dist/`).
- Track output from any long-running script you point it at.

## Inputs

- `command` (required): shell command to run as a background monitor. Each stdout line is delivered as a separate task-notification event.
- `kind` (required): one of `"log"`, `"poll"`, `"watch"`, `"other"`. Describes the monitoring strategy so listings can surface useful categories.
- `description` (required): short human-readable description of what is being monitored. Appears in task listings.
- `timeout` (optional): maximum wall-clock seconds the monitor may run before automatic shutdown. Omit for the session lifetime.
- `persistent` (optional, default `false`): keep the monitor running past the current turn. Persistent monitors survive until session end or until cancelled via `background`.
- `silent` (optional, default `false`; **auto-enabled for `kind: "poll"`**): when true, notifications queue silently without triggering a new agent turn. The agent sees them on its next natural turn — avoids empty response spam for poll monitors.
- `deduplicate` (optional, default `false`; **auto-enabled for `kind: "poll"`**): skip notification when the stdout line is identical to the previous one. Combines well with `silent` for poll patterns.

## Output

Returns `Monitor started · task <task_id>` plus a background row visible via `background({ op: "list" })`. Each stdout line of the monitored command becomes a `<task-notification>` event delivered between turns.

## Cancellation

There is no separate `monitor` kill tool. Cancel a running monitor with `background` when supported by its cancel matrix, or with legacy `job` using the returned `task_id`. Disposing the session also cancels every monitor the calling agent started.
