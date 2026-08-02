import { describe, expect, it } from "vitest";
import type { ShapeType } from "../lib/editor/doc";
import {
	clampSpotlightHole,
	SPOTLIGHT_DIM_ALPHA,
	spotlightCornerRadius,
	spotlightFeather,
	spotlightVeilIndex,
} from "../lib/editor/spotlight";

const SIZE = { width: 100, height: 80 };

/** ShapeType の配列を spotlightVeilIndex に渡せる形（{ type } の配列）へ変換する。 */
function shapes(...types: ShapeType[]): { type: ShapeType }[] {
	return types.map((type) => ({ type }));
}

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

	it("視線誘導を強めた濃さ（0.70）", () => {
		expect(SPOTLIGHT_DIM_ALPHA).toBe(0.7);
	});
});

describe("spotlightCornerRadius", () => {
	it("短辺の約 12% を採る（下限・上限の内側）", () => {
		// 短辺 100 の 12% = 12px（下限 4・上限 16 の内側）。
		expect(spotlightCornerRadius(200, 100)).toBeCloseTo(12);
		expect(spotlightCornerRadius(100, 200)).toBeCloseTo(12);
	});

	it("小さい穴は下限 4px にクランプ", () => {
		// 短辺 10 の 12% = 1.2px → 下限 4。
		expect(spotlightCornerRadius(10, 10)).toBe(4);
	});

	it("大きい穴は上限 16px にクランプ", () => {
		// 短辺 1000 の 12% = 120px → 上限 16。
		expect(spotlightCornerRadius(1000, 1000)).toBe(16);
	});

	it("負の寸法（逆方向ドラッグ）でも絶対値で扱う", () => {
		expect(spotlightCornerRadius(-200, -100)).toBeCloseTo(12);
	});
});

describe("spotlightFeather", () => {
	it("短辺の約 8% を採る（下限・上限の内側）", () => {
		// 短辺 200 の 8% = 16px（下限 6・上限 24 の内側）。
		expect(spotlightFeather(300, 200)).toBeCloseTo(16);
		expect(spotlightFeather(200, 300)).toBeCloseTo(16);
	});

	it("小さい穴は下限 6px にクランプ", () => {
		// 短辺 20 の 8% = 1.6px → 下限 6。
		expect(spotlightFeather(20, 20)).toBe(6);
	});

	it("大きい穴は上限 24px にクランプ", () => {
		// 短辺 1000 の 8% = 80px → 上限 24。
		expect(spotlightFeather(1000, 1000)).toBe(24);
	});

	it("負の寸法でも絶対値で扱う", () => {
		expect(spotlightFeather(-300, -200)).toBeCloseTo(16);
	});
});

describe("spotlightVeilIndex", () => {
	it("注釈系が無ければ最上位（配列長）", () => {
		expect(spotlightVeilIndex(shapes())).toBe(0);
		expect(spotlightVeilIndex(shapes("spotlight"))).toBe(1);
		expect(spotlightVeilIndex(shapes("mosaic", "blur", "spotlight"))).toBe(3);
	});

	it("最初の注釈系図形のインデックスを返す（描き順に依らない）", () => {
		// spotlight が先にあっても、暗幕は最初の注釈（arrow）の位置に入る。
		expect(spotlightVeilIndex(shapes("spotlight", "arrow"))).toBe(1);
		// 注釈が先頭なら 0（＝全図形の上でなく最下）。
		expect(spotlightVeilIndex(shapes("text", "spotlight"))).toBe(0);
	});

	it("注釈より前の mosaic/blur は暗幕の下（インデックスが注釈側で決まる）", () => {
		// mosaic → blur → arrow → spotlight。最初の注釈 arrow は index 2。
		// 暗幕は index 2 に入り、mosaic/blur（0,1）は暗幕の下＝暗くなる。
		expect(
			spotlightVeilIndex(shapes("mosaic", "blur", "arrow", "spotlight")),
		).toBe(2);
	});

	it("モザイクを注釈の後（最前面）へ置くハックは維持される", () => {
		// arrow（注釈）→ mosaic（最前面）。最初の注釈 arrow が index 0 なので暗幕は 0。
		// 後ろの mosaic（index 1）は暗幕より上に来て注釈を隠せる。
		expect(spotlightVeilIndex(shapes("arrow", "mosaic"))).toBe(0);
	});

	it("各種注釈系 type を注釈として扱う", () => {
		for (const t of [
			"arrow",
			"rect",
			"ellipse",
			"text",
			"pen",
			"marker",
			"step",
			"callout",
		] as ShapeType[]) {
			// spotlight を先頭に置いても、注釈 type の位置（index 1）に暗幕が入る。
			expect(spotlightVeilIndex(shapes("spotlight", t))).toBe(1);
		}
	});
});
