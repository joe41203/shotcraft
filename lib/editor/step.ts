/**
 * 番号付きステップバッジの描画パラメータ・採番の純粋計算。
 * バッジ半径や中央の数字フォントサイズなど描画に依らず決まる値と、
 * 「次に置くバッジの番号」を明示上書きするための解決ロジックをここに集約する。
 */

import { nextStepNumber, type Shape } from "./doc";

/** ステップバッジの既定半径（px）。StepShape.radius 未指定時に使う。 */
export const STEP_RADIUS = 16;

/**
 * バッジ半径から中央の数字フォントサイズ（px）を求める。
 * 半径に比例させ、2 桁以上でも収まるよう控えめの係数にする。
 */
export function stepFontSize(radius: number): number {
	return Math.round(radius * 1.1);
}

/**
 * 次に置くステップバッジの番号を、任意の「明示上書き」を優先して解決する純粋関数。
 *
 * 通常は既存 step の最大 +1（nextStepNumber）で連番採番するが、フライアウトの
 * 「次を 1 に戻す」アクションのように「次の 1 個だけ番号を上書きしたい」ケースでは
 * override（有効な正の整数）を優先して返す。override が未指定・非正・整数でないときは
 * 従来どおり nextStepNumber へフォールバックする。
 *
 * この上書きは「次の 1 個」に効く一時状態の想定で、呼び出し側は 1 個置いたら
 * override を破棄する（以降はまた連番）。override を StepShape に持たせず外側で
 * 一時保持する運用にすることで、doc・保存済みデータは一切変えない（後方互換）。
 */
export function resolveNextStepNumber(
	shapes: Shape[],
	override?: number | null,
): number {
	if (
		typeof override === "number" &&
		Number.isInteger(override) &&
		override > 0
	) {
		return override;
	}
	return nextStepNumber(shapes);
}
