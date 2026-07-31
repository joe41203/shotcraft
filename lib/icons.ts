/**
 * inline SVG アイコン。editor のツールバーと popup の両方から使う。
 * 24x24 viewBox・stroke 2px・線画で統一。currentColor 塗り/線で、CSS から色を制御できるようにする。
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
	// モザイク（ピクセルのグリッド）
	mosaic: svg(
		'<rect x="4" y="4" width="16" height="16" rx="1"/><line x1="4" y1="9.5" x2="20" y2="9.5"/><line x1="4" y1="14.5" x2="20" y2="14.5"/><line x1="9.5" y1="4" x2="9.5" y2="20"/><line x1="14.5" y1="4" x2="14.5" y2="20"/>',
	),
	// undo
	undo: svg(
		'<polyline points="9 7 4 12 9 17"/><path d="M4 12h11a5 5 0 0 1 0 10h-1"/>',
	),
	// redo
	redo: svg(
		'<polyline points="15 7 20 12 15 17"/><path d="M20 12H9a5 5 0 0 0 0 10h1"/>',
	),
	// ダウンロード（PNG 保存）
	download: svg(
		'<path d="M12 3v12"/><polyline points="7 11 12 16 17 11"/><path d="M5 20h14"/>',
	),
	// クリップボードへコピー
	copy: svg(
		'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
	),
	// 表示範囲キャプチャ（カメラ）
	camera: svg(
		'<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
	),
	// 範囲選択キャプチャ（クロップ枠）
	crop: svg('<path d="M6 2v16h16"/><path d="M18 22V6H2"/>'),
} as const;
