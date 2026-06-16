import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getConfigRootDir } from "@gajae-code/utils";

const TOKENIZER_BASE_URL = "https://github.com/nicejunhee/jawcode-tokenizers/releases/download/v1";

interface TokenizerEntry {
	url: string;
	sha256: string;
	filename: string;
}

const TOKENIZER_MANIFEST: Record<string, TokenizerEntry> = {
	gemma: {
		url: `${TOKENIZER_BASE_URL}/gemma.json`,
		sha256: "",
		filename: "tokenizer.json",
	},
	llama3: {
		url: `${TOKENIZER_BASE_URL}/llama3.json`,
		sha256: "",
		filename: "tokenizer.json",
	},
	deepseek: {
		url: `${TOKENIZER_BASE_URL}/deepseek.json`,
		sha256: "",
		filename: "tokenizer.json",
	},
	mistral: {
		url: `${TOKENIZER_BASE_URL}/mistral.json`,
		sha256: "",
		filename: "tokenizer.json",
	},
	glm: {
		url: `${TOKENIZER_BASE_URL}/glm.json`,
		sha256: "",
		filename: "tokenizer.json",
	},
	cohere: {
		url: `${TOKENIZER_BASE_URL}/cohere.json`,
		sha256: "",
		filename: "tokenizer.json",
	},
};

function getTokenizersDir(): string {
	return join(getConfigRootDir(), "tokenizers");
}

export function getTokenizerPath(family: string): string {
	const entry = TOKENIZER_MANIFEST[family];
	return join(getTokenizersDir(), family, entry?.filename ?? "tokenizer.json");
}

export async function isTokenizerCached(family: string): Promise<boolean> {
	try {
		await readFile(getTokenizerPath(family));
		return true;
	} catch {
		return false;
	}
}

async function verifySha256(filePath: string, expected: string): Promise<boolean> {
	if (!expected) return true;
	const content = await readFile(filePath);
	const actual = createHash("sha256").update(content).digest("hex");
	return actual === expected;
}

export async function ensureTokenizer(family: string): Promise<boolean> {
	if (await isTokenizerCached(family)) return true;

	const entry = TOKENIZER_MANIFEST[family];
	if (!entry) return false;

	const dir = join(getTokenizersDir(), family);
	const target = join(dir, entry.filename);

	try {
		await mkdir(dir, { recursive: true });
		const response = await fetch(entry.url);
		if (!response.ok) return false;

		const buffer = Buffer.from(await response.arrayBuffer());
		await writeFile(target, buffer);

		if (entry.sha256 && !(await verifySha256(target, entry.sha256))) {
			await unlink(target);
			return false;
		}

		return true;
	} catch {
		return false;
	}
}

const downloadingFamilies = new Set<string>();

export function triggerBackgroundDownload(family: string): void {
	if (downloadingFamilies.has(family)) return;
	downloadingFamilies.add(family);
	ensureTokenizer(family).finally(() => downloadingFamilies.delete(family));
}
