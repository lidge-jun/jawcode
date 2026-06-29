import { describe, expect, test } from "bun:test";
import { inferRegionFromProfileArn, normalizeKiroRegion } from "./kiro";

describe("kiro region hardening", () => {
	test("normalizeKiroRegion accepts well-formed AWS regions", () => {
		expect(normalizeKiroRegion("us-east-1")).toBe("us-east-1");
		expect(normalizeKiroRegion("ap-northeast-2")).toBe("ap-northeast-2");
		expect(normalizeKiroRegion("eu-central-1")).toBe("eu-central-1");
		expect(normalizeKiroRegion("  us-west-2  ")).toBe("us-west-2");
	});

	test("normalizeKiroRegion rejects malformed/injection-y values", () => {
		expect(normalizeKiroRegion(undefined)).toBeUndefined();
		expect(normalizeKiroRegion("")).toBeUndefined();
		expect(normalizeKiroRegion("not-a-region")).toBeUndefined();
		expect(normalizeKiroRegion("us-east-1/../evil")).toBeUndefined();
		expect(normalizeKiroRegion("US-EAST-1")).toBeUndefined();
	});

	test("inferRegionFromProfileArn pulls the region segment when valid", () => {
		expect(inferRegionFromProfileArn("arn:aws:codewhisperer:us-east-1:123456789012:profile/ABC")).toBe("us-east-1");
		expect(inferRegionFromProfileArn("arn:aws:codewhisperer:eu-west-1:123456789012:profile/ABC")).toBe("eu-west-1");
	});

	test("inferRegionFromProfileArn returns undefined for missing/garbage ARNs", () => {
		expect(inferRegionFromProfileArn(undefined)).toBeUndefined();
		expect(inferRegionFromProfileArn("")).toBeUndefined();
		expect(inferRegionFromProfileArn("not-an-arn")).toBeUndefined();
		expect(inferRegionFromProfileArn("arn:aws:svc:bogus:acct:res")).toBeUndefined();
	});
});
