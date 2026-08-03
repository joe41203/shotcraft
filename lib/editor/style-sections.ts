/**
 * ツールバーの「スタイル」ポップオーバーに、どのセクション（線種 / 矢印）を
 * 出すかを決める純粋ロジック。UI（toolbar.ts）はこの結果でセクションと
 * 「スタイル」ボタン自体の表示を切り替える。
 *
 * 表示条件は従来のツールバー直置きトグルと同じ:
 * - 線種（実線/破線）: 線系ツール（矢印・直線・矩形・楕円・ペン）選択中、または
 *   線種を持つ図形（shapeSupportsDash）を単一選択中。
 * - 矢印（片側/両側/曲線）: 矢印ツール選択中、または矢印図形を単一選択中。
 */

import type { ShapeType } from "./doc";
import { shapeSupportsDash } from "./dash";

/** 線種セクションを持つ（＝破線に対応する）ツールの集合。図形側は shapeSupportsDash が正。 */
const DASH_TOOLS: ReadonlySet<string> = new Set([
	"arrow",
	"line",
	"rect",
	"ellipse",
	"pen",
]);

/** 「スタイル」ポップオーバーに出す各セクションの表示可否。 */
export interface StyleSections {
	/** 線種（実線/破線）セクションを出すか。 */
	dash: boolean;
	/** 矢印（片側/両側/曲線）セクションを出すか。 */
	arrow: boolean;
}

/**
 * 現在のツールと単一選択図形の type から、ポップオーバーに出すセクションを決める。
 * selectedShapeType は「ちょうど 1 個」選択しているときだけその type を、未選択・
 * 複数選択のときは null/undefined を渡す（従来の selectedId ゲッタと同じ運用）。
 */
export function styleSectionsFor(
	toolName: string,
	selectedShapeType?: ShapeType | null,
): StyleSections {
	const selectedSupportsDash =
		selectedShapeType != null && shapeSupportsDash(selectedShapeType);
	const selectedIsArrow = selectedShapeType === "arrow";
	return {
		dash: DASH_TOOLS.has(toolName) || selectedSupportsDash,
		arrow: toolName === "arrow" || selectedIsArrow,
	};
}

/**
 * いずれかのセクションが表示対象か（＝「スタイル」ボタン自体を出すか）。
 * 両セクションとも不要なら false（ボタン非表示）。
 */
export function styleControlsVisible(sections: StyleSections): boolean {
	return sections.dash || sections.arrow;
}
