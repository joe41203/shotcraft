/**
 * デザイントークン（Dark Mode）の TS 定数版。
 *
 * この値は assets/tokens.css の CSS 変数と相互に同期させること。
 * content script の Shadow DOM は拡張ページの CSS 変数（:root の --bg 等）を
 * 参照できないため、同じ値をここにも定義している。片方を変えたら必ずもう片方も変える。
 */
export const theme = {
	bg: "#0b0f19", // 最深部（ページ・キャンバス領域）
	surface: "#161b26", // ツールバー・ポップアップの面
	surface2: "#1f2632", // 面上の面（select 等）
	surfaceHover: "#232b39", // hover 時の面
	// Shadow DOM は下地に半透明を合成できないため、border は surface 上に
	// rgba(255,255,255,0.09) を合成した実効色（不透明）を持たせる。
	border: "#2a303b", // 極薄境界線（surface 上での合成実効色）
	text: "#f2f5f9", // 主文字
	textMuted: "#9aa6b8", // 補助文字
	accent: "#10b981", // 主要アクション（emerald）
	danger: "#f87171", // 破壊的操作
	ring: "#38bdf8", // フォーカスリング・選択色（範囲選択の枠色と同一系統）
	// UI フォントは同梱せず OS のシステムフォントに依存する。
	// この値は assets/tokens.css の --font-sans と相互に同期させること。
	fontSans:
		'-apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif',
	// テキスト注釈（Konva/textarea オーバーレイ）で使う固定フォント。
	// 同梱するのはこの Mochiy Pop One 1 種だけ。以降はシステムフォールバック。
	// この値は assets/tokens.css の --font-annotation と相互に同期させること。
	fontAnnotation:
		'"Mochiy Pop One", "Hiragino Maru Gothic ProN", "Rounded Mplus 1c", -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif',
} as const;
