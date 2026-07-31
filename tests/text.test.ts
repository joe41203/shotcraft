import { describe, expect, it } from "vitest";
import {
	clampFontSize,
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
