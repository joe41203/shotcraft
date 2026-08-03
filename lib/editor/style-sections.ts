/**
 * 線種・矢印スタイルのフライアウト（線系ツールボタンの真下に出る小パネル）に
 * 「どのセクションを出すか」「どのツールボタンの下にアンカーするか」を決める純粋ロジック。
 * UI（toolbar.ts）はこの結果でフライアウトの内容と表示位置を決める。
 *
 * 表示条件は従来のツールバー直置きトグルと同じ:
 * - 線種（実線/破線）: 線系ツール（矢印・直線・矩形・楕円・ペン）選択中、または
 *   線種を持つ図形（shapeSupportsDash）を単一選択中。
 * - 矢印（片側/両側/曲線）: 矢印ツール選択中、または矢印図形を単一選択中。
 *
 * アンカー先（真下にフライアウトを出すボタン）:
 * - 線種を持つ図形を単一選択中は、その図形の型に対応するツールボタン（矢印図形→矢印ボタン）。
 * - そうでなく線系ツールがアクティブなら、そのツールボタン。
 * - どちらでもなければアンカー無し（フライアウトを出さない）。
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

/**
 * 線種を持つ図形の型 → その図形を描くツール名の対応。
 * 図形選択時にどのツールボタンの下へフライアウトを出すかの決定に使う
 * （線系図形の型名とツール名は 1 対 1 で一致する）。
 */
const SHAPE_TO_TOOL: Readonly<Record<string, string>> = {
	arrow: "arrow",
	line: "line",
	rect: "rect",
	ellipse: "ellipse",
	pen: "pen",
};

/** フライアウトに出す各セクションの表示可否。 */
export interface StyleSections {
	/** 線種（実線/破線）セクションを出すか。 */
	dash: boolean;
	/** 矢印（片側/両側/曲線）セクションを出すか。 */
	arrow: boolean;
}

/**
 * 現在のツールと単一選択図形の型から、フライアウトに出すセクションを決める。
 * selectedShapeType は「ちょうど 1 個」選択しているときだけその型を、未選択・
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
 * いずれかのセクションが表示対象か（＝フライアウトを出すか）。
 * 両セクションとも不要なら false。
 */
export function styleControlsVisible(sections: StyleSections): boolean {
	return sections.dash || sections.arrow;
}

/**
 * フライアウトを真下に出すツールボタンの名前を決める純粋関数。
 * - 線種を持つ図形を単一選択中: その図形の型に対応するツール（選択優先。矢印図形→"arrow"）。
 * - そうでなく線系ツールがアクティブ: そのツール名。
 * - どちらでもない: null（フライアウトを出さない）。
 *
 * 図形選択を優先するのは、select ツールで線系図形を選んだときに「その図形を描く
 * ツールボタン」の下へ出して対応を分かりやすくするため。
 */
export function styleAnchorToolFor(
	toolName: string,
	selectedShapeType?: ShapeType | null,
): string | null {
	if (selectedShapeType != null && shapeSupportsDash(selectedShapeType)) {
		return SHAPE_TO_TOOL[selectedShapeType] ?? null;
	}
	if (DASH_TOOLS.has(toolName)) return toolName;
	return null;
}
