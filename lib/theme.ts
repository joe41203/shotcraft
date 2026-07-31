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
		'"Zen Maru Gothic", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif',
} as const;

/**
 * テキスト注釈で選べるフォント。doc には font-family スタック文字列でなく
 * この key を保存する（シリアライズを小さく安定に保つ）。描画時に stack へ解決する。
 * rounded の stack は theme.fontSans と同一（先頭は同梱の Zen Maru Gothic）。
 */
export const FONT_CHOICES = {
	rounded: { label: "丸ゴシック", stack: theme.fontSans },
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

/** 新規テキストのデフォルトフォント（丸ゴシック）。 */
export const DEFAULT_FONT_FAMILY: FontFamilyKey = "rounded";

/**
 * フォント key を CSS の font-family スタック文字列へ解決する。
 * 未知の key（旧データ・不正値）は rounded にフォールバックする。
 */
export function resolveFontStack(key: string | undefined): string {
	if (key && key in FONT_CHOICES) {
		return FONT_CHOICES[key as FontFamilyKey].stack;
	}
	return FONT_CHOICES[DEFAULT_FONT_FAMILY].stack;
}
