import { describe, expect, it } from "vitest";
import {
	blurRadius,
	MAX_BLUR_RADIUS,
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
});
