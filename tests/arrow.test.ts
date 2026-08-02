import { describe, expect, it } from "vitest";
import {
	CURVE_BULGE_RATIO,
	curvedArrowControl,
	normalizeArrowStyle,
} from "../lib/editor/arrow";

describe("normalizeArrowStyle", () => {
	it("有効な値はそのまま通す", () => {
		expect(normalizeArrowStyle("single")).toBe("single");
		expect(normalizeArrowStyle("double")).toBe("double");
		expect(normalizeArrowStyle("curved")).toBe("curved");
	});

	it("未設定・不正値は single へフォールバックする（後方互換）", () => {
		expect(normalizeArrowStyle(undefined)).toBe("single");
		expect(normalizeArrowStyle(null)).toBe("single");
		expect(normalizeArrowStyle("triple")).toBe("single");
		expect(normalizeArrowStyle(42)).toBe("single");
		expect(normalizeArrowStyle("")).toBe("single");
	});
});

describe("curvedArrowControl", () => {
	it("水平線の制御点は中点の真上/真下（法線方向）へ膨らむ", () => {
		// [0,0]→[100,0]。中点(50,0)、線分長 100、膨らみ 100*0.18=18。
		// 法線 (-dy,dx)=(0,100)/100=(0,1) 方向なので y が +18。
		const c = curvedArrowControl([0, 0, 100, 0]);
		expect(c.x).toBeCloseTo(50);
		expect(c.y).toBeCloseTo(100 * CURVE_BULGE_RATIO);
	});

	it("垂直線でも中点から線分長比例で膨らむ", () => {
		// [0,0]→[0,100]。中点(0,50)、法線 (-100,0)/100=(-1,0) で x が -18。
		const c = curvedArrowControl([0, 0, 0, 100]);
		expect(c.x).toBeCloseTo(-100 * CURVE_BULGE_RATIO);
		expect(c.y).toBeCloseTo(50);
	});

	it("膨らみ量は線分長に比例する", () => {
		const near = curvedArrowControl([0, 0, 50, 0]);
		const far = curvedArrowControl([0, 0, 200, 0]);
		expect(Math.abs(far.y)).toBeGreaterThan(Math.abs(near.y));
	});

	it("始点＝終点（長さ 0）は中点をそのまま返す（NaN を出さない）", () => {
		const c = curvedArrowControl([10, 20, 10, 20]);
		expect(c).toEqual({ x: 10, y: 20 });
	});

	it("同じ 2 点なら常に同じ制御点（決定的）", () => {
		expect(curvedArrowControl([1, 2, 3, 4])).toEqual(
			curvedArrowControl([1, 2, 3, 4]),
		);
	});
});
