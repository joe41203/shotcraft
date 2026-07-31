/**
 * モザイク（ピクセル化）の純粋ロジック。
 *
 * 描画そのもの（canvas への縮小→拡大）は DOM 依存なので editor 側の render に置く。
 * ここには「領域サイズからピクセルの粗さを決める」純粋関数だけを置き、テスト可能にする。
 */

/** ピクセルブロックの下限（px）。小さい領域でも最低これだけは潰す。 */
export const MIN_PIXEL_SIZE = 8;
/** ピクセルブロックの上限（px）。大きい領域で 1 ブロックが巨大になりすぎるのを防ぐ。 */
export const MAX_PIXEL_SIZE = 64;

/**
 * モザイク領域の寸法から、ピクセルブロックの一辺（画像座標系の px）を決める。
 * 短辺の約 1/12 を基準に、下限 MIN_PIXEL_SIZE・上限 MAX_PIXEL_SIZE でクランプする。
 * 領域が大きいほど粗く、小さいほど細かくなる。
 */
export function mosaicPixelSize(width: number, height: number): number {
	const base = Math.round(Math.min(width, height) / 12);
	return Math.min(MAX_PIXEL_SIZE, Math.max(MIN_PIXEL_SIZE, base));
}
