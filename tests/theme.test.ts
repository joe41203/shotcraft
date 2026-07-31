import { describe, expect, it } from "vitest";
import {
	DEFAULT_FONT_FAMILY,
	FONT_CHOICES,
	resolveFontStack,
} from "../lib/theme";

describe("resolveFontStack", () => {
	it("既知の key を対応するスタックへ解決する", () => {
		for (const key of Object.keys(
			FONT_CHOICES,
		) as (keyof typeof FONT_CHOICES)[]) {
			expect(resolveFontStack(key)).toBe(FONT_CHOICES[key].stack);
		}
	});

	it("新フォント key（pop / yomogi / kiwi）を各スタックへ解決する", () => {
		expect(resolveFontStack("pop")).toBe(FONT_CHOICES.pop.stack);
		expect(resolveFontStack("pop")).toContain("Hachi Maru Pop");
		expect(resolveFontStack("yomogi")).toBe(FONT_CHOICES.yomogi.stack);
		expect(resolveFontStack("yomogi")).toContain("Yomogi");
		expect(resolveFontStack("kiwi")).toBe(FONT_CHOICES.kiwi.stack);
		expect(resolveFontStack("kiwi")).toContain("Kiwi Maru");
	});

	it("レガシー key 'rounded'（Zen Maru 時代の既存注釈）は kiwi へ移行する", () => {
		expect(resolveFontStack("rounded")).toBe(FONT_CHOICES.kiwi.stack);
		expect(resolveFontStack("rounded")).toContain("Kiwi Maru");
	});

	it("未知の key は既定（pop / はちまるポップ）にフォールバックする", () => {
		expect(resolveFontStack("unknown")).toBe(
			FONT_CHOICES[DEFAULT_FONT_FAMILY].stack,
		);
		expect(resolveFontStack("unknown")).toContain("Hachi Maru Pop");
	});

	it("undefined(旧データで fontFamily 未設定)は既定(pop)にフォールバックする", () => {
		expect(resolveFontStack(undefined)).toBe(
			FONT_CHOICES[DEFAULT_FONT_FAMILY].stack,
		);
	});

	it("既定フォントは pop で、その stack は はちまるポップ", () => {
		expect(DEFAULT_FONT_FAMILY).toBe("pop");
		expect(resolveFontStack("pop")).toContain("Hachi Maru Pop");
	});
});
