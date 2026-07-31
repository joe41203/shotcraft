/**
 * ツールバー用の inline SVG アイコン。
 * 24x24 viewBox・currentColor 塗り/線で、CSS から色を制御できるようにする。
 * 絵文字は使わない（ユーザー指定）。
 */

const svg = (inner: string): string =>
	`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const icons = {
	// 選択（矢印カーソル）
	select: svg(
		'<path d="M5 3l6.5 16 2.3-6.7L20.5 10z" fill="currentColor" stroke="none"/>',
	),
	// 矢印
	arrow: svg(
		'<line x1="5" y1="19" x2="19" y2="5"/><polyline points="10 5 19 5 19 14"/>',
	),
	// 矩形
	rect: svg('<rect x="4" y="6" width="16" height="12" rx="1"/>'),
	// 楕円
	ellipse: svg('<ellipse cx="12" cy="12" rx="9" ry="6"/>'),
	// テキスト
	text: svg(
		'<polyline points="5 6 5 5 19 5 19 6"/><line x1="12" y1="5" x2="12" y2="19"/><line x1="9" y1="19" x2="15" y2="19"/>',
	),
	// ペン
	pen: svg(
		'<path d="M4 20l4-1 10-10-3-3L5 16z"/><line x1="14.5" y1="6.5" x2="17.5" y2="9.5"/>',
	),
	// 蛍光マーカー
	marker: svg(
		'<path d="M9 14l-2 5 5-2 8-8-3-3z"/><line x1="14" y1="6" x2="18" y2="10"/><line x1="5" y1="21" x2="12" y2="21"/>',
	),
	// undo
	undo: svg(
		'<polyline points="9 7 4 12 9 17"/><path d="M4 12h11a5 5 0 0 1 0 10h-1"/>',
	),
	// redo
	redo: svg(
		'<polyline points="15 7 20 12 15 17"/><path d="M20 12H9a5 5 0 0 0 0 10h1"/>',
	),
} as const;
