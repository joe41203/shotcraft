/**
 * フリーハンド（ペン・蛍光マーカー）の手ブレ補正に使う純粋計算。
 *
 * 補正は 2 段構え:
 *   1) 入力点の間引き（thinPoints）: 前に採用した点から一定距離未満の点は捨て、
 *      細かい震えの点を減らす。
 *   2) 描画側の tension（render.ts の STROKE_TENSION）: 残った点を Konva の
 *      スプライン補間で滑らかに繋ぐ。
 * どちらもユーザーが描いた軌跡の形そのものは変えない（直線化・図形認識はしない）。
 * 間引きの距離しきい値はここに定数として持ち、確定図形もドラッグ中プレビューも
 * 同じ値を通して見た目を一致させる。
 */

/**
 * 手ブレ補正の間引きしきい値（doc 座標系 px）。前に採用した点からこの距離未満の点は
 * スキップする。小さすぎると震えが残り、大きすぎると角が鈍るので中間の値にする。
 */
export const STROKE_MIN_POINT_DISTANCE = 2.5;

/**
 * 点列 [x0,y0,x1,y1,...] を間引く純粋関数。
 * 先頭点は必ず残し、以降は「直前に採用した点から minDist 以上離れた点」だけ採用する。
 * さらに、末尾点は（既に採用済みでなければ）常に残して線が途中で切れないようにする
 * （最後まで指を動かした位置まで線を届かせる）。これにより、ゆっくり描いたときの
 * 密な震え点が減り、tension 補間と合わせて滑らかな線になる。
 *
 * - minDist <= 0 のときはそのまま返す（間引かない）。
 * - 点が 1 個以下（長さ 2 以下）のときはそのまま返す。
 * 入力配列は変更しない（新しい配列を返す）。
 */
export function thinPoints(
	points: number[],
	minDist: number = STROKE_MIN_POINT_DISTANCE,
): number[] {
	if (points.length <= 2 || minDist <= 0) return [...points];

	const out: number[] = [points[0] ?? 0, points[1] ?? 0];
	let lastX = out[0] as number;
	let lastY = out[1] as number;
	const minSq = minDist * minDist;

	// 末尾ペアのインデックス（偶数長を仮定。奇数末尾は無視して安全側に）。
	const lastPairStart = points.length - (points.length % 2 === 0 ? 2 : 3);

	for (let i = 2; i + 1 < points.length; i += 2) {
		const x = points[i] ?? 0;
		const y = points[i + 1] ?? 0;
		const dx = x - lastX;
		const dy = y - lastY;
		const isLast = i === lastPairStart;
		// しきい値以上離れているか、末尾点なら採用する。
		if (dx * dx + dy * dy >= minSq || isLast) {
			out.push(x, y);
			lastX = x;
			lastY = y;
		}
	}
	return out;
}
