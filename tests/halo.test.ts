import { describe, expect, it } from "vitest";
import {
	colorLuminance,
	HALO_DARK,
	HALO_LIGHT,
	HALO_MAX_WIDTH,
	HALO_MIN_WIDTH,
	haloColor,
	haloStrokeWidth,
} from "../lib/editor/halo";

describe("colorLuminance", () => {
	it("黒は 0、白は 1 に近い", () => {
		expect(colorLuminance("#000000")).toBeCloseTo(0);
		expect(colorLuminance("#ffffff")).toBeCloseTo(1);
	});

	it("#rgb 短縮形も解釈する", () => {
		expect(colorLuminance("#fff")).toBeCloseTo(1);
		expect(colorLuminance("#000")).toBeCloseTo(0);
	});

	it("緑は赤より輝度が高い（知覚輝度の加重）", () => {
		const red = colorLuminance("#ff0000") as number;
		const green = colorLuminance("#00ff00") as number;
		expect(green).toBeGreaterThan(red);
	});

	it("解釈できない色は null", () => {
		expect(colorLuminance("rgb(1,2,3)")).toBeNull();
		expect(colorLuminance("coral")).toBeNull();
		expect(colorLuminance("")).toBeNull();
	});
});

describe("haloColor", () => {
	it("明るい文字（白・アンバー）にはダーク縁", () => {
		expect(haloColor("#ffffff")).toBe(HALO_DARK);
		expect(haloColor("#fbbf24")).toBe(HALO_DARK);
	});

	it("暗い文字（黒・濃紺）には白縁", () => {
		expect(haloColor("#000000")).toBe(HALO_LIGHT);
		expect(haloColor("#18181b")).toBe(HALO_LIGHT);
	});

	it("既定のコーラルは明るめなのでダーク縁になる", () => {
		// #fb7185 の輝度は約 0.56（>0.5）。淡いピンクなのでダーク縁でコントラストを付ける。
		expect(haloColor("#fb7185")).toBe(HALO_DARK);
	});

	it("解釈できない色はダーク縁へフォールバックする", () => {
		expect(haloColor("rgb(255,255,255)")).toBe(HALO_DARK);
		expect(haloColor("coral")).toBe(HALO_DARK);
	});
});

describe("haloStrokeWidth", () => {
	it("フォントサイズに比例する（範囲内で）", () => {
		// 40px * 0.08 = 3.2px（下限・上限の内側）。
		expect(haloStrokeWidth(40)).toBeCloseTo(3.2);
	});

	it("小さいフォントでも下限を下回らない", () => {
		expect(haloStrokeWidth(8)).toBe(HALO_MIN_WIDTH);
		expect(haloStrokeWidth(1)).toBe(HALO_MIN_WIDTH);
	});

	it("大きいフォントでも上限を超えない", () => {
		expect(haloStrokeWidth(200)).toBe(HALO_MAX_WIDTH);
	});

	it("非有限・非正のサイズは下限へ落とす（NaN を出さない）", () => {
		expect(haloStrokeWidth(Number.NaN)).toBe(HALO_MIN_WIDTH);
		expect(haloStrokeWidth(0)).toBe(HALO_MIN_WIDTH);
		expect(haloStrokeWidth(-10)).toBe(HALO_MIN_WIDTH);
		expect(haloStrokeWidth(Number.POSITIVE_INFINITY)).toBe(HALO_MIN_WIDTH);
	});
});
