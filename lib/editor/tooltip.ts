/**
 * カスタムツールチップの位置計算（純粋関数）。
 * DOM に触れないので単体テストできる。実際の配置は
 * entrypoints/editor/tooltip.ts の Tooltip クラスが本関数の結果を使う。
 */

/** ツールチップ配置の入力。すべて px。座標系はビューポート基準。 */
export interface TooltipAnchor {
	/** 対象ボタンの矩形（getBoundingClientRect 相当）。 */
	targetLeft: number;
	targetRight: number;
	targetBottom: number;
	/** ツールチップ自身の描画済みサイズ。 */
	tooltipWidth: number;
	/** ビューポート幅。左右クランプに使う。 */
	viewportWidth: number;
}

/** 位置計算の結果。left/top はツールチップ左上、caretLeft はキャレット中心 X。 */
export interface TooltipPlacement {
	left: number;
	top: number;
	/** キャレット（三角）の中心 X。ツールチップ左端からの相対値。 */
	caretLeft: number;
}

/** ツールチップとビューポート端の最小マージン（px）。 */
export const TOOLTIP_VIEWPORT_MARGIN = 8;

/** ボタン下端とツールチップ上端の間隔（px。キャレット分を含む見た目の余白）。 */
export const TOOLTIP_GAP = 8;

/**
 * ボタンの真下・中央揃えでツールチップを配置し、左右がビューポート外に
 * 出ないようクランプする。クランプでツールチップがずれてもキャレットは
 * ボタン中央を指し続けるよう caretLeft を補正する。
 */
export function placeTooltip(anchor: TooltipAnchor): TooltipPlacement {
	const { targetLeft, targetRight, targetBottom, tooltipWidth, viewportWidth } =
		anchor;

	const targetCenter = (targetLeft + targetRight) / 2;
	// まずは中央揃えの理想位置。
	const idealLeft = targetCenter - tooltipWidth / 2;

	// 左右のクランプ範囲。ツールチップ幅がビューポートより広い異常時は
	// 左マージンに寄せる（min > max になって NaN 化するのを防ぐ）。
	const minLeft = TOOLTIP_VIEWPORT_MARGIN;
	const maxLeft = Math.max(
		minLeft,
		viewportWidth - tooltipWidth - TOOLTIP_VIEWPORT_MARGIN,
	);
	const left = clamp(idealLeft, minLeft, maxLeft);

	// キャレットは常にボタン中央を指す。ツールチップ内での相対 X に直し、
	// ツールチップの端にめり込まない範囲へ収める。
	const caretLeft = clamp(
		targetCenter - left,
		TOOLTIP_VIEWPORT_MARGIN,
		Math.max(TOOLTIP_VIEWPORT_MARGIN, tooltipWidth - TOOLTIP_VIEWPORT_MARGIN),
	);

	return {
		left,
		top: targetBottom + TOOLTIP_GAP,
		caretLeft,
	};
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
