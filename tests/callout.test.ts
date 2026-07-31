import { describe, expect, it } from "vitest";
import {
	CALLOUT_PADDING,
	calloutBodyHeight,
	calloutInnerWidth,
	calloutTailPoints,
	hexToRgba,
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
});
