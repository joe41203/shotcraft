/**
 * ガウスぼかしの純粋ロジック。モザイクの姉妹（mosaic.ts と同じ思想）。
 *
 * 描画そのもの（領域を切り出して ctx.filter = "blur(Npx)" で加工した canvas を重ねる）
 * は DOM 依存なので editor 側の render に置く。ここには「領域サイズからぼかし半径を
 * 決める」純粋関数だけを置き、テスト可能にする。
 */

/** ぼかし半径の下限（px）。小さい領域でも最低これだけはぼかす。 */
export const MIN_BLUR_RADIUS = 4;
/** ぼかし半径の上限（px）。大きい領域でぼかしが効きすぎるのを防ぐ。 */
export const MAX_BLUR_RADIUS = 32;

/**
 * ぼかし領域の寸法から、ガウスぼかしの半径（px）を決める。
 * モザイクの粒度決定（短辺の約 1/12）と同じ思想で、短辺の約 1/12 を基準に
 * 下限 MIN_BLUR_RADIUS・上限 MAX_BLUR_RADIUS でクランプする。
 * 領域が大きいほど強く、小さいほど弱くぼかす。
 */
export function blurRadius(width: number, height: number): number {
	const base = Math.round(Math.min(width, height) / 12);
	return Math.min(MAX_BLUR_RADIUS, Math.max(MIN_BLUR_RADIUS, base));
}
