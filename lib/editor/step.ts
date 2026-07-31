/**
 * 番号付きステップバッジの描画パラメータ計算。
 * バッジ半径や中央の数字フォントサイズなど、描画に依らず決まる値をここに集約する。
 */

/** ステップバッジの既定半径（px）。StepShape.radius 未指定時に使う。 */
export const STEP_RADIUS = 16;

/**
 * バッジ半径から中央の数字フォントサイズ（px）を求める。
 * 半径に比例させ、2 桁以上でも収まるよう控えめの係数にする。
 */
export function stepFontSize(radius: number): number {
	return Math.round(radius * 1.1);
}
