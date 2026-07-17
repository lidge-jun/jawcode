import { describe, expect, it } from "bun:test";
import { ImageProtocol, TerminalInfo } from "@jawcode-dev/tui/terminal-capabilities";

describe("Kitty image-line detection", () => {
	const kitty = new TerminalInfo("kitty", ImageProtocol.Kitty, true, true);

	it("accepts real Kitty graphics controls without treating anchored prose as an image", () => {
		expect(kitty.isImageLine("\x1b_Ga=p,i=1,p=1,c=10,r=2,C=1,q=2\x1b\\")).toBe(true);
		expect(kitty.isImageLine("\x1b_Gf=100,a=T;AAAA\x1b\\")).toBe(true);
		expect(kitty.isImageLine("\x1b_GJC_ANCHOR:token:0:1:0:2\x1b\\한국어 prose")).toBe(false);
	});
});
