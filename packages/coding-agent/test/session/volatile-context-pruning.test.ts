import { describe, expect, it } from "bun:test";
import type { CustomMessageEntry, SessionEntry } from "../../src/session/session-manager";
import {
	pruneSupersededMaintenanceReminders,
	pruneSupersededVolatileProjectContext,
} from "../../src/session/volatile-context-pruning";

function custom(id: string, customType: string, content: string): CustomMessageEntry {
	return {
		type: "custom_message",
		id,
		parentId: null,
		timestamp: "2026-07-17T00:00:00.000Z",
		customType,
		content,
		display: false,
		attribution: "agent",
	};
}

describe("volatile context pruning", () => {
	it("prunes only superseded volatile project context", () => {
		const entries: SessionEntry[] = [
			custom("old", "volatile-project-context", "old workspace snapshot"),
			custom("ordinary", "user-note", "must stay"),
			custom("current", "volatile-project-context", "current workspace snapshot"),
		];

		const result = pruneSupersededVolatileProjectContext(entries);

		expect(result.changed.map(entry => entry.id)).toEqual(["old"]);
		expect(entries[0]).toMatchObject({ content: "[superseded volatile context pruned]" });
		expect(entries[1]).toMatchObject({ content: "must stay" });
		expect(entries[2]).toMatchObject({ content: "current workspace snapshot" });
		expect(result.bytesSaved).toBe(Buffer.byteLength("old workspace snapshot"));
	});

	it("keeps the newest reminder per known singleton type and is idempotent", () => {
		const entries: SessionEntry[] = [
			custom("resolve-old", "resolve-reminder", "old resolve state"),
			custom("todo-old", "eager-todo-prelude", "old todo state"),
			custom("resolve-new", "resolve-reminder", "new resolve state"),
			custom("todo-new", "eager-todo-prelude", "new todo state"),
			custom("unknown-old", "unknown-reminder", "preserve unknown"),
			custom("unknown-new", "unknown-reminder", "also preserve unknown"),
		];

		const first = pruneSupersededMaintenanceReminders(entries);
		const second = pruneSupersededMaintenanceReminders(entries);

		expect(first.changed.map(entry => entry.id)).toEqual(["resolve-old", "todo-old"]);
		expect(second).toEqual({ changed: [], bytesSaved: 0 });
		expect(entries.slice(2).map(entry => (entry as CustomMessageEntry).content)).toEqual([
			"new resolve state",
			"new todo state",
			"preserve unknown",
			"also preserve unknown",
		]);
	});
});
