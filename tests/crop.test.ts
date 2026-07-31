import { describe, expect, it } from "vitest";
import {
	clampCropRect,
	cropBounds,
	cropRectEquals,
	croppedSize,
	MIN_CROP,
} from "../lib/editor/crop";
import type { CropRect } from "../lib/editor/doc";

const IMAGE = { width: 800, height: 500 };

describe("cropBounds", () => {
	it("crop が null なら画像全体を返す", () => {
		expect(cropBounds(null, IMAGE)).toEqual({
			x: 0,
			y: 0,
			width: 800,
			height: 500,
		});
	});

	it("crop があればその矩形自身を返す", () => {
		const crop: CropRect = { x: 100, y: 80, width: 400, height: 300 };
		expect(cropBounds(crop, IMAGE)).toBe(crop);
	});
});

describe("clampCropRect", () => {
	const fullBounds: CropRect = { x: 0, y: 0, width: 800, height: 500 };

	it("bounds 内の選択はそのまま（丸めのみ）返す", () => {
		const sel: CropRect = { x: 100, y: 80, width: 400, height: 300 };
		expect(clampCropRect(sel, fullBounds)).toEqual({
			x: 100,
			y: 80,
			width: 400,
			height: 300,
		});
	});

	it("小数座標は整数へ丸める", () => {
		const sel: CropRect = { x: 100.4, y: 80.6, width: 200.5, height: 100.4 };
		const out = clampCropRect(sel, fullBounds);
		expect(Number.isInteger(out.x)).toBe(true);
		expect(Number.isInteger(out.y)).toBe(true);
		expect(Number.isInteger(out.width)).toBe(true);
		expect(Number.isInteger(out.height)).toBe(true);
	});

	it("bounds をはみ出す選択は bounds 内にクランプする", () => {
		const sel: CropRect = { x: -50, y: -30, width: 2000, height: 2000 };
		const out = clampCropRect(sel, fullBounds);
		expect(out.x).toBe(0);
		expect(out.y).toBe(0);
		expect(out.x + out.width).toBeLessThanOrEqual(800);
		expect(out.y + out.height).toBeLessThanOrEqual(500);
	});

	it("最小サイズ MIN_CROP を保証する", () => {
		const sel: CropRect = { x: 10, y: 10, width: 1, height: 1 };
		const out = clampCropRect(sel, fullBounds);
		expect(out.width).toBeGreaterThanOrEqual(MIN_CROP);
		expect(out.height).toBeGreaterThanOrEqual(MIN_CROP);
	});

	it("再クロップ: 既存 crop を bounds とし、その中で合成する（入れ子にしない）", () => {
		// 1 回目の crop 相当を bounds にする。
		const bounds: CropRect = { x: 100, y: 80, width: 400, height: 300 };
		// bounds 内の選択（元画像座標系のまま）。
		const sel: CropRect = { x: 150, y: 120, width: 200, height: 150 };
		const out = clampCropRect(sel, bounds);
		// 元画像座標系の単一矩形として保持される（bounds を足し込んだりしない）。
		expect(out).toEqual({ x: 150, y: 120, width: 200, height: 150 });
	});

	it("再クロップ: 選択が bounds をはみ出しても bounds 内に収める", () => {
		const bounds: CropRect = { x: 100, y: 80, width: 400, height: 300 };
		// bounds の右下を超える選択。
		const sel: CropRect = { x: 300, y: 200, width: 500, height: 500 };
		const out = clampCropRect(sel, bounds);
		expect(out.x).toBeGreaterThanOrEqual(bounds.x);
		expect(out.y).toBeGreaterThanOrEqual(bounds.y);
		expect(out.x + out.width).toBeLessThanOrEqual(bounds.x + bounds.width);
		expect(out.y + out.height).toBeLessThanOrEqual(bounds.y + bounds.height);
	});
});

describe("cropRectEquals", () => {
	it("全成分一致で true", () => {
		const a: CropRect = { x: 1, y: 2, width: 3, height: 4 };
		expect(cropRectEquals(a, { ...a })).toBe(true);
	});

	it("1 成分でも異なれば false", () => {
		const a: CropRect = { x: 1, y: 2, width: 3, height: 4 };
		expect(cropRectEquals(a, { ...a, width: 30 })).toBe(false);
	});

	it("bounds と一致する適用は no-op 判定に使える", () => {
		const bounds: CropRect = { x: 0, y: 0, width: 800, height: 500 };
		// 画像全体を選んだら bounds と一致 → クロップ実質なし。
		const applied = clampCropRect(
			{ x: 0, y: 0, width: 800, height: 500 },
			bounds,
		);
		expect(cropRectEquals(applied, bounds)).toBe(true);
	});
});

describe("croppedSize", () => {
	it("crop が null なら画像原寸", () => {
		expect(croppedSize(null, IMAGE)).toEqual({ width: 800, height: 500 });
	});

	it("crop があればその寸法", () => {
		const crop: CropRect = { x: 100, y: 80, width: 400, height: 300 };
		expect(croppedSize(crop, IMAGE)).toEqual({ width: 400, height: 300 });
	});
});
