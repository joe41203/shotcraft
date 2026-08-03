/**
 * ガウスぼかしの純粋ロジック。モザイクの姉妹（mosaic.ts と同じ思想）。
 *
 * 描画そのもの（領域を切り出して ctx.filter = "blur(Npx)" で加工した canvas を重ねる）
 * は DOM 依存なので editor 側の render に置く。ここには「領域サイズからぼかし半径を
 * 決める」純粋関数だけを置き、テスト可能にする。
 */

import type { MosaicBlurIntensity } from "./doc";
import { intensityScale } from "./mosaic";

/** ぼかし半径の下限（px）。小さい領域でも最低これだけはぼかす。 */
export const MIN_BLUR_RADIUS = 4;
/** ぼかし半径の上限（px）。大きい領域でぼかしが効きすぎるのを防ぐ。 */
export const MAX_BLUR_RADIUS = 32;

/**
 * ぼかし領域の寸法から、ガウスぼかしの半径（px）を決める。
 * モザイクの粒度決定（短辺の約 1/12）と同じ思想で、短辺の約 1/12 を基準に、
 * 強度倍率（弱 0.6 / 標準 1.0 / 強 1.6。mosaic.ts の intensityScale を共有）を掛けてから
 * 下限 MIN_BLUR_RADIUS・上限 MAX_BLUR_RADIUS でクランプする。領域が大きいほど・
 * 強度が高いほど強くぼかす。intensity 省略時は標準（従来と同じ値）。
 */
export function blurRadius(
	width: number,
	height: number,
	intensity?: MosaicBlurIntensity,
): number {
	const base = Math.round(
		(Math.min(width, height) / 12) * intensityScale(intensity),
	);
	return Math.min(MAX_BLUR_RADIUS, Math.max(MIN_BLUR_RADIUS, base));
}

/** ぼかしパッチの角丸半径の下限（px）。 */
export const MIN_BLUR_CORNER_RADIUS = 4;
/** ぼかしパッチの角丸半径の上限（px）。 */
export const MAX_BLUR_CORNER_RADIUS = 16;

/**
 * ぼかしパッチの角丸半径（px）を領域の寸法から決める純粋関数。
 * スポットライトの穴（spotlightCornerRadius）と統一感を持たせ、短辺の 12% を
 * 目安に下限 4 / 上限 16px へクランプする。硬い直角より角丸のほうがプロ品質に
 * 見える（ぼかしのみで、モザイクは従来どおり角のまま）。
 */
export function blurCornerRadius(width: number, height: number): number {
	const shortSide = Math.min(Math.abs(width), Math.abs(height));
	const base = shortSide * 0.12;
	return Math.min(
		MAX_BLUR_CORNER_RADIUS,
		Math.max(MIN_BLUR_CORNER_RADIUS, base),
	);
}
