/**
 * デザイントークン（Dark Mode）の TS 定数版。
 *
 * この値は assets/tokens.css の CSS 変数と相互に同期させること。
 * content script の Shadow DOM は拡張ページの CSS 変数（:root の --bg 等）を
 * 参照できないため、同じ値をここにも定義している。片方を変えたら必ずもう片方も変える。
 */
export const theme = {
	bg: "#0f172a", // ページ・キャンバス領域の背景
	surface: "#1e293b", // ツールバー・ポップアップの面
	surfaceHover: "#334155", // hover 時の面
	border: "#334155", // 控えめな境界線
	text: "#f8fafc", // 主文字
	textMuted: "#94a3b8", // 補助文字
	accent: "#22c55e", // 主要アクション
	danger: "#ef4444", // 破壊的操作
	ring: "#38bdf8", // フォーカスリング・選択色（範囲選択の枠色と同一系統）
	fontSans:
		'"M PLUS Rounded 1c", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif',
} as const;

/**
 * テキスト注釈で選べるフォント。doc には font-family スタック文字列でなく
 * この key を保存する（シリアライズを小さく安定に保つ）。描画時に stack へ解決する。
 *
 * 先頭の family 名は assets/tokens.css の @font-face と一致させること
 * （Mochiy Pop One / Hachi Maru Pop / Yomogi / Kiwi Maru / M PLUS Rounded 1c /
 * Kosugi Maru）。片方を変えたら必ずもう片方も変える。
 * mplus の stack は theme.fontSans と同一（＝UI と同じ M PLUS Rounded 1c）。
 *
 * このオブジェクトの列挙順がツールバーの select の並び順になる。
 */
export const FONT_CHOICES = {
	mochiy: {
		label: "モッチーポップ",
		stack:
			'"Mochiy Pop One", "Hiragino Maru Gothic ProN", "Rounded Mplus 1c", sans-serif',
	},
	hachi: {
		label: "はちまるポップ",
		stack:
			'"Hachi Maru Pop", "Hiragino Maru Gothic ProN", "Rounded Mplus 1c", sans-serif',
	},
	yomogi: {
		label: "よもぎ",
		stack: '"Yomogi", "Klee One", "Yu Gothic", "Comic Sans MS", cursive',
	},
	kiwi: {
		label: "キウイ丸",
		stack:
			'"Kiwi Maru", "Hiragino Maru Gothic ProN", "Rounded Mplus 1c", sans-serif',
	},
	mplus: { label: "M PLUS Rounded", stack: theme.fontSans },
	kosugi: {
		label: "小杉丸",
		stack:
			'"Kosugi Maru", "Hiragino Maru Gothic ProN", "Rounded Mplus 1c", sans-serif',
	},
	sans: {
		label: "ゴシック",
		stack:
			'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif',
	},
	serif: {
		label: "明朝",
		stack: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif',
	},
	mono: {
		label: "等幅",
		stack: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
	},
} as const;

/** フォント選択の key。text シェイプの fontFamily はこの値で保存する。 */
export type FontFamilyKey = keyof typeof FONT_CHOICES;

/** 新規テキストのデフォルトフォント（モッチーポップ）。 */
export const DEFAULT_FONT_FAMILY: FontFamilyKey = "mochiy";

/**
 * レガシー key の移行表。フォント構成を変えたときに、旧データで保存済みの
 * 注釈が壊れないよう最も近い現行フォントへ解決する。
 * - "rounded": Zen Maru Gothic 時代の丸ゴシック → キウイ丸。
 * - "pop": 3 フォント版で既定だったはちまるポップ（key 名だけ hachi に改称）→ hachi。
 */
const LEGACY_FONT_KEYS: Record<string, FontFamilyKey> = {
	rounded: "kiwi",
	pop: "hachi",
};

/**
 * フォント key を CSS の font-family スタック文字列へ解決する。
 * レガシー key（"rounded" / "pop"）は移行先へマッピングし、
 * それ以外の未知の key（旧データ・不正値）は既定（モッチーポップ）にフォールバックする。
 */
export function resolveFontStack(key: string | undefined): string {
	if (key && key in FONT_CHOICES) {
		return FONT_CHOICES[key as FontFamilyKey].stack;
	}
	const migrated = key ? LEGACY_FONT_KEYS[key] : undefined;
	if (migrated) {
		return FONT_CHOICES[migrated].stack;
	}
	return FONT_CHOICES[DEFAULT_FONT_FAMILY].stack;
}
