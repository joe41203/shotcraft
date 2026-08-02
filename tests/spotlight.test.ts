import { describe, expect, it } from "vitest";
import {
	clampSpotlightHole,
	SPOTLIGHT_DIM_ALPHA,
} from "../lib/editor/spotlight";

const SIZE = { width: 100, height: 80 };

describe("clampSpotlightHole", () => {
	it("画像内に収まる矩形はそのまま返す", () => {
		expect(
			clampSpotlightHole({ x: 10, y: 20, width: 30, height: 40 }, SIZE),
		).toEqual({
			x: 10,
			y: 20,
			width: 30,
			height: 40,
		});
	});

	it("負の幅・高さ（逆方向ドラッグ）を正規化する", () => {
		// 右下 (40,60) から左上 (10,20) 方向へのドラッグ相当。
		expect(
			clampSpotlightHole({ x: 40, y: 60, width: -30, height: -40 }, SIZE),
		).toEqual({
			x: 10,
			y: 20,
			width: 30,
			height: 40,
		});
	});

	it("画像外へはみ出す矩形を境界へクランプする", () => {
		// 左上が負、右下が画像外。両端を [0,size] へ丸める。
		expect(
			clampSpotlightHole({ x: -20, y: -10, width: 200, height: 200 }, SIZE),
		).toEqual({
			x: 0,
			y: 0,
			width: 100,
			height: 80,
		});
	});

	it("片側だけはみ出す矩形も境界でクランプする", () => {
		expect(
			clampSpotlightHole({ x: 80, y: 60, width: 40, height: 40 }, SIZE),
		).toEqual({
			x: 80,
			y: 60,
			width: 20,
			height: 20,
		});
	});

	it("完全に画像外の矩形は null（穴を開けない）", () => {
		expect(
			clampSpotlightHole({ x: 200, y: 200, width: 10, height: 10 }, SIZE),
		).toBeNull();
	});

	it("幅・高さが 0 の矩形は null", () => {
		expect(
			clampSpotlightHole({ x: 10, y: 10, width: 0, height: 20 }, SIZE),
		).toBeNull();
		expect(
			clampSpotlightHole({ x: 10, y: 10, width: 20, height: 0 }, SIZE),
		).toBeNull();
	});
});

describe("SPOTLIGHT_DIM_ALPHA", () => {
	it("0〜1 の妥当な不透明度", () => {
		expect(SPOTLIGHT_DIM_ALPHA).toBeGreaterThan(0);
		expect(SPOTLIGHT_DIM_ALPHA).toBeLessThanOrEqual(1);
	});
});
