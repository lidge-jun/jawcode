/**
 * Shared file-read helper for edit-mode utilities.
 *
 * Reads a file via Bun and rethrows ENOENT as a user-facing "File not found"
 * error referencing the display path.
 */
import { isEnoent } from "@jawcode-dev/utils";
import { isNotebookPath, readEditableNotebookText, serializeEditedNotebookText } from "./notebook";

const UTF8_BOM = "\uFEFF";
const UTF8_BOM_BYTES = new Uint8Array([0xef, 0xbb, 0xbf]);

async function fileHasUtf8Bom(file: Bun.BunFile): Promise<boolean> {
	const bytes = new Uint8Array(await file.slice(0, UTF8_BOM_BYTES.length).arrayBuffer());
	return UTF8_BOM_BYTES.every((byte, index) => bytes[index] === byte);
}

export async function readEditFileText(absolutePath: string, path: string): Promise<string> {
	try {
		if (isNotebookPath(absolutePath)) return await readEditableNotebookText(absolutePath, path);
		const file = Bun.file(absolutePath);
		const text = await file.text();
		if (!text.startsWith(UTF8_BOM) && (await fileHasUtf8Bom(file))) return `${UTF8_BOM}${text}`;
		return text;
	} catch (error) {
		if (isEnoent(error)) {
			throw new Error(`File not found: ${path}`);
		}
		throw error;
	}
}

export async function serializeEditFileText(absolutePath: string, path: string, content: string): Promise<string> {
	if (isNotebookPath(absolutePath)) return serializeEditedNotebookText(absolutePath, path, content);
	return content;
}
