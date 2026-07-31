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

	it("同梱フォント key を各スタックへ解決する（先頭 family が一致）", () => {
		expect(resolveFontStack("mochiy")).toBe(FONT_CHOICES.mochiy.stack);
		expect(resolveFontStack("mochiy")).toContain("Mochiy Pop One");
		expect(resolveFontStack("hachi")).toBe(FONT_CHOICES.hachi.stack);
		expect(resolveFontStack("hachi")).toContain("Hachi Maru Pop");
		expect(resolveFontStack("yomogi")).toBe(FONT_CHOICES.yomogi.stack);
		expect(resolveFontStack("yomogi")).toContain("Yomogi");
		expect(resolveFontStack("kiwi")).toBe(FONT_CHOICES.kiwi.stack);
		expect(resolveFontStack("kiwi")).toContain("Kiwi Maru");
		expect(resolveFontStack("mplus")).toBe(FONT_CHOICES.mplus.stack);
		expect(resolveFontStack("mplus")).toContain("M PLUS Rounded 1c");
		expect(resolveFontStack("kosugi")).toBe(FONT_CHOICES.kosugi.stack);
		expect(resolveFontStack("kosugi")).toContain("Kosugi Maru");
	});

	it("レガシー key 'rounded'（Zen Maru 時代の既存注釈）は kiwi へ移行する", () => {
		expect(resolveFontStack("rounded")).toBe(FONT_CHOICES.kiwi.stack);
		expect(resolveFontStack("rounded")).toContain("Kiwi Maru");
	});

	it("レガシー key 'pop'（3フォント版のはちまるポップ既定）は hachi へ移行する", () => {
		expect(resolveFontStack("pop")).toBe(FONT_CHOICES.hachi.stack);
		expect(resolveFontStack("pop")).toContain("Hachi Maru Pop");
	});

	it("未知の key は既定（mochiy / モッチーポップ）にフォールバックする", () => {
		expect(resolveFontStack("unknown")).toBe(
			FONT_CHOICES[DEFAULT_FONT_FAMILY].stack,
		);
		expect(resolveFontStack("unknown")).toContain("Mochiy Pop One");
	});

	it("undefined(旧データで fontFamily 未設定)は既定(mochiy)にフォールバックする", () => {
		expect(resolveFontStack(undefined)).toBe(
			FONT_CHOICES[DEFAULT_FONT_FAMILY].stack,
		);
	});

	it("既定フォントは mochiy で、その stack は モッチーポップ", () => {
		expect(DEFAULT_FONT_FAMILY).toBe("mochiy");
		expect(resolveFontStack("mochiy")).toContain("Mochiy Pop One");
	});
});
