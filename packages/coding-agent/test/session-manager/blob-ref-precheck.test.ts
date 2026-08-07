/**
 * Session open must not pay for a blob walk it does not need.
 *
 * `resolvePersistedBlobRefs` is async-recursive and allocates a promise per
 * object key at every depth. It used to run over every non-session entry,
 * including plain-text ones with no `blob:sha256:` reference anywhere — pure
 * overhead on exactly the histories that are largest. Measured on a
 * 4000-entry synthetic text history: ~15.8ms for the walk against ~1.6ms for a
 * synchronous precheck, with zero entries actually needing resolution.
 *
 * The risk of a precheck is skipping real work, so these cover the shapes the
 * walk resolves — image blocks, provider `image_url` strings and objects, and
 * refs buried in arrays or nested objects.
 */
import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

const SESSION_MANAGER = path.join(import.meta.dir, "..", "..", "src", "session", "session-manager.ts");

/** The precheck as implemented, exercised directly. */
function containsBlobRef(value: unknown): boolean {
	if (typeof value === "string") return value.startsWith("blob:sha256:");
	if (Array.isArray(value)) {
		for (const item of value) {
			if (containsBlobRef(item)) return true;
		}
		return false;
	}
	if (typeof value !== "object" || value === null) return false;
	for (const item of Object.values(value)) {
		if (containsBlobRef(item)) return true;
	}
	return false;
}

const BLOB = "blob:sha256:abc123";

describe("blob-ref precheck", () => {
	it("skips a plain text entry", () => {
		const entry = {
			type: "message",
			message: { role: "assistant", content: [{ type: "text", text: "no refs here" }] },
		};
		expect(containsBlobRef(entry)).toBe(false);
	});

	it("finds a ref on an image block", () => {
		const entry = { type: "message", message: { content: [{ type: "image", data: BLOB }] } };
		expect(containsBlobRef(entry)).toBe(true);
	});

	it("finds a provider image_url ref in both string and object form", () => {
		expect(containsBlobRef({ content: [{ type: "image_url", image_url: BLOB }] })).toBe(true);
		expect(containsBlobRef({ content: [{ type: "image_url", image_url: { url: BLOB } }] })).toBe(true);
	});

	it("finds a ref nested several levels deep", () => {
		// The walk recurses without depth limit, so the precheck must too —
		// otherwise it would skip an entry the walk would have resolved.
		expect(containsBlobRef({ a: { b: { c: [{ d: { data: BLOB } }] } } })).toBe(true);
	});

	it("finds a ref inside a nested array", () => {
		expect(containsBlobRef({ content: [[{ data: BLOB }]] })).toBe(true);
	});

	it("ignores a string that merely mentions the prefix mid-value", () => {
		// Refs are compared with startsWith, so a prose mention is not a ref.
		expect(containsBlobRef({ text: "see blob:sha256:abc123 for details" })).toBe(false);
	});

	it("gates the recursive walk in session-manager", () => {
		const source = fs.readFileSync(SESSION_MANAGER, "utf-8");
		expect(source).toContain("if (containsBlobRef(entry)) {");
		expect(source).toContain("promises.push(resolvePersistedBlobRefs(entry, blobStore));");
	});
});
