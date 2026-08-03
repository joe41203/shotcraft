import { describe, expect, it } from "vitest";
import {
	clampFontSize,
	DEFAULT_FONT_SIZE,
	FONT_SIZE_OPTIONS,
	isFontSizePreset,
	MAX_FONT_SIZE,
	MIN_FONT_SIZE,
} from "../lib/editor/text";

describe("clampFontSize", () => {
	it("範囲内の値はそのまま返す（端数も保持する）", () => {
		expect(clampFontSize(24)).toBe(24);
		expect(clampFontSize(37.5)).toBe(37.5);
	});

	it("下限未満は MIN_FONT_SIZE にクランプする", () => {
		expect(clampFontSize(0)).toBe(MIN_FONT_SIZE);
		expect(clampFontSize(3)).toBe(MIN_FONT_SIZE);
		expect(clampFontSize(-100)).toBe(MIN_FONT_SIZE);
	});

	it("上限超過は MAX_FONT_SIZE にクランプする", () => {
		expect(clampFontSize(500)).toBe(MAX_FONT_SIZE);
		expect(clampFontSize(MAX_FONT_SIZE + 0.1)).toBe(MAX_FONT_SIZE);
	});

	it("境界値ちょうどは通す", () => {
		expect(clampFontSize(MIN_FONT_SIZE)).toBe(MIN_FONT_SIZE);
		expect(clampFontSize(MAX_FONT_SIZE)).toBe(MAX_FONT_SIZE);
	});

	it("NaN / Infinity は下限へ落とす", () => {
		expect(clampFontSize(Number.NaN)).toBe(MIN_FONT_SIZE);
		expect(clampFontSize(Number.POSITIVE_INFINITY)).toBe(MAX_FONT_SIZE);
		expect(clampFontSize(Number.NEGATIVE_INFINITY)).toBe(MIN_FONT_SIZE);
	});
});

describe("FONT_SIZE_OPTIONS", () => {
	it("S / M / L の 3 段階で昇順（M は既定サイズと一致）", () => {
		expect(FONT_SIZE_OPTIONS.map((o) => o.value)).toEqual([
			18,
			DEFAULT_FONT_SIZE,
			36,
		]);
		expect(FONT_SIZE_OPTIONS.map((o) => o.label)).toEqual(["S", "M", "L"]);
	});

	it("すべて clamp 範囲内", () => {
		for (const o of FONT_SIZE_OPTIONS) {
			expect(o.value).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
			expect(o.value).toBeLessThanOrEqual(MAX_FONT_SIZE);
		}
	});
});

describe("isFontSizePreset", () => {
	it("プリセット（18 / 24 / 36）に一致すれば true", () => {
		expect(isFontSizePreset(18)).toBe(true);
		expect(isFontSizePreset(24)).toBe(true);
		expect(isFontSizePreset(36)).toBe(true);
	});

	it("プリセット外（ハンドルドラッグの連続値）は false", () => {
		expect(isFontSizePreset(20)).toBe(false);
		expect(isFontSizePreset(37.5)).toBe(false);
		expect(isFontSizePreset(24.0001)).toBe(false);
	});
});
