import { describe, expect, it } from "vitest";
import {
	CLICK_MOVE_THRESHOLD_PX,
	elementRectToSnapRect,
	isClick,
	MIN_ELEMENT_SIZE_PX,
} from "../lib/element-snap";

describe("isClick", () => {
	it("移動なしはクリック", () => {
		expect(isClick(100, 100, 100, 100)).toBe(true);
	});

	it("閾値未満の微動はクリック", () => {
		// dx=3, dy=3（チェビシェフ距離 3）< 4
		expect(isClick(100, 100, 103, 103)).toBe(true);
	});

	it("閾値ちょうどはドラッグ扱い（未満のみクリック）", () => {
		// dx=4 → チェビシェフ距離 4、閾値 4 未満でないので false
		expect(isClick(100, 100, 104, 100)).toBe(false);
	});

	it("閾値以上の移動はドラッグ", () => {
		expect(isClick(100, 100, 100, 120)).toBe(false);
	});

	it("負方向の移動も絶対値で判定する", () => {
		expect(isClick(100, 100, 97, 98)).toBe(true);
		expect(isClick(100, 100, 90, 100)).toBe(false);
	});

	it("チェビシェフ距離: 片軸だけ超えてもドラッグ", () => {
		// dx=1（小）だが dy=10（大）→ ドラッグ
		expect(isClick(100, 100, 101, 110)).toBe(false);
	});

	it("既定しきい値は CLICK_MOVE_THRESHOLD_PX", () => {
		expect(CLICK_MOVE_THRESHOLD_PX).toBe(4);
		// 既定は 4px 未満がクリック
		expect(isClick(0, 0, 3, 0)).toBe(true);
		expect(isClick(0, 0, 4, 0)).toBe(false);
	});

	it("閾値を変えられる", () => {
		expect(isClick(0, 0, 8, 0, 10)).toBe(true);
		expect(isClick(0, 0, 12, 0, 10)).toBe(false);
	});
});

describe("elementRectToSnapRect", () => {
	const viewport = { width: 1000, height: 800 };

	it("画面内に収まる要素の矩形をそのまま CSS px で返す", () => {
		expect(
			elementRectToSnapRect(
				{ left: 100, top: 50, width: 200, height: 120 },
				viewport,
			),
		).toEqual({ x: 100, y: 50, width: 200, height: 120 });
	});

	it("ビューポート外へはみ出す部分を切り詰める", () => {
		// 右端・下端をはみ出す要素 → 画面内の見えている領域だけを返す
		expect(
			elementRectToSnapRect(
				{ left: 900, top: 700, width: 300, height: 300 },
				viewport,
			),
		).toEqual({ x: 900, y: 700, width: 100, height: 100 });
	});

	it("左上へはみ出す（負の left/top）部分も切り詰める", () => {
		expect(
			elementRectToSnapRect(
				{ left: -50, top: -30, width: 200, height: 150 },
				viewport,
			),
		).toEqual({ x: 0, y: 0, width: 150, height: 120 });
	});

	it("幅が極小（8px 未満）の要素は null（区切り線など）", () => {
		expect(
			elementRectToSnapRect(
				{ left: 100, top: 100, width: 4, height: 200 },
				viewport,
			),
		).toBeNull();
	});

	it("高さが極小（8px 未満）の要素は null", () => {
		expect(
			elementRectToSnapRect(
				{ left: 100, top: 100, width: 200, height: 2 },
				viewport,
			),
		).toBeNull();
	});

	it("下限ちょうど（8px）は対象に含める", () => {
		expect(
			elementRectToSnapRect(
				{ left: 100, top: 100, width: 8, height: 8 },
				viewport,
			),
		).toEqual({ x: 100, y: 100, width: 8, height: 8 });
	});

	it("クランプ後に極小へ潰れる（ほぼ画面外）要素は null", () => {
		// 左端 998 から幅 100 → 画面内は width 2px のみ → 極小で null
		expect(
			elementRectToSnapRect(
				{ left: 998, top: 100, width: 100, height: 100 },
				viewport,
			),
		).toBeNull();
	});

	it("完全に画面外の要素は null", () => {
		expect(
			elementRectToSnapRect(
				{ left: 1200, top: 100, width: 100, height: 100 },
				viewport,
			),
		).toBeNull();
	});

	it("ビューポートが不正（幅・高さ 0）なら null", () => {
		expect(
			elementRectToSnapRect(
				{ left: 10, top: 10, width: 100, height: 100 },
				{ width: 0, height: 800 },
			),
		).toBeNull();
	});

	it("下限を引数で変えられる", () => {
		// minSize=50 なら 40px 幅の要素は弾かれる
		expect(
			elementRectToSnapRect(
				{ left: 10, top: 10, width: 40, height: 200 },
				viewport,
				50,
			),
		).toBeNull();
	});

	it("MIN_ELEMENT_SIZE_PX は 8", () => {
		expect(MIN_ELEMENT_SIZE_PX).toBe(8);
	});
});
