import type { Rect, Size } from "./messages";

export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
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
