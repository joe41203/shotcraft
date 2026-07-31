import type { Rect, Size } from "./messages";

export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/** フルページキャプチャの 1 タイル分の撮影・配置情報。 */
export interface FullPageTile {
	/** このタイルを撮る前にページをスクロールさせる位置（CSS px, ページ先頭からのオフセット）。 */
	scrollY: number;
	/** 繋ぎ合わせ先キャンバス上の配置 Y（bitmap px）。 */
	destY: number;
	/** 撮影した bitmap のどの Y から切り出すか（bitmap px）。重複除去のため先頭を削ることがある。 */
	srcY: number;
	/** 切り出す高さ（bitmap px）。 */
	srcHeight: number;
}

/**
 * フルページキャプチャのタイル配置を計算する純粋関数。
 *
 * ページを `viewportHeight`（CSS px）単位で上から撮り、最終タイルだけは
 * 下端揃え（scrollY = pageHeight - viewportHeight）にして端数を吸収する。
 * 下端揃えで生じた「前タイルとの重複領域」は最終タイルの srcY / srcHeight を
 * 削って除き、繋ぎ目が二重に描画されないようにする。
 *
 * 配置座標はすべて bitmap px。captureVisibleTab は物理 px で返るため、
 * devicePixelRatio ではなく実測スケール `scale`（bitmap 高さ / viewport 高さ）を
 * 掛けて CSS px を bitmap px に変換する。返り値の各タイルの srcHeight の総和は
 * ちょうど pageHeight * scale（丸め）になり、キャンバス全高と一致する。
 *
 * - 1 画面に収まる（pageHeight <= viewportHeight）場合は 1 タイル。
 * - viewportHeight / scale が非正なら空配列を返す（呼び出し側で撮影しない）。
 */
export function planFullPageTiles(params: {
	pageHeight: number;
	viewportHeight: number;
	scale: number;
}): FullPageTile[] {
	const { pageHeight, viewportHeight, scale } = params;
	if (viewportHeight <= 0 || scale <= 0 || pageHeight <= 0) return [];

	// 1 画面に収まるなら 1 タイルだけ。撮れる高さはページ高さで頭打ちにする。
	if (pageHeight <= viewportHeight) {
		const height = Math.round(pageHeight * scale);
		if (height < 1) return [];
		return [{ scrollY: 0, destY: 0, srcY: 0, srcHeight: height }];
	}

	// 各タイルのスクロール位置（CSS px）を決める。最終段は下端揃え。
	const scrollYs: number[] = [];
	for (let y = 0; y < pageHeight - viewportHeight; y += viewportHeight) {
		scrollYs.push(y);
	}
	scrollYs.push(pageHeight - viewportHeight);

	const tiles: FullPageTile[] = [];
	// destY は「前タイルが埋めたキャンバス上の到達点」。次タイルはそこから続ける。
	let filledDestY = 0;
	for (const scrollY of scrollYs) {
		// このタイルがカバーするページ範囲（CSS px）→ bitmap px の配置先。
		const tileTopBitmap = Math.round(scrollY * scale);
		const tileBottomBitmap = Math.round((scrollY + viewportHeight) * scale);
		// 前タイルが既に filledDestY まで埋めているので、その分だけ上を捨てる。
		const overlap = filledDestY - tileTopBitmap;
		const srcY = overlap > 0 ? overlap : 0;
		const srcHeight = tileBottomBitmap - tileTopBitmap - srcY;
		if (srcHeight < 1) continue;
		tiles.push({ scrollY, destY: filledDestY, srcY, srcHeight });
		filledDestY += srcHeight;
	}
	return tiles;
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
