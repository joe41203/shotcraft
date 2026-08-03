import { describe, expect, it } from "vitest";
import {
	blurCornerRadius,
	blurRadius,
	MAX_BLUR_CORNER_RADIUS,
	MAX_BLUR_RADIUS,
	MIN_BLUR_CORNER_RADIUS,
	MIN_BLUR_RADIUS,
} from "../lib/editor/blur";

describe("blurRadius", () => {
	it("短辺の約 1/12 を基準にする", () => {
		// 短辺 240 → 240/12 = 20
		expect(blurRadius(600, 240)).toBe(20);
		// 幅・高さの順に依らず短辺で決まる
		expect(blurRadius(240, 600)).toBe(20);
	});

	it("小さい領域では下限 MIN_BLUR_RADIUS を保証する", () => {
		// 24/12 = 2 だが下限 4 にクランプ
		expect(blurRadius(24, 24)).toBe(MIN_BLUR_RADIUS);
		expect(blurRadius(10, 500)).toBe(MIN_BLUR_RADIUS);
	});

	it("大きい領域では上限 MAX_BLUR_RADIUS でクランプする", () => {
		// 2000/12 ≈ 167 だが上限 32 にクランプ
		expect(blurRadius(3000, 2000)).toBe(MAX_BLUR_RADIUS);
	});

	it("下限と上限の間では四捨五入した値を返す", () => {
		// 短辺 150 → 150/12 = 12.5 → round → 13
		expect(blurRadius(150, 400)).toBe(13);
		// 短辺 200 → 200/12 ≈ 16.67 → round → 17
		expect(blurRadius(200, 200)).toBe(17);
	});

	it("下限・上限は MIN < MAX の妥当な範囲", () => {
		expect(MIN_BLUR_RADIUS).toBeLessThan(MAX_BLUR_RADIUS);
		expect(MIN_BLUR_RADIUS).toBeGreaterThanOrEqual(1);
	});

	it("intensity 省略時は従来値（標準）と一致する", () => {
		expect(blurRadius(600, 240)).toBe(blurRadius(600, 240, "normal"));
	});

	it("強度でぼかし半径が変わる（弱 < 標準 < 強、クランプ範囲内で）", () => {
		// 短辺 240: 標準 20 / 弱 240/12*0.6=12 / 強 240/12*1.6=32（上限 32 に一致）。
		expect(blurRadius(600, 240, "weak")).toBe(12);
		expect(blurRadius(600, 240, "normal")).toBe(20);
		expect(blurRadius(600, 240, "strong")).toBe(MAX_BLUR_RADIUS);
	});

	it("強度を掛けても下限・上限のクランプは維持する", () => {
		expect(blurRadius(24, 24, "weak")).toBe(MIN_BLUR_RADIUS);
		expect(blurRadius(3000, 2000, "strong")).toBe(MAX_BLUR_RADIUS);
	});
});

describe("blurCornerRadius", () => {
	it("短辺の約 12% を採る（スポットライトの穴と統一の半径ルール）", () => {
		// 短辺 100 の 12% = 12px（下限 4・上限 16 の内側）。
		expect(blurCornerRadius(200, 100)).toBeCloseTo(12);
		expect(blurCornerRadius(100, 200)).toBeCloseTo(12);
	});

	it("小さい領域は下限 MIN_BLUR_CORNER_RADIUS にクランプ", () => {
		// 短辺 10 の 12% = 1.2px → 下限 4。
		expect(blurCornerRadius(10, 10)).toBe(MIN_BLUR_CORNER_RADIUS);
	});

	it("大きい領域は上限 MAX_BLUR_CORNER_RADIUS にクランプ", () => {
		// 短辺 1000 の 12% = 120px → 上限 16。
		expect(blurCornerRadius(1000, 1000)).toBe(MAX_BLUR_CORNER_RADIUS);
	});

	it("負の寸法でも絶対値で扱う", () => {
		expect(blurCornerRadius(-200, -100)).toBeCloseTo(12);
	});

	it("下限・上限は MIN < MAX の妥当な範囲", () => {
		expect(MIN_BLUR_CORNER_RADIUS).toBeLessThan(MAX_BLUR_CORNER_RADIUS);
		expect(MIN_BLUR_CORNER_RADIUS).toBeGreaterThanOrEqual(1);
	});
});
