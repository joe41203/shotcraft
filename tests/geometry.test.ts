import { describe, expect, it } from "vitest";
import {
	cssRectToBitmapRect,
	normalizeRect,
	planFullPageTiles,
} from "../lib/geometry";

describe("normalizeRect", () => {
	it("正方向のドラッグをそのまま返す", () => {
		expect(normalizeRect(10, 20, 110, 220)).toEqual({
			x: 10,
			y: 20,
			width: 100,
			height: 200,
		});
	});

	it("負方向のドラッグを正規化する", () => {
		expect(normalizeRect(110, 220, 10, 20)).toEqual({
			x: 10,
			y: 20,
			width: 100,
			height: 200,
		});
	});
});

describe("cssRectToBitmapRect", () => {
	it("等倍（viewport と bitmap が一致）はそのまま", () => {
		expect(
			cssRectToBitmapRect(
				{ x: 10, y: 20, width: 100, height: 50 },
				{ width: 1280, height: 720 },
				{ width: 1280, height: 720 },
			),
		).toEqual({ x: 10, y: 20, width: 100, height: 50 });
	});

	it("ページズーム 150% 相当（bitmap が viewport の 1.5 倍）", () => {
		// scale x=y=1.5
		expect(
			cssRectToBitmapRect(
				{ x: 100, y: 100, width: 200, height: 100 },
				{ width: 800, height: 600 },
				{ width: 1200, height: 900 },
			),
		).toEqual({ x: 150, y: 150, width: 300, height: 150 });
	});

	it("DPR2 相当（bitmap が viewport の 2 倍）で物理 px に拡大される", () => {
		expect(
			cssRectToBitmapRect(
				{ x: 10, y: 20, width: 100, height: 50 },
				{ width: 640, height: 480 },
				{ width: 1280, height: 960 },
			),
		).toEqual({ x: 20, y: 40, width: 200, height: 100 });
	});

	it("端数スケール 1.25 でも右下端基準で 1px ずれない", () => {
		// scale=1.25。x=round(3.75)=4, right=round(130)=130 → width=126
		expect(
			cssRectToBitmapRect(
				{ x: 3, y: 5, width: 101, height: 33 },
				{ width: 1024, height: 768 },
				{ width: 1280, height: 960 },
			),
		).toEqual({ x: 4, y: 6, width: 126, height: 42 });
	});

	it("ビットマップ境界にクランプする（はみ出しを切り詰める）", () => {
		const rect = cssRectToBitmapRect(
			{ x: 900, y: 500, width: 300, height: 300 },
			{ width: 1000, height: 600 },
			{ width: 1000, height: 600 },
		);
		expect(rect).toEqual({ x: 900, y: 500, width: 100, height: 100 });
		expect((rect?.x ?? 0) + (rect?.width ?? 0)).toBeLessThanOrEqual(1000);
		expect((rect?.y ?? 0) + (rect?.height ?? 0)).toBeLessThanOrEqual(600);
	});

	it("幅・高さが 0 の矩形は null を返す", () => {
		expect(
			cssRectToBitmapRect(
				{ x: 10, y: 10, width: 0, height: 0 },
				{ width: 1280, height: 720 },
				{ width: 1280, height: 720 },
			),
		).toBeNull();
	});

	it("スケール縮小で 1px 未満に潰れると null を返す", () => {
		// scale=0.05。width=round(0.75)-round(0.5)=1-1=0 → null
		expect(
			cssRectToBitmapRect(
				{ x: 10, y: 10, width: 5, height: 5 },
				{ width: 2000, height: 2000 },
				{ width: 100, height: 100 },
			),
		).toBeNull();
	});
});

describe("planFullPageTiles", () => {
	it("1 画面ちょうどのページは 1 タイル", () => {
		expect(
			planFullPageTiles({ pageHeight: 800, viewportHeight: 800, scale: 1 }),
		).toEqual([{ scrollY: 0, destY: 0, srcY: 0, srcHeight: 800 }]);
	});

	it("1 画面未満のページは 1 タイルでページ高さ分だけ撮る", () => {
		expect(
			planFullPageTiles({ pageHeight: 500, viewportHeight: 800, scale: 1 }),
		).toEqual([{ scrollY: 0, destY: 0, srcY: 0, srcHeight: 500 }]);
	});

	it("端数なしの複数画面はビューポート単位で継ぎ目なく並ぶ", () => {
		const tiles = planFullPageTiles({
			pageHeight: 1600,
			viewportHeight: 800,
			scale: 1,
		});
		expect(tiles).toEqual([
			{ scrollY: 0, destY: 0, srcY: 0, srcHeight: 800 },
			{ scrollY: 800, destY: 800, srcY: 0, srcHeight: 800 },
		]);
		// srcHeight の総和がページ高さ（=キャンバス全高）に一致する
		expect(tiles.reduce((s, t) => s + t.srcHeight, 0)).toBe(1600);
	});

	it("端数ありは最終タイルを下端揃えにし重複を srcY で削る", () => {
		const tiles = planFullPageTiles({
			pageHeight: 1000,
			viewportHeight: 400,
			scale: 1,
		});
		expect(tiles).toEqual([
			{ scrollY: 0, destY: 0, srcY: 0, srcHeight: 400 },
			{ scrollY: 400, destY: 400, srcY: 0, srcHeight: 400 },
			// 下端揃え scrollY=600。前タイルと 200px 重なるので srcY=200・srcHeight=200
			{ scrollY: 600, destY: 800, srcY: 200, srcHeight: 200 },
		]);
		expect(tiles.reduce((s, t) => s + t.srcHeight, 0)).toBe(1000);
	});

	it("DPR2 相当（scale=2）で配置・高さが物理 px に拡大される", () => {
		const tiles = planFullPageTiles({
			pageHeight: 1000,
			viewportHeight: 400,
			scale: 2,
		});
		expect(tiles).toEqual([
			{ scrollY: 0, destY: 0, srcY: 0, srcHeight: 800 },
			{ scrollY: 400, destY: 800, srcY: 0, srcHeight: 800 },
			{ scrollY: 600, destY: 1600, srcY: 400, srcHeight: 400 },
		]);
		// srcHeight の総和 = pageHeight * scale（キャンバス全高）
		expect(tiles.reduce((s, t) => s + t.srcHeight, 0)).toBe(2000);
	});

	it("不正な入力（viewport/scale/pageHeight が非正）は空配列", () => {
		expect(
			planFullPageTiles({ pageHeight: 1000, viewportHeight: 0, scale: 1 }),
		).toEqual([]);
		expect(
			planFullPageTiles({ pageHeight: 1000, viewportHeight: 400, scale: 0 }),
		).toEqual([]);
		expect(
			planFullPageTiles({ pageHeight: 0, viewportHeight: 400, scale: 1 }),
		).toEqual([]);
	});
});
