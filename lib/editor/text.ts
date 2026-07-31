import { clamp } from "../geometry";

/**
 * テキスト注釈のフォントサイズ（px）の下限・上限。
 * 選択したテキストの四隅ハンドルをドラッグして連続的にサイズを変えるため、
 * 焼き込み時にこの範囲へクランプして極端な値（潰れ・巨大化）を防ぐ。
 */
export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 200;

/** 新規テキストの既定フォントサイズ（px）。 */
export const DEFAULT_FONT_SIZE = 24;

/**
 * フォントサイズを許容範囲 [MIN_FONT_SIZE, MAX_FONT_SIZE] にクランプする。
 * Transformer の比例スケールを fontSize へ焼き込むとき（render.ts の shapeFromNode）に使う。
 * 端数はそのまま（連続可変なので丸めない）。NaN のみ下限へ落とす（±Infinity は clamp が
 * それぞれ上限・下限へ収める）。
 */
export function clampFontSize(size: number): number {
	if (Number.isNaN(size)) return MIN_FONT_SIZE;
	return clamp(size, MIN_FONT_SIZE, MAX_FONT_SIZE);
}
