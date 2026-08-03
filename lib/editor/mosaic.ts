/**
 * モザイク（ピクセル化）の純粋ロジック。
 *
 * 描画そのもの（canvas への縮小→拡大）は DOM 依存なので editor 側の render に置く。
 * ここには「領域サイズからピクセルの粗さを決める」純粋関数だけを置き、テスト可能にする。
 */

import type { MosaicBlurIntensity } from "./doc";

/** ピクセルブロックの下限（px）。小さい領域でも最低これだけは潰す。 */
export const MIN_PIXEL_SIZE = 8;
/** ピクセルブロックの上限（px）。大きい領域で 1 ブロックが巨大になりすぎるのを防ぐ。 */
export const MAX_PIXEL_SIZE = 64;

/**
 * モザイク・ぼかしの強度（弱 / 標準 / 強）に対応する倍率。自動決定した粒度・半径に
 * 掛けてから上下限クランプする。標準（1.0）は従来値のまま、弱で細かく（0.6）・強で
 * 粗く（1.6）なる。モザイク（mosaicPixelSize）とぼかし（blurRadius）で共有する。
 */
export const INTENSITY_SCALE: Readonly<Record<MosaicBlurIntensity, number>> = {
	weak: 0.6,
	normal: 1.0,
	strong: 1.6,
};

/**
 * 強度（省略時 "normal"）に対応する倍率を返す純粋関数。未設定・不正値は 1.0（標準）。
 * mosaicPixelSize / blurRadius が自動決定値へ掛けるのに使う。
 */
export function intensityScale(intensity?: MosaicBlurIntensity): number {
	return intensity != null ? (INTENSITY_SCALE[intensity] ?? 1.0) : 1.0;
}

/**
 * モザイク領域の寸法から、ピクセルブロックの一辺（画像座標系の px）を決める。
 * 短辺の約 1/12 を基準に、強度倍率（弱 0.6 / 標準 1.0 / 強 1.6）を掛けてから、
 * 下限 MIN_PIXEL_SIZE・上限 MAX_PIXEL_SIZE でクランプする。領域が大きいほど・
 * 強度が高いほど粗くなる。intensity 省略時は標準（従来と同じ値）。
 */
export function mosaicPixelSize(
	width: number,
	height: number,
	intensity?: MosaicBlurIntensity,
): number {
	const base = Math.round(
		(Math.min(width, height) / 12) * intensityScale(intensity),
	);
	return Math.min(MAX_PIXEL_SIZE, Math.max(MIN_PIXEL_SIZE, base));
}
