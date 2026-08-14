import type { Rect, Size } from "./messages";

export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/** 2 点。CSS px でも doc 座標でも共通に使う軽量な座標型。 */
export interface Point {
	x: number;
	y: number;
}

/**
 * 始点から見た終点の角度を step 度刻みへスナップした終点を返す純粋関数。
 *
 * 矢印・直線の描画中に Shift を押したときの角度制約に使う。始点→終点のベクトルの
 * 角度を最も近い step の倍数へ丸め、元のベクトル長を保ったまま新しい終点を求める。
 * step は既定 45（0/45/90/135/180…）。長さ 0（始点＝終点）のときは終点をそのまま返す。
 */
export function snapAngle(start: Point, end: Point, step = 45): Point {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const length = Math.hypot(dx, dy);
	if (length === 0) return { ...end };
	const stepRad = (step * Math.PI) / 180;
	const angle = Math.atan2(dy, dx);
	const snapped = Math.round(angle / stepRad) * stepRad;
	return {
		x: start.x + Math.cos(snapped) * length,
		y: start.y + Math.sin(snapped) * length,
	};
}

/**
 * ドラッグ矩形を「始点を角の 1 つとする正方形」へ制約した終点を返す純粋関数。
 *
 * 矩形→正方形・楕円→正円のスナップに使う（Shift 押下時）。始点を固定し、幅・高さの
 * 大きい方の絶対値を一辺の長さにそろえ、ドラッグ方向（符号）は保つ。これにより
 * どの向きへドラッグしても始点を角に持つ正方形になる。
 */
export function snapSquare(start: Point, end: Point): Point {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const side = Math.max(Math.abs(dx), Math.abs(dy));
	return {
		x: start.x + Math.sign(dx || 1) * side,
		y: start.y + Math.sign(dy || 1) * side,
	};
}

/** ドラッグ始点・終点から正規化された矩形を得る（負方向ドラッグ対応）。 */
export function normalizeRect(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
): Rect {
	return {
		x: Math.min(x1, x2),
		y: Math.min(y1, y2),
		width: Math.abs(x2 - x1),
		height: Math.abs(y2 - y1),
	};
}

/**
 * CSS px の選択矩形を、キャプチャ画像（bitmap）の px 座標へ変換する。
 *
 * スケールは軸別に bitmap.width / viewport.width、bitmap.height / viewport.height
 * で求める。captureVisibleTab の実寸と viewport 寸法の実測比なので、
 * ページズームや端数 DPR でも devicePixelRatio に頼らず正しく変換できる。
 *
 * 右下端を基準に丸めてから幅・高さを引くことで 1px ずれ・境界超過を防ぎ、
 * 結果は bitmap 境界にクランプする。幅・高さが 1px 未満になる場合は null を返す。
 */
export function cssRectToBitmapRect(
	cssRect: Rect,
	viewport: Size,
	bitmap: Size,
): Rect | null {
	if (viewport.width <= 0 || viewport.height <= 0) return null;
	const scaleX = bitmap.width / viewport.width;
	const scaleY = bitmap.height / viewport.height;

	const x = clamp(Math.round(cssRect.x * scaleX), 0, bitmap.width);
	const y = clamp(Math.round(cssRect.y * scaleY), 0, bitmap.height);
	const right = clamp(
		Math.round((cssRect.x + cssRect.width) * scaleX),
		0,
		bitmap.width,
	);
	const bottom = clamp(
		Math.round((cssRect.y + cssRect.height) * scaleY),
		0,
		bitmap.height,
	);

	const width = right - x;
	const height = bottom - y;
	if (width < 1 || height < 1) return null;
	return { x, y, width, height };
}
