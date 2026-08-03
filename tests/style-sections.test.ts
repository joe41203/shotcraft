import { describe, expect, it } from "vitest";
import type { ShapeType } from "../lib/editor/doc";
import {
	type StyleSections,
	styleAnchorToolFor,
	styleControlsVisible,
	styleSectionsFor,
} from "../lib/editor/style-sections";

/** すべて false のセクション（比較の土台）。個別に上書きして期待値を作る。 */
const NONE: StyleSections = {
	dash: false,
	arrow: false,
	fontSize: false,
	fill: false,
	intensity: false,
	dim: false,
	calloutTail: false,
	stepNumber: false,
	cropRatio: false,
};

/** NONE に部分上書きして期待値の StyleSections を作る。 */
function sections(over: Partial<StyleSections>): StyleSections {
	return { ...NONE, ...over };
}

describe("styleSectionsFor", () => {
	it("線系ツール選択中は線種セクションを出す（矢印以外は矢印セクションなし）", () => {
		expect(styleSectionsFor("line", null)).toEqual(sections({ dash: true }));
		expect(styleSectionsFor("pen", null)).toEqual(sections({ dash: true }));
	});

	it("矩形・楕円ツールは線種と塗りの両セクションを出す", () => {
		expect(styleSectionsFor("rect", null)).toEqual(
			sections({ dash: true, fill: true }),
		);
		expect(styleSectionsFor("ellipse", null)).toEqual(
			sections({ dash: true, fill: true }),
		);
	});

	it("矢印ツール選択中は線種・矢印の両セクションを出す", () => {
		expect(styleSectionsFor("arrow", null)).toEqual(
			sections({ dash: true, arrow: true }),
		);
	});

	it("テキストツールはサイズセクションを出す", () => {
		expect(styleSectionsFor("text", null)).toEqual(
			sections({ fontSize: true }),
		);
	});

	it("フキダシツールはサイズ・しっぽセクションを出す（線種は無し）", () => {
		expect(styleSectionsFor("callout", null)).toEqual(
			sections({ fontSize: true, calloutTail: true }),
		);
	});

	it("ステップツールは番号セクションを出す", () => {
		expect(styleSectionsFor("step", null)).toEqual(
			sections({ stepNumber: true }),
		);
	});

	it("クロップツールは比率セクションを出す", () => {
		expect(styleSectionsFor("crop", null)).toEqual(
			sections({ cropRatio: true }),
		);
	});

	it("モザイク・ぼかしツールは強度セクションを出す", () => {
		expect(styleSectionsFor("mosaic", null)).toEqual(
			sections({ intensity: true }),
		);
		expect(styleSectionsFor("blur", null)).toEqual(
			sections({ intensity: true }),
		);
	});

	it("スポットライトツールは暗さセクションを出す", () => {
		expect(styleSectionsFor("spotlight", null)).toEqual(
			sections({ dim: true }),
		);
	});

	it("セクションを持たないツール（選択・マーカー等）ではどれも出さない", () => {
		for (const tool of ["select", "marker"] as const) {
			expect(styleSectionsFor(tool, null)).toEqual(NONE);
		}
	});

	it("線種を持つ図形を選択中は（select ツールでも）線種セクションを出す", () => {
		expect(styleSectionsFor("select", "line")).toEqual(
			sections({ dash: true }),
		);
		expect(styleSectionsFor("select", "pen")).toEqual(sections({ dash: true }));
	});

	it("矩形・楕円図形を選択中は線種・塗りの両セクションを出す", () => {
		for (const type of ["rect", "ellipse"] as ShapeType[]) {
			expect(styleSectionsFor("select", type)).toEqual(
				sections({ dash: true, fill: true }),
			);
		}
	});

	it("矢印図形を選択中は線種・矢印の両セクションを出す", () => {
		expect(styleSectionsFor("select", "arrow")).toEqual(
			sections({ dash: true, arrow: true }),
		);
	});

	it("テキスト図形を選択中はサイズセクションを出す", () => {
		expect(styleSectionsFor("select", "text")).toEqual(
			sections({ fontSize: true }),
		);
	});

	it("フキダシ図形を選択中はサイズ・しっぽセクションを出す", () => {
		expect(styleSectionsFor("select", "callout")).toEqual(
			sections({ fontSize: true, calloutTail: true }),
		);
	});

	it("ステップ図形を選択中は番号セクションを出さない（ツール選択中のみ）", () => {
		expect(styleSectionsFor("select", "step")).toEqual(NONE);
	});

	it("モザイク・ぼかし図形を選択中は強度セクションを出す", () => {
		for (const type of ["mosaic", "blur"] as ShapeType[]) {
			expect(styleSectionsFor("select", type)).toEqual(
				sections({ intensity: true }),
			);
		}
	});

	it("スポットライト図形を選択中は暗さセクションを出す", () => {
		expect(styleSectionsFor("select", "spotlight")).toEqual(
			sections({ dim: true }),
		);
	});

	it("セクションを持たない図形（マーカー・ステップ）を選択中はどれも出さない", () => {
		for (const type of ["marker", "step"] as ShapeType[]) {
			expect(styleSectionsFor("select", type)).toEqual(NONE);
		}
	});
});

describe("styleControlsVisible", () => {
	it("いずれかのセクションが true ならボタンを出す", () => {
		expect(styleControlsVisible(sections({ dash: true }))).toBe(true);
		expect(styleControlsVisible(sections({ arrow: true }))).toBe(true);
		expect(styleControlsVisible(sections({ fontSize: true }))).toBe(true);
		expect(styleControlsVisible(sections({ fill: true }))).toBe(true);
		expect(styleControlsVisible(sections({ intensity: true }))).toBe(true);
		expect(styleControlsVisible(sections({ dim: true }))).toBe(true);
		expect(styleControlsVisible(sections({ calloutTail: true }))).toBe(true);
		expect(styleControlsVisible(sections({ stepNumber: true }))).toBe(true);
		expect(styleControlsVisible(sections({ cropRatio: true }))).toBe(true);
	});

	it("全セクション false ならボタンを隠す", () => {
		expect(styleControlsVisible(NONE)).toBe(false);
	});
});

describe("styleAnchorToolFor", () => {
	it("セクションを持つツール選択中はそのツールボタンへアンカーする", () => {
		for (const tool of [
			"arrow",
			"line",
			"rect",
			"ellipse",
			"pen",
			"text",
			"callout",
			"mosaic",
			"blur",
			"spotlight",
			"step",
			"crop",
		] as const) {
			expect(styleAnchorToolFor(tool, null)).toBe(tool);
		}
	});

	it("セクションを持たないツールではアンカー無し（null）", () => {
		for (const tool of ["select", "marker"] as const) {
			expect(styleAnchorToolFor(tool, null)).toBeNull();
		}
	});

	it("ステップ・クロップ図形を選択中はアンカー無し（ツール選択中のみ表示）", () => {
		// step/crop はツール選択でしかセクションを持たないので、図形選択では出さない。
		expect(styleAnchorToolFor("select", "step")).toBeNull();
	});

	it("セクションを持つ図形を選択中は（select ツールでも）その図形の型のツールへアンカーする", () => {
		for (const type of [
			"arrow",
			"line",
			"rect",
			"ellipse",
			"pen",
			"text",
			"callout",
			"mosaic",
			"blur",
			"spotlight",
		] as ShapeType[]) {
			expect(styleAnchorToolFor("select", type)).toBe(type);
		}
	});

	it("図形選択はツールより優先する（矢印図形を選択中は line ツールでも矢印ボタンへ）", () => {
		expect(styleAnchorToolFor("line", "arrow")).toBe("arrow");
	});

	it("フキダシ図形を選択中は（テキストツールでも）フキダシボタンへアンカーする", () => {
		expect(styleAnchorToolFor("text", "callout")).toBe("callout");
	});

	it("セクションを持たない図形を選択中は（そのツールもセクション無しなら）null", () => {
		for (const type of ["marker", "step"] as ShapeType[]) {
			expect(styleAnchorToolFor("select", type)).toBeNull();
		}
	});
});
