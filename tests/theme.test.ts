import { describe, expect, it } from "vitest";
import { theme } from "../lib/theme";

describe("theme フォントスタック", () => {
	it("UI フォント（fontSans）は同梱フォントを含まないシステムフォントスタック", () => {
		// UI は OS のシステムフォントに依存する。同梱の Mochiy Pop One は含めない。
		expect(theme.fontSans).not.toContain("Mochiy Pop One");
		expect(theme.fontSans).toContain("-apple-system");
		expect(theme.fontSans).toContain("system-ui");
	});

	it("注釈フォント（fontAnnotation）は Mochiy Pop One 先頭 + システムフォールバック", () => {
		// テキスト注釈は同梱の Mochiy Pop One 固定。以降はシステムフォールバック。
		expect(theme.fontAnnotation.startsWith('"Mochiy Pop One"')).toBe(true);
		expect(theme.fontAnnotation).toContain("-apple-system");
	});
});
