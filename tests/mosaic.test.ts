import { describe, expect, it } from "vitest";
import {
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
});
