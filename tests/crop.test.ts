import { describe, expect, it } from "vitest";
import {
	clampCropRect,
	constrainResizeToRatio,
	cropBounds,
	croppedSize,
	cropRatioValue,
	cropRectEquals,
	fitRectToRatio,
	MIN_CROP,
	normalizeCropRatio,
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

describe("normalizeCropRatio", () => {
	it("4 値はそのまま通す", () => {
		expect(normalizeCropRatio("free")).toBe("free");
		expect(normalizeCropRatio("1:1")).toBe("1:1");
		expect(normalizeCropRatio("4:3")).toBe("4:3");
		expect(normalizeCropRatio("16:9")).toBe("16:9");
	});

	it("未設定・不正値は free（拘束なし）へ", () => {
		expect(normalizeCropRatio(undefined)).toBe("free");
		expect(normalizeCropRatio(null)).toBe("free");
		expect(normalizeCropRatio("2:1")).toBe("free");
		expect(normalizeCropRatio(1)).toBe("free");
	});
});

describe("cropRatioValue", () => {
	it("free は拘束なし（null）", () => {
		expect(cropRatioValue("free")).toBeNull();
	});

	it("各比率を幅/高さの数値で返す", () => {
		expect(cropRatioValue("1:1")).toBe(1);
		expect(cropRatioValue("4:3")).toBeCloseTo(4 / 3);
		expect(cropRatioValue("16:9")).toBeCloseTo(16 / 9);
	});
});

describe("fitRectToRatio", () => {
	const bounds: CropRect = { x: 0, y: 0, width: 800, height: 500 };

	it("ratio=null（自由）は中心を保って bounds 内へクランプするだけ", () => {
		const rect: CropRect = { x: 100, y: 100, width: 200, height: 150 };
		const out = fitRectToRatio(rect, null, bounds);
		expect(out).toEqual(rect); // 既に bounds 内・比率不問なので不変
	});

	it("1:1 は正方形になる（幅=高さ）", () => {
		const rect: CropRect = { x: 100, y: 100, width: 300, height: 100 };
		const out = fitRectToRatio(rect, 1, bounds);
		expect(out.width).toBeCloseTo(out.height);
	});

	it("16:9 は幅/高さが比率どおりになる", () => {
		const rect: CropRect = { x: 100, y: 100, width: 200, height: 200 };
		const out = fitRectToRatio(rect, 16 / 9, bounds);
		expect(out.width / out.height).toBeCloseTo(16 / 9);
	});

	it("中心を保つ（整形前後で中心座標が一致。bounds 内に収まる限り）", () => {
		const rect: CropRect = { x: 300, y: 200, width: 200, height: 200 };
		const cx = rect.x + rect.width / 2;
		const cy = rect.y + rect.height / 2;
		const out = fitRectToRatio(rect, 4 / 3, bounds);
		expect(out.x + out.width / 2).toBeCloseTo(cx);
		expect(out.y + out.height / 2).toBeCloseTo(cy);
	});

	it("bounds を超えないよう縮めつつ比率を保つ", () => {
		// 巨大な枠を 16:9 に整形しても bounds に収まる。
		const rect: CropRect = { x: 0, y: 0, width: 5000, height: 5000 };
		const out = fitRectToRatio(rect, 16 / 9, bounds);
		expect(out.x).toBeGreaterThanOrEqual(bounds.x);
		expect(out.y).toBeGreaterThanOrEqual(bounds.y);
		expect(out.x + out.width).toBeLessThanOrEqual(
			bounds.x + bounds.width + 1e-6,
		);
		expect(out.y + out.height).toBeLessThanOrEqual(
			bounds.y + bounds.height + 1e-6,
		);
		expect(out.width / out.height).toBeCloseTo(16 / 9);
	});

	it("既存 crop を bounds とした再クロップでも中に収まる", () => {
		const inner: CropRect = { x: 100, y: 80, width: 400, height: 300 };
		const rect: CropRect = { x: 150, y: 120, width: 300, height: 300 };
		const out = fitRectToRatio(rect, 1, inner);
		expect(out.x).toBeGreaterThanOrEqual(inner.x - 1e-6);
		expect(out.y).toBeGreaterThanOrEqual(inner.y - 1e-6);
		expect(out.x + out.width).toBeLessThanOrEqual(inner.x + inner.width + 1e-6);
		expect(out.y + out.height).toBeLessThanOrEqual(
			inner.y + inner.height + 1e-6,
		);
	});
});

describe("constrainResizeToRatio", () => {
	it("ratio=null（自由）は newBox をそのまま返す", () => {
		const oldBox: CropRect = { x: 0, y: 0, width: 200, height: 100 };
		const newBox: CropRect = { x: 0, y: 0, width: 300, height: 250 };
		expect(constrainResizeToRatio(oldBox, newBox, null)).toEqual(newBox);
	});

	it("右ハンドルで幅を広げると高さが比率に追従する（左上アンカー固定）", () => {
		const oldBox: CropRect = { x: 10, y: 20, width: 100, height: 100 };
		// 右下ハンドルで幅を 200 に、高さは僅かしか変えない → 幅主導。
		const newBox: CropRect = { x: 10, y: 20, width: 200, height: 101 };
		const out = constrainResizeToRatio(oldBox, newBox, 1);
		expect(out.width).toBeCloseTo(200);
		expect(out.height).toBeCloseTo(200); // 1:1 なので高さ=幅
		// 左上端は固定。
		expect(out.x).toBeCloseTo(10);
		expect(out.y).toBeCloseTo(20);
	});

	it("下ハンドルで高さを広げると幅が比率に追従する（高さ主導）", () => {
		const oldBox: CropRect = { x: 10, y: 20, width: 100, height: 100 };
		// 下ハンドルで高さを 300 に、幅はほぼ不変 → 高さ主導。
		const newBox: CropRect = { x: 10, y: 20, width: 101, height: 300 };
		const out = constrainResizeToRatio(oldBox, newBox, 16 / 9);
		expect(out.height).toBeCloseTo(300);
		expect(out.width).toBeCloseTo(300 * (16 / 9));
	});

	it("左ハンドルを動かすと右端をアンカーに固定する", () => {
		const oldBox: CropRect = { x: 100, y: 0, width: 100, height: 100 };
		// 左端を左へ動かして幅を 200 に（x が減る）→ 右端 200 を固定。
		const newBox: CropRect = { x: 0, y: 0, width: 200, height: 101 };
		const out = constrainResizeToRatio(oldBox, newBox, 1);
		// 右端 = oldBox.x + oldBox.width = 200 を保つ。
		expect(out.x + out.width).toBeCloseTo(200);
		expect(out.width).toBeCloseTo(200);
		expect(out.height).toBeCloseTo(200);
	});

	it("最小サイズ MIN_CROP を下限にする", () => {
		const oldBox: CropRect = { x: 0, y: 0, width: 50, height: 50 };
		const newBox: CropRect = { x: 0, y: 0, width: 1, height: 1 };
		const out = constrainResizeToRatio(oldBox, newBox, 1);
		expect(out.width).toBeGreaterThanOrEqual(MIN_CROP);
		expect(out.height).toBeGreaterThanOrEqual(MIN_CROP);
	});
});
