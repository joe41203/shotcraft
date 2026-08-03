import { describe, expect, it } from "vitest";
import {
	CALLOUT_PADDING,
	calloutBodyHeight,
	calloutInnerWidth,
	calloutTailPoints,
	DEFAULT_CALLOUT_TAIL,
	hexToRgba,
	normalizeCalloutTail,
} from "../lib/editor/callout";

describe("calloutInnerWidth", () => {
	it("左右パディングを差し引いた幅を返す", () => {
		expect(calloutInnerWidth(100, 10)).toBe(80);
	});

	it("既定パディングを使う", () => {
		expect(calloutInnerWidth(100)).toBe(100 - CALLOUT_PADDING * 2);
	});

	it("パディングで潰れても最低 1px を保つ", () => {
		expect(calloutInnerWidth(10, 10)).toBe(1);
		expect(calloutInnerWidth(0, 10)).toBe(1);
	});
});

describe("calloutBodyHeight", () => {
	it("テキスト高さに上下パディングを足す", () => {
		// テキスト 40px、fontSize 20、padding 10 → 40 + 20 = 60
		expect(calloutBodyHeight(40, 20, 10)).toBe(60);
	});

	it("テキストが空でも最低 1 行分＋パディングを確保する", () => {
		// テキスト高さ 0、fontSize 24、padding 10 → max(0,24) + 20 = 44
		expect(calloutBodyHeight(0, 24, 10)).toBe(44);
	});

	it("行数が増えると高さも増える（折返し追従）", () => {
		const one = calloutBodyHeight(24, 24, 10);
		const three = calloutBodyHeight(72, 24, 10);
		expect(three).toBeGreaterThan(one);
	});

	it("端数は切り上げる（整数 px）", () => {
		expect(calloutBodyHeight(30.4, 24, 10)).toBe(51);
		expect(Number.isInteger(calloutBodyHeight(30.4, 24, 10))).toBe(true);
	});
});

describe("hexToRgba", () => {
	it("#rrggbb を rgba に変換する", () => {
		expect(hexToRgba("#fb7185", 0.15)).toBe("rgba(251, 113, 133, 0.15)");
	});

	it("#rgb（短縮形）も変換する", () => {
		expect(hexToRgba("#f00", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
	});

	it("大文字・前後空白も許容する", () => {
		expect(hexToRgba("  #FFFFFF ", 1)).toBe("rgba(255, 255, 255, 1)");
	});

	it("alpha は 0〜1 にクランプする", () => {
		expect(hexToRgba("#000000", 2)).toBe("rgba(0, 0, 0, 1)");
		expect(hexToRgba("#000000", -1)).toBe("rgba(0, 0, 0, 0)");
	});

	it("解釈できない入力はそのまま返す", () => {
		expect(hexToRgba("red", 0.5)).toBe("red");
		expect(hexToRgba("#12", 0.5)).toBe("#12");
	});
});

describe("calloutTailPoints", () => {
	it("下辺中央から下向きの三角の 3 頂点を返す", () => {
		// 本体 (0,0,100,50)、tailWidth 20、tailHeight 10。
		// 中心 x=50、下辺 y=50。左(40,50)・右(60,50)・先端(50,60)。
		expect(calloutTailPoints(0, 0, 100, 50, 20, 10)).toEqual([
			40, 50, 60, 50, 50, 60,
		]);
	});

	it("本体オフセットに追従する", () => {
		// 本体 (10,20,100,50) → 中心 x=60、下辺 y=70。
		expect(calloutTailPoints(10, 20, 100, 50, 20, 10)).toEqual([
			50, 70, 70, 70, 60, 80,
		]);
	});

	it("tail 省略時は down（下向き）と一致する（後方互換）", () => {
		expect(calloutTailPoints(0, 0, 100, 50, 20, 10)).toEqual(
			calloutTailPoints(0, 0, 100, 50, 20, 10, "down"),
		);
	});

	it("up: 上辺中央から上向きの三角", () => {
		// 本体 (0,0,100,50)、tailWidth 20、tailHeight 10。
		// 中心 x=50、上辺 y=0。付け根 左(40,0)・右(60,0)、先端 上(50,-10)。
		expect(calloutTailPoints(0, 0, 100, 50, 20, 10, "up")).toEqual([
			40, 0, 60, 0, 50, -10,
		]);
	});

	it("left: 左辺中央から左向きの三角", () => {
		// 中心 y=25、左辺 x=0。付け根 上(0,15)・下(0,35)、先端 左(-10,25)。
		expect(calloutTailPoints(0, 0, 100, 50, 20, 10, "left")).toEqual([
			0, 15, 0, 35, -10, 25,
		]);
	});

	it("right: 右辺中央から右向きの三角", () => {
		// 中心 y=25、右辺 x=100。付け根 上(100,15)・下(100,35)、先端 右(110,25)。
		expect(calloutTailPoints(0, 0, 100, 50, 20, 10, "right")).toEqual([
			100, 15, 100, 35, 110, 25,
		]);
	});

	it("向きに依らず本体オフセットに追従する", () => {
		// 本体 (10,20,100,50) → 中心 y=45、右辺 x=110。
		expect(calloutTailPoints(10, 20, 100, 50, 20, 10, "right")).toEqual([
			110, 35, 110, 55, 120, 45,
		]);
	});
});

describe("normalizeCalloutTail", () => {
	it("4 値はそのまま通す", () => {
		expect(normalizeCalloutTail("down")).toBe("down");
		expect(normalizeCalloutTail("up")).toBe("up");
		expect(normalizeCalloutTail("left")).toBe("left");
		expect(normalizeCalloutTail("right")).toBe("right");
	});

	it("未設定・不正値は既定（down）へ", () => {
		expect(normalizeCalloutTail(undefined)).toBe(DEFAULT_CALLOUT_TAIL);
		expect(normalizeCalloutTail(null)).toBe("down");
		expect(normalizeCalloutTail("bottom")).toBe("down");
		expect(normalizeCalloutTail(1)).toBe("down");
	});
});
