import { describe, expect, it } from "vitest";
import {
	INTENSITY_SCALE,
	intensityScale,
	MAX_PIXEL_SIZE,
	MIN_PIXEL_SIZE,
	mosaicPixelSize,
} from "../lib/editor/mosaic";

describe("mosaicPixelSize", () => {
	it("短辺の約 1/12 を基準にする", () => {
		// 短辺 240 → 240/12 = 20
		expect(mosaicPixelSize(600, 240)).toBe(20);
		// 幅・高さの順に依らず短辺で決まる
		expect(mosaicPixelSize(240, 600)).toBe(20);
	});

	it("小さい領域では下限 MIN_PIXEL_SIZE を保証する", () => {
		// 24/12 = 2 だが下限 8 にクランプ
		expect(mosaicPixelSize(24, 24)).toBe(MIN_PIXEL_SIZE);
		expect(mosaicPixelSize(10, 500)).toBe(MIN_PIXEL_SIZE);
	});

	it("大きい領域では上限 MAX_PIXEL_SIZE でクランプする", () => {
		// 2000/12 ≈ 167 だが上限 64 にクランプ
		expect(mosaicPixelSize(3000, 2000)).toBe(MAX_PIXEL_SIZE);
	});

	it("下限と上限の間では四捨五入した値を返す", () => {
		// 短辺 150 → 150/12 = 12.5 → round → 13
		expect(mosaicPixelSize(150, 400)).toBe(13);
		// 短辺 200 → 200/12 ≈ 16.67 → round → 17
		expect(mosaicPixelSize(200, 200)).toBe(17);
	});

	it("下限・上限は MIN < MAX の妥当な範囲", () => {
		expect(MIN_PIXEL_SIZE).toBeLessThan(MAX_PIXEL_SIZE);
		expect(MIN_PIXEL_SIZE).toBeGreaterThanOrEqual(1);
	});

	it("intensity 省略時は従来値（標準）と一致する", () => {
		// 引数 2 個（従来シグネチャ）と intensity="normal" が同値であることを確認。
		expect(mosaicPixelSize(600, 240)).toBe(mosaicPixelSize(600, 240, "normal"));
	});

	it("強度で粒度が変わる（弱 < 標準 < 強、クランプ範囲内で）", () => {
		// 短辺 240: 標準 20 / 弱 240/12*0.6=12 / 強 240/12*1.6=32。
		expect(mosaicPixelSize(600, 240, "weak")).toBe(12);
		expect(mosaicPixelSize(600, 240, "normal")).toBe(20);
		expect(mosaicPixelSize(600, 240, "strong")).toBe(32);
	});

	it("強度を掛けても下限・上限のクランプは維持する", () => {
		// 小さい領域は弱でも下限 MIN_PIXEL_SIZE。
		expect(mosaicPixelSize(24, 24, "weak")).toBe(MIN_PIXEL_SIZE);
		// 大きい領域は強でも上限 MAX_PIXEL_SIZE。
		expect(mosaicPixelSize(3000, 2000, "strong")).toBe(MAX_PIXEL_SIZE);
	});
});

describe("intensityScale", () => {
	it("3 段階の倍率を返す（弱 0.6 / 標準 1.0 / 強 1.6）", () => {
		expect(intensityScale("weak")).toBe(0.6);
		expect(intensityScale("normal")).toBe(1.0);
		expect(intensityScale("strong")).toBe(1.6);
	});

	it("省略時は標準（1.0）", () => {
		expect(intensityScale()).toBe(1.0);
		expect(intensityScale(undefined)).toBe(1.0);
	});

	it("INTENSITY_SCALE は弱 < 標準 < 強", () => {
		expect(INTENSITY_SCALE.weak).toBeLessThan(INTENSITY_SCALE.normal);
		expect(INTENSITY_SCALE.normal).toBeLessThan(INTENSITY_SCALE.strong);
	});
});
