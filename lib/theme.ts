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
