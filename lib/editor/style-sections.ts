/**
 * スタイルフライアウト（ツールボタンの真下に出る小パネル）に
 * 「どのセクションを出すか」「どのツールボタンの下にアンカーするか」を決める純粋ロジック。
 * UI（toolbar.ts）はこの結果でフライアウトの内容と表示位置を決める。
 *
 * 表示条件は従来のツールバー直置きトグルと同じ思想で、ツール選択中またはその
 * スタイルを持つ図形を単一選択中に出す:
 * - 線種（実線/破線）: 線系ツール（矢印・直線・矩形・楕円・ペン）選択中、または
 *   線種を持つ図形（shapeSupportsDash）を単一選択中。
 * - 矢印（片側/両側/曲線）: 矢印ツール選択中、または矢印図形を単一選択中。
 * - サイズ（S/M/L）: テキストツール選択中、またはテキスト/フキダシ図形を単一選択中。
 * - 塗り（なし/半透明）: 矩形・楕円ツール選択中、または矩形/楕円図形を単一選択中。
 * - 強度（弱/標準/強）: モザイク・ぼかしツール選択中、またはモザイク/ぼかし図形を選択中。
 * - 暗さ（薄め/標準/濃いめ）: スポットライトツール選択中、またはスポットライト図形を選択中。
 * - しっぽ（下/上/左/右）: フキダシツール選択中、またはフキダシ図形を単一選択中。
 * - 番号（次を1に戻すアクション）: ステップツール選択中のみ（図形選択アンカーは無し）。
 * - 比率（自由/1:1/4:3/16:9）: クロップツール選択中のみ（図形選択アンカーは無し）。
 *
 * アンカー先（真下にフライアウトを出すボタン）:
 * - スタイルを持つ図形を単一選択中は、その図形の型に対応するツールボタン
 *   （矢印図形→矢印ボタン、フキダシ図形→フキダシボタン等）。
 * - そうでなくスタイルを持つツールがアクティブなら、そのツールボタン。
 * - どちらでもなければアンカー無し（フライアウトを出さない）。
 * step/crop はツール選択中のみ表示し、図形選択でのアンカーは持たない（対応する図形を
 * 選んでもフライアウトは出さない。callout のしっぽだけが図形選択でも出る）。
 */

import { shapeSupportsDash } from "./dash";
import type { ShapeType } from "./doc";

/** 線種セクションを持つ（＝破線に対応する）ツールの集合。図形側は shapeSupportsDash が正。 */
const DASH_TOOLS: ReadonlySet<string> = new Set([
	"arrow",
	"line",
	"rect",
	"ellipse",
	"pen",
]);

/** サイズ（S/M/L）セクションを持つツール・図形の集合（テキスト・フキダシ）。 */
const FONT_SIZE_TYPES: ReadonlySet<string> = new Set(["text", "callout"]);

/** 塗り（なし/半透明）セクションを持つツール・図形の集合（矩形・楕円）。 */
const FILL_TYPES: ReadonlySet<string> = new Set(["rect", "ellipse"]);

/** 強度（弱/標準/強）セクションを持つツール・図形の集合（モザイク・ぼかし）。 */
const INTENSITY_TYPES: ReadonlySet<string> = new Set(["mosaic", "blur"]);

/** 暗さ（薄め/標準/濃いめ）セクションを持つツール・図形（スポットライト）。 */
const DIM_TYPE = "spotlight";

/** しっぽ（下/上/左/右）セクションを持つツール・図形（フキダシ）。 */
const TAIL_TYPE = "callout";

/** 番号（次を1に戻す）セクションを持つツール（ステップ）。図形選択では出さない。 */
const STEP_NUMBER_TOOL = "step";

/** 比率（自由/1:1/4:3/16:9）セクションを持つツール（クロップ）。図形選択では出さない。 */
const CROP_RATIO_TOOL = "crop";

/**
 * スタイルを持つ図形の型 → その図形を描くツール名の対応。
 * 図形選択時にどのツールボタンの下へフライアウトを出すかの決定に使う
 * （対象図形の型名とツール名は 1 対 1 で一致する）。
 */
const SHAPE_TO_TOOL: Readonly<Record<string, string>> = {
	arrow: "arrow",
	line: "line",
	rect: "rect",
	ellipse: "ellipse",
	pen: "pen",
	text: "text",
	callout: "callout",
	mosaic: "mosaic",
	blur: "blur",
	spotlight: "spotlight",
};

/** フライアウトに出す各セクションの表示可否。 */
export interface StyleSections {
	/** 線種（実線/破線）セクションを出すか。 */
	dash: boolean;
	/** 矢印（片側/両側/曲線）セクションを出すか。 */
	arrow: boolean;
	/** サイズ（S/M/L）セクションを出すか（テキスト・フキダシ）。 */
	fontSize: boolean;
	/** 塗り（なし/半透明）セクションを出すか（矩形・楕円）。 */
	fill: boolean;
	/** 強度（弱/標準/強）セクションを出すか（モザイク・ぼかし）。 */
	intensity: boolean;
	/** 暗さ（薄め/標準/濃いめ）セクションを出すか（スポットライト）。 */
	dim: boolean;
	/** しっぽ（下/上/左/右）セクションを出すか（フキダシ）。 */
	calloutTail: boolean;
	/** 番号（次を1に戻す）セクションを出すか（ステップツール中のみ）。 */
	stepNumber: boolean;
	/** 比率（自由/1:1/4:3/16:9）セクションを出すか（クロップツール中のみ）。 */
	cropRatio: boolean;
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
	const t = selectedShapeType ?? null;
	const selectedSupportsDash = t != null && shapeSupportsDash(t);
	const selectedIsArrow = t === "arrow";
	return {
		dash: DASH_TOOLS.has(toolName) || selectedSupportsDash,
		arrow: toolName === "arrow" || selectedIsArrow,
		fontSize:
			FONT_SIZE_TYPES.has(toolName) || (t != null && FONT_SIZE_TYPES.has(t)),
		fill: FILL_TYPES.has(toolName) || (t != null && FILL_TYPES.has(t)),
		intensity:
			INTENSITY_TYPES.has(toolName) || (t != null && INTENSITY_TYPES.has(t)),
		dim: toolName === DIM_TYPE || t === DIM_TYPE,
		// しっぽはフキダシツール中、またはフキダシ図形選択中に出す。
		calloutTail: toolName === TAIL_TYPE || t === TAIL_TYPE,
		// 番号・比率はツール選択中のみ（図形選択では出さない＝アンカーも持たない）。
		stepNumber: toolName === STEP_NUMBER_TOOL,
		cropRatio: toolName === CROP_RATIO_TOOL,
	};
}

/**
 * いずれかのセクションが表示対象か（＝フライアウトを出すか）。
 * すべて不要なら false。
 */
export function styleControlsVisible(sections: StyleSections): boolean {
	return (
		sections.dash ||
		sections.arrow ||
		sections.fontSize ||
		sections.fill ||
		sections.intensity ||
		sections.dim ||
		sections.calloutTail ||
		sections.stepNumber ||
		sections.cropRatio
	);
}

/**
 * フライアウトを真下に出すツールボタンの名前を決める純粋関数。
 * - スタイルを持つ図形を単一選択中: その図形の型に対応するツール（選択優先。矢印図形→"arrow"）。
 * - そうでなくスタイルを持つツールがアクティブ: そのツール名。
 * - どちらでもない: null（フライアウトを出さない）。
 *
 * 図形選択を優先するのは、select ツールで対象図形を選んだときに「その図形を描く
 * ツールボタン」の下へ出して対応を分かりやすくするため。判定はセクション表示可否
 * （styleSectionsFor）と同じ集合を使い、両者を必ず一致させる。
 */
export function styleAnchorToolFor(
	toolName: string,
	selectedShapeType?: ShapeType | null,
): string | null {
	const t = selectedShapeType ?? null;
	// 図形選択優先: その図形が何らかのセクションを持つなら対応ツールへアンカーする。
	if (t != null && styleControlsVisible(styleSectionsFor("select", t))) {
		return SHAPE_TO_TOOL[t] ?? null;
	}
	// 図形選択が無いときは、ツール自身が何らかのセクションを持つならそのツールへ。
	if (styleControlsVisible(styleSectionsFor(toolName, null))) return toolName;
	return null;
}
