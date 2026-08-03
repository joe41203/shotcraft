import { describe, expect, it } from "vitest";
import type { ShapeType } from "../lib/editor/doc";
import {
	styleControlsVisible,
	styleSectionsFor,
} from "../lib/editor/style-sections";

describe("styleSectionsFor", () => {
	it("線系ツール選択中は線種セクションを出す（矢印以外は矢印セクションなし）", () => {
		for (const tool of ["line", "rect", "ellipse", "pen"] as const) {
			expect(styleSectionsFor(tool, null)).toEqual({
				dash: true,
				arrow: false,
			});
		}
	});

	it("矢印ツール選択中は線種・矢印の両セクションを出す", () => {
		expect(styleSectionsFor("arrow", null)).toEqual({
			dash: true,
			arrow: true,
		});
	});

	it("線種を持たないツール（テキスト等）ではどちらも出さない", () => {
		for (const tool of [
			"select",
			"text",
			"marker",
			"step",
			"callout",
			"mosaic",
			"blur",
			"spotlight",
			"crop",
		] as const) {
			expect(styleSectionsFor(tool, null)).toEqual({
				dash: false,
				arrow: false,
			});
		}
	});

	it("線種を持つ図形を選択中は（select ツールでも）線種セクションを出す", () => {
		for (const type of ["line", "rect", "ellipse", "pen"] as ShapeType[]) {
			expect(styleSectionsFor("select", type)).toEqual({
				dash: true,
				arrow: false,
			});
		}
	});

	it("矢印図形を選択中は線種・矢印の両セクションを出す", () => {
		expect(styleSectionsFor("select", "arrow")).toEqual({
			dash: true,
			arrow: true,
		});
	});

	it("線種を持たない図形を選択中はどちらも出さない", () => {
		for (const type of [
			"text",
			"marker",
			"step",
			"callout",
			"mosaic",
		] as ShapeType[]) {
			expect(styleSectionsFor("select", type)).toEqual({
				dash: false,
				arrow: false,
			});
		}
	});
});

describe("styleControlsVisible", () => {
	it("いずれかのセクションが true ならボタンを出す", () => {
		expect(styleControlsVisible({ dash: true, arrow: false })).toBe(true);
		expect(styleControlsVisible({ dash: false, arrow: true })).toBe(true);
		expect(styleControlsVisible({ dash: true, arrow: true })).toBe(true);
	});

	it("両セクションとも false ならボタンを隠す", () => {
		expect(styleControlsVisible({ dash: false, arrow: false })).toBe(false);
	});
});
