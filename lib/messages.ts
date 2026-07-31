export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Size {
	width: number;
	height: number;
}

/**
 * popup → service worker: 表示範囲をそのままキャプチャする。
 * delayMs があれば background 側でその時間だけ待ってから撮る（遅延キャプチャ）。
 * 省略・0 のときは即時（後方互換）。ホバーメニューやツールチップを出した状態で
 * 撮る用途に使う。
 */
export interface CaptureVisibleMessage {
	type: "CAPTURE_VISIBLE";
	delayMs?: number;
}

/** popup → service worker: 範囲選択オーバーレイの起動を要求する */
export interface StartRegionSelectMessage {
	type: "START_REGION_SELECT";
}

/**
 * popup → service worker: ページ全体をスクロールしながら撮影し、
 * 1 枚の縦長画像に繋ぎ合わせる（フルページキャプチャ）。
 */
export interface CaptureFullPageMessage {
	type: "CAPTURE_FULL_PAGE";
}

/**
 * content script → service worker: 選択された矩形。
 * rect / viewport はいずれも CSS px（ビューポート基準）。
 * bitmap との軸別スケールで CSS px → 画像 px に変換する（devicePixelRatio は使わない）。
 */
export interface RegionSelectedMessage {
	type: "REGION_SELECTED";
	rect: Rect;
	viewport: Size;
}

/** content script → service worker: 選択がキャンセルされた */
export interface RegionCancelledMessage {
	type: "REGION_CANCELLED";
}

/** すべての受信メッセージ（service worker が受ける判別可能ユニオン） */
export type Message =
	| CaptureVisibleMessage
	| StartRegionSelectMessage
	| CaptureFullPageMessage
	| RegionSelectedMessage
	| RegionCancelledMessage;
