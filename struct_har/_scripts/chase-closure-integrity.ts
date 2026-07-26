/**
 * Verify archived chase cards carry valid closure and owner-path evidence.
 * Run: bun struct_har/_scripts/chase-closure-integrity.ts
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
const FIN = path.join(ROOT, "struct_har/chase/_fin");
const CARD_NAME = /^(10|20)\.\d{3}[a-z]?_.+\.md$/;
const CLOSED_HEADER = /^(?:>\s*)?Closed: \d{4}-\d{2}-\d{2}(?:\b.*)?$/m;
const HASH = /`([0-9a-f]{7,40})`/gi;
const PARTIAL_MARKER = /ADAPT\s*[—–-]\s*partial implementation, tracked residual/i;
const CLEAN_MARKER = /\bCLOSED\b/;
const RESIDUAL_DECLARATION = /(?:tracked residual|named residual remains|^#{1,6}\s+.*\bresidual\b|^(?:[-*>]\s*)?(?:\*\*)?Residual(?:\*\*)?\s*:)/im;

type Card = { absolutePath: string; relativePath: string };
type Offense = { card: string; reasons: string[] };

async function listCards(): Promise<Card[]> {
	const cards: Card[] = [];
	for (const lane of ["10", "20"] as const) {
		const directory = path.join(FIN, lane);
		for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
			if (!entry.isFile() || !CARD_NAME.test(entry.name)) continue;
			const absolutePath = path.join(directory, entry.name);
			cards.push({ absolutePath, relativePath: path.relative(ROOT, absolutePath) });
		}
	}
	return cards.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function codePaths(value: string): string[] {
	return [...value.matchAll(/`([^`]+)`/g)]
		.flatMap(match => match[1]?.trim().split(/[\s;,]+/) ?? [])
		.filter((candidate): candidate is string => Boolean(candidate))
		.filter(candidate => candidate.includes("/") && !candidate.includes(".."))
		.filter(candidate => !candidate.startsWith("-") && !candidate.includes("="))
		.map(candidate => candidate.replace(/^\.\//, "").replace(/:\d+(?:-\d+)?$/, ""));
}

function sectionLines(body: string, headingPattern: RegExp): string[] {
	const lines = body.split(/\r?\n/);
	const selected: string[] = [];
	for (let index = 0; index < lines.length; index += 1) {
		const heading = lines[index]?.match(/^(#{1,6})\s+(.+)$/);
		if (!heading || !headingPattern.test(heading[2] ?? "")) continue;
		const level = heading[1]?.length ?? 6;
		for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
			const nextHeading = lines[cursor]?.match(/^(#{1,6})\s+/);
			if (nextHeading && (nextHeading[1]?.length ?? 6) <= level) break;
			selected.push(lines[cursor] ?? "");
		}
	}
	return selected;
}

function parseOwnerPaths(body: string): string[] {
	const owners = new Set<string>();
	for (const line of body.split(/\r?\n/)) {
		if (/^Owner paths:/i.test(line)) {
			for (const owner of codePaths(line)) owners.add(owner);
		}
	}

	const ownerSections = sectionLines(
		body,
		/^(?:JWC\s+)?(?:Worktree Verification|Decision Slots?|Implementation Evidence|(?:Final )?Closure Evidence)(?:\s|$)/i,
	);
	for (const line of ownerSections) {
		for (const owner of codePaths(line)) owners.add(owner);
	}
	return [...owners];
}

function parseImplementationHashes(body: string, closedLine: string): string[] {
	const hashes = new Set<string>();
	for (const match of closedLine.matchAll(HASH)) {
		if (match[1]) hashes.add(match[1].toLowerCase());
	}
	const evidenceLines = sectionLines(body, /^(?:Final )?(?:Implementation|Closure) Evidence(?:\s|$)/i);
	for (const line of evidenceLines) {
		if (/(?:upstream|source behavior|source commit|reference-only|read-only)/i.test(line)) continue;
		if (
			!/(?:\b(?:JWC|implementing|implementation|landed|closure|adaptation)\s+commit(?:s)?\b|^\s*[-|>]?[\s*]*commit(?:s)?\s*[:|])/i.test(
				line,
			)
		) {
			continue;
		}
		for (const match of line.matchAll(HASH)) {
			if (match[1]) hashes.add(match[1].toLowerCase());
		}
	}
	return [...hashes];
}

async function git(args: string[]): Promise<{ exitCode: number; stdout: string }> {
	const process = Bun.spawn(["git", ...args], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
	const [exitCode, stdout] = await Promise.all([process.exited, new Response(process.stdout).text()]);
	return { exitCode, stdout };
}

function pathIntersects(changedPath: string, ownerPath: string): boolean {
	const owner = ownerPath.replace(/\/$/, "");
	return changedPath === owner || changedPath.startsWith(`${owner}/`) || owner.startsWith(`${changedPath}/`);
}

const offenses: Offense[] = [];
const cards = await listCards();

for (const card of cards) {
	const body = await Bun.file(card.absolutePath).text();
	const reasons: string[] = [];
	const owners = parseOwnerPaths(body);
	if (owners.length === 0) reasons.push("UNDECLARED owner paths");
	const closedLine = body.split(/\r?\n/).find(line => CLOSED_HEADER.test(line));
	if (!closedLine) {
		reasons.push("missing `Closed: YYYY-MM-DD` header line");
	} else {
		const hashes = parseImplementationHashes(body, closedLine);
		if (hashes.length === 0) reasons.push("no cited JWC/implementing commit hash");

		for (const hash of hashes) {
			const exists = await git(["cat-file", "-e", `${hash}^{commit}`]);
			if (exists.exitCode !== 0) {
				reasons.push(`commit ${hash} does not exist`);
				continue;
			}
			if (owners.length === 0) continue;
			const tree = await git(["diff-tree", "--no-commit-id", "--name-only", "-r", hash]);
			const changedPaths = tree.stdout.split(/\r?\n/).filter(Boolean);
			if (!changedPaths.some(changed => owners.some(owner => pathIntersects(changed, owner)))) {
				reasons.push(`commit ${hash} touches none of: ${owners.join(", ")}`);
			}
		}
	}

	const declaresResidual = RESIDUAL_DECLARATION.test(body);
	const markedPartial = PARTIAL_MARKER.test(body);
	if (CLEAN_MARKER.test(body) && declaresResidual) reasons.push("clean CLOSED card declares a residual");
	if (declaresResidual && !markedPartial) reasons.push("residual card lacks `ADAPT — partial implementation, tracked residual`");

	if (reasons.length > 0) offenses.push({ card: card.relativePath, reasons });
}

for (const offense of offenses) {
	console.log(`\n${offense.card}`);
	for (const reason of offense.reasons) console.log(`- ${reason}`);
}
console.log(`chase closure integrity: ${offenses.length === 0 ? "PASS" : "FAIL"} — ${cards.length} cards, ${offenses.length} offending cards`);
process.exitCode = offenses.length === 0 ? 0 : 1;
