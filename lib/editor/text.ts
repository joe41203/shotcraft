import { clamp } from "../geometry";

/**
 * テキスト注釈のフォントサイズ（px）の下限・上限。
 * 選択したテキストの四隅ハンドルをドラッグして連続的にサイズを変えるため、
 * 焼き込み時にこの範囲へクランプして極端な値（潰れ・巨大化）を防ぐ。
 */
export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 200;

/** 新規テキストの既定フォントサイズ（px）。フライアウトの M（標準）と同じ値。 */
export const DEFAULT_FONT_SIZE = 24;

/**
 * テキスト・フキダシのフォントサイズプリセット（S / M / L）。フライアウトの「サイズ」
 * セクションで選ぶ。M は DEFAULT_FONT_SIZE と一致させる。ハンドルドラッグでは連続値に
 * なるため、現在値がこの 3 値のどれでもないときはどのボタンも active にしない。
 */
export const FONT_SIZE_OPTIONS = [
	{ value: 18, label: "S" },
	{ value: DEFAULT_FONT_SIZE, label: "M" },
	{ value: 36, label: "L" },
] as const;

/** FONT_SIZE_OPTIONS の値の集合（プリセット一致判定に使う）。 */
const FONT_SIZE_PRESET_VALUES: ReadonlySet<number> = new Set(
	FONT_SIZE_OPTIONS.map((o) => o.value),
);

/**
 * size がフォントサイズプリセット（S / M / L）のどれかちょうどに一致するか。
 * フライアウトのサイズボタンの active 表示に使う（プリセット外なら全ボタン非 active）。
 */
export function isFontSizePreset(size: number): boolean {
	return FONT_SIZE_PRESET_VALUES.has(size);
}

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
