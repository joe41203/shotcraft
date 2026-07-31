/**
 * クロップの純粋な座標ロジック。
 *
 * crop は常に「元画像座標系の単一 Rect」で保持する（doc.crop）。再クロップしても
 * 入れ子にはせず、現在の有効領域（bounds）内に収めた 1 個の矩形へ合成する。
 * これにより undo 一発で 1 段戻せる。ここには DOM 非依存の計算だけを置く。
 */

import type { CropRect } from "./doc";
import { clamp } from "../geometry";
import type { Size } from "../messages";

/** クロップ矩形として許容する最小の一辺（元画像座標系の px）。 */
export const MIN_CROP = 10;

/**
 * 現在の有効領域（クロップの基準となる bounds）を返す。
 * crop があればそれ自身、無ければ画像全体。再クロップはこの領域内で行う。
 */
export function cropBounds(crop: CropRect | null, imageSize: Size): CropRect {
	return (
		crop ?? { x: 0, y: 0, width: imageSize.width, height: imageSize.height }
	);
}

/**
 * 選択矩形（元画像座標系）を bounds 内に収めた最終的なクロップ矩形へ合成する。
 * 端は右下基準で丸めてから左上へ引くことで境界超過・1px ずれを防ぎ、
 * 最小サイズ MIN_CROP を保証する。bounds と一致する（＝実質クロップ無し）場合は
 * 呼び出し側で no-op 判定できるよう、そのまま bounds に丸まった矩形を返す。
 */
export function clampCropRect(selection: CropRect, bounds: CropRect): CropRect {
	const right = bounds.x + bounds.width;
	const bottom = bounds.y + bounds.height;

	const x = clamp(Math.round(selection.x), bounds.x, right - MIN_CROP);
	const y = clamp(Math.round(selection.y), bounds.y, bottom - MIN_CROP);
	const r = clamp(
		Math.round(selection.x + selection.width),
		x + MIN_CROP,
		right,
	);
	const b = clamp(
		Math.round(selection.y + selection.height),
		y + MIN_CROP,
		bottom,
	);

	return { x, y, width: r - x, height: b - y };
}

/** 2 つのクロップ矩形が同一（座標・寸法とも一致）か。no-op 判定に使う。 */
export function cropRectEquals(a: CropRect, b: CropRect): boolean {
	return (
		a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
	);
}

/**
 * クロップ適用後のコンテンツ寸法（表示・エクスポートの基準サイズ）を返す。
 * crop があればその寸法、無ければ画像全体の寸法。
 */
export function croppedSize(crop: CropRect | null, imageSize: Size): Size {
	return crop
		? { width: crop.width, height: crop.height }
		: { width: imageSize.width, height: imageSize.height };
}
