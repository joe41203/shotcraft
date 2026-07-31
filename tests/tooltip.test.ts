import { describe, expect, it } from "vitest";
import {
	placeTooltip,
	TOOLTIP_GAP,
	TOOLTIP_VIEWPORT_MARGIN,
} from "../lib/editor/tooltip";

describe("placeTooltip", () => {
	it("ボタン真下・中央揃えに置く（端に当たらない通常ケース）", () => {
		const p = placeTooltip({
			targetLeft: 100,
			targetRight: 140,
			targetBottom: 50,
			tooltipWidth: 80,
			viewportWidth: 1000,
		});
		// ボタン中央 120、幅 80 → left = 120 - 40 = 80
		expect(p.left).toBe(80);
		// top はボタン下端 + gap
		expect(p.top).toBe(50 + TOOLTIP_GAP);
		// キャレットはボタン中央（120）をツールチップ相対に直した 40
		expect(p.caretLeft).toBe(40);
	});

	it("左端でクランプし、キャレットはボタン中央を指し続ける", () => {
		const p = placeTooltip({
			targetLeft: 0,
			targetRight: 36,
			targetBottom: 44,
			tooltipWidth: 120,
			viewportWidth: 1000,
		});
		// 理想 left = 18 - 60 = -42 → 左マージンにクランプ
		expect(p.left).toBe(TOOLTIP_VIEWPORT_MARGIN);
		// キャレットはボタン中央 18 を left(8) 相対に直した 10
		expect(p.caretLeft).toBe(18 - TOOLTIP_VIEWPORT_MARGIN);
	});

	it("右端でクランプする", () => {
		const p = placeTooltip({
			targetLeft: 964,
			targetRight: 1000,
			targetBottom: 44,
			tooltipWidth: 120,
			viewportWidth: 1000,
		});
		// 右端: viewportWidth - width - margin = 1000 - 120 - 8 = 872
		expect(p.left).toBe(872);
		// ボタン中央 982 を left(872) 相対に直すと 110、上限 width-margin=112 内なので 110
		expect(p.caretLeft).toBe(110);
	});

	it("キャレットはツールチップの端にめり込まない（マージン内に収める）", () => {
		// 右端クランプで、ボタン中央がツールチップ右端付近に来るケース。
		const p = placeTooltip({
			targetLeft: 990,
			targetRight: 1000,
			targetBottom: 44,
			tooltipWidth: 60,
			viewportWidth: 1000,
		});
		// left = 1000 - 60 - 8 = 932。ボタン中央 995 → 相対 63 だが
		// 上限 width - margin = 52 にクランプ。
		expect(p.caretLeft).toBe(60 - TOOLTIP_VIEWPORT_MARGIN);
	});

	it("ツールチップ幅がビューポートより広い異常時も NaN にならず左マージンに寄せる", () => {
		const p = placeTooltip({
			targetLeft: 10,
			targetRight: 40,
			targetBottom: 44,
			tooltipWidth: 500,
			viewportWidth: 300,
		});
		expect(Number.isFinite(p.left)).toBe(true);
		expect(p.left).toBe(TOOLTIP_VIEWPORT_MARGIN);
		expect(Number.isFinite(p.caretLeft)).toBe(true);
	});
});
