import * as path from "node:path";

const WINDOWS_DRIVE_PATH = /^[A-Za-z]:[\\/]/;
const WINDOWS_UNC_PATH = /^[/\\]{2}[^/\\]+[/\\]+[^/\\]+/;

export function validateEditHeaderPath(raw: string, context: string): string {
	const filePath = raw.trim();
	if (filePath.length === 0) throw new Error(`${context} path is empty`);
	if (filePath.includes("\0")) throw new Error(`${context} path contains NUL`);
	if (path.posix.isAbsolute(filePath)) throw new Error(`${context} path must be relative: ${filePath}`);
	if (WINDOWS_DRIVE_PATH.test(filePath) || WINDOWS_UNC_PATH.test(filePath)) {
		throw new Error(`${context} path must be relative: ${filePath}`);
	}
	const parts = filePath.split(/[\\/]+/);
	if (parts.some(part => part === "." || part === "..")) {
		throw new Error(`${context} path must not contain . or .. segments: ${filePath}`);
	}
	return filePath;
}
