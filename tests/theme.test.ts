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

	it("未知の key は rounded(既定)にフォールバックする", () => {
		expect(resolveFontStack("unknown")).toBe(
			FONT_CHOICES[DEFAULT_FONT_FAMILY].stack,
		);
	});

	it("undefined(旧データで fontFamily 未設定)は rounded にフォールバックする", () => {
		expect(resolveFontStack(undefined)).toBe(
			FONT_CHOICES[DEFAULT_FONT_FAMILY].stack,
		);
	});

	it("既定フォントは rounded で、その stack は丸ゴシック(theme.fontSans 相当)", () => {
		expect(DEFAULT_FONT_FAMILY).toBe("rounded");
		expect(resolveFontStack("rounded")).toContain("Zen Maru Gothic");
	});
});
