import type { CustomMessageEntry, SessionEntry } from "./session-manager";

const SUPERSEDED_VOLATILE_CONTEXT_NOTICE = "[superseded volatile context pruned]";
const SUPERSEDED_SINGLETON_REMINDER_TYPES = new Set([
	"todo-write-error-reminder",
	"resolve-reminder",
	"eager-todo-prelude",
]);

function textContent(entry: CustomMessageEntry): string {
	if (typeof entry.content === "string") return entry.content;
	return entry.content
		.filter(block => block.type === "text")
		.map(block => block.text)
		.join("\n");
}

function pruneOlderSingletons(
	entries: readonly SessionEntry[],
	matches: (entry: CustomMessageEntry) => boolean,
): { changed: CustomMessageEntry[]; bytesSaved: number } {
	const latest = new Map<string, number>();
	entries.forEach((entry, index) => {
		if (entry.type === "custom_message" && matches(entry)) latest.set(entry.customType, index);
	});

	const changed: CustomMessageEntry[] = [];
	let bytesSaved = 0;
	entries.forEach((entry, index) => {
		if (entry.type !== "custom_message" || !matches(entry) || latest.get(entry.customType) === index) return;
		const content = textContent(entry);
		if (!content || content === SUPERSEDED_VOLATILE_CONTEXT_NOTICE) return;
		entry.content = SUPERSEDED_VOLATILE_CONTEXT_NOTICE;
		bytesSaved += Buffer.byteLength(content, "utf8");
		changed.push(entry);
	});
	return { changed, bytesSaved };
}

/** Prune only older copies of project context that is regenerated for every prompt. */
export function pruneSupersededVolatileProjectContext(entries: readonly SessionEntry[]): {
	changed: CustomMessageEntry[];
	bytesSaved: number;
} {
	return pruneOlderSingletons(entries, entry => entry.customType === "volatile-project-context");
}

/** Retire older singleton maintenance reminders while preserving ordinary custom/user context. */
export function pruneSupersededMaintenanceReminders(entries: readonly SessionEntry[]): {
	changed: CustomMessageEntry[];
	bytesSaved: number;
} {
	return pruneOlderSingletons(entries, entry => SUPERSEDED_SINGLETON_REMINDER_TYPES.has(entry.customType));
}
