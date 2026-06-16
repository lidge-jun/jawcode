import { describe, expect, it } from "bun:test";
import * as path from "node:path";

/**
 * Brand-conditional visual identity (086): running as a branded shell
 * (GJC_BRAND_NAME=jwc, like bin/jwc.js sets) must default to the jaw
 * abyss-bite theme and the Jawcode banner, while the upstream gjc shell
 * keeps red-claw and the claw banner. APP_NAME is resolved at module load,
 * so each side runs in its own subprocess.
 */

const repoRoot = path.resolve(import.meta.dir, "../../..");

const PROBE = `
import { initTheme, getCurrentThemeName } from ${JSON.stringify(
	path.join(repoRoot, "packages/coding-agent/src/modes/theme/theme.ts"),
)};
import { WelcomeComponent } from ${JSON.stringify(
	path.join(repoRoot, "packages/coding-agent/src/modes/components/welcome.ts"),
)};
await initTheme();
const w = new WelcomeComponent("0.0.0", "test-model", "test-provider");
const text = w.render(120).join("\\n");
const fullLineCount = w.render(120).length;
w.getViewportRows = () => 12;
const shortLines = w.render(120);
const shortText = shortLines.join("\\n");
console.log(
	JSON.stringify({
		theme: getCurrentThemeName(),
		hasJawWordmark: text.includes("Jawcode") && text.includes("bite · build · ship"),
		hasClawWordmark: text.includes("Gajae forge") && text.includes("shape · act · prove"),
		fullLineCount,
		shortLineCount: shortLines.length,
		shortKeepsIdentity: shortText.includes("Jawcode") || shortText.includes("Gajae forge"),
	}),
);
`;

function probeBrand(brandName: string | undefined): {
	theme: string;
	hasJawWordmark: boolean;
	hasClawWordmark: boolean;
	fullLineCount: number;
	shortLineCount: number;
	shortKeepsIdentity: boolean;
} {
	const env: Record<string, string | undefined> = { ...process.env };
	delete env.GJC_BRAND_NAME;
	if (brandName !== undefined) env.GJC_BRAND_NAME = brandName;
	const proc = Bun.spawnSync(["bun", "-e", PROBE], { cwd: repoRoot, env });
	if (proc.exitCode !== 0) {
		throw new Error(`probe failed (brand=${brandName}): ${proc.stderr.toString()}`);
	}
	const stdout = proc.stdout.toString().trim();
	const lastLine = stdout.split("\n").at(-1) ?? "";
	return JSON.parse(lastLine);
}

describe("brand-conditional visual identity", () => {
	it("jwc brand defaults to abyss-bite theme with the Jawcode banner", () => {
		const result = probeBrand("jwc");
		expect(result.theme).toBe("abyss-bite");
		expect(result.hasJawWordmark).toBe(true);
		expect(result.hasClawWordmark).toBe(false);
	});

	it("gjc compatibility entrypoint keeps the current Jawcode visual identity", () => {
		const result = probeBrand("gjc");
		expect(result.theme).toBe("abyss-bite");
		expect(result.hasJawWordmark).toBe(true);
		expect(result.hasClawWordmark).toBe(false);
	});

	it("jwc banner collapses to the compact variant in short viewports (devlog 086.1)", () => {
		const result = probeBrand("jwc");
		expect(result.shortLineCount).toBeLessThan(result.fullLineCount);
		expect(result.shortLineCount).toBeLessThanOrEqual(5);
		expect(result.shortKeepsIdentity).toBe(true);
	});

	it("gjc compatibility banner uses the compact viewport-aware variant", () => {
		const result = probeBrand("gjc");
		expect(result.shortLineCount).toBeLessThan(result.fullLineCount);
	});
});
