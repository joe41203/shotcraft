import { describe, expect, it } from "vitest";
import {
	cssRectToBitmapRect,
	normalizeRect,
	snapAngle,
	snapSquare,
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

describe("snapAngle", () => {
	const start = { x: 100, y: 100 };

	it("水平に近い終点は真横（0°）へスナップし長さを保つ", () => {
		// 始点から右へ 100・下へ 10（約 5.7°）→ 0° へ丸め、長さ hypot(100,10)≈100.5 を保つ
		const snapped = snapAngle(start, { x: 200, y: 110 });
		expect(snapped.x).toBeCloseTo(100 + Math.hypot(100, 10), 5);
		expect(snapped.y).toBeCloseTo(100, 5);
	});

	it("45° 付近の終点は 45° へスナップする", () => {
		// 右下方向（約 40°）→ 45° へ丸める。x==y の変位になる。
		const snapped = snapAngle(start, { x: 200, y: 184 });
		expect(snapped.x - start.x).toBeCloseTo(snapped.y - start.y, 5);
		expect(snapped.x).toBeGreaterThan(start.x);
	});

	it("垂直に近い終点は真下（90°）へスナップする", () => {
		const snapped = snapAngle(start, { x: 108, y: 200 });
		expect(snapped.x).toBeCloseTo(100, 5);
		expect(snapped.y).toBeCloseTo(100 + Math.hypot(8, 100), 5);
	});

	it("始点＝終点（長さ 0）は終点をそのまま返す", () => {
		expect(snapAngle(start, { x: 100, y: 100 })).toEqual({ x: 100, y: 100 });
	});

	it("step を変えると刻みが変わる（90° 刻み）", () => {
		// 約 40° を 90° 刻みでスナップ → 0°（最も近い 90 の倍数）。真横になる。
		const snapped = snapAngle(start, { x: 200, y: 184 }, 90);
		expect(snapped.y).toBeCloseTo(100, 5);
		expect(snapped.x).toBeGreaterThan(start.x);
	});
});

describe("snapSquare", () => {
	it("横長ドラッグは長い辺（幅）に高さをそろえる", () => {
		// 幅 120・高さ 40 → 一辺 120 の正方形（右下方向）
		expect(snapSquare({ x: 10, y: 10 }, { x: 130, y: 50 })).toEqual({
			x: 130,
			y: 130,
		});
	});

	it("縦長ドラッグは長い辺（高さ）に幅をそろえる", () => {
		expect(snapSquare({ x: 10, y: 10 }, { x: 50, y: 150 })).toEqual({
			x: 150,
			y: 150,
		});
	});

	it("左上方向のドラッグでも符号を保って正方形にする", () => {
		// 始点より左上へ（幅 -80・高さ -30）→ 一辺 80 で左上方向
		expect(snapSquare({ x: 100, y: 100 }, { x: 20, y: 70 })).toEqual({
			x: 20,
			y: 20,
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
