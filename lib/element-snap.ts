import { clamp } from "./geometry";
import type { Rect, Size } from "./messages";

/**
 * 要素スナップ（カーソル下の DOM 要素をハイライトしてクリックで撮る）の純粋計算。
 *
 * 座標はすべて CSS px（ビューポート基準）で、範囲選択オーバーレイ・REGION_SELECTED
 * と同じ座標系。DOM や描画には依存しない（elementFromPoint 等の副作用は content
 * script 側に置き、ここは値の判定・整形だけを行う）。
 */

/** これ未満（px）の移動はクリック扱い。超えたらドラッグ（自由範囲選択）へ切り替える。 */
export const CLICK_MOVE_THRESHOLD_PX = 4;

/**
 * ハイライト対象にしない極小要素の下限（px）。
 * 幅・高さのどちらかがこれ未満なら、細かすぎる（区切り線・不可視要素など）ため無視する。
 */
export const MIN_ELEMENT_SIZE_PX = 8;

/**
 * 2 点間の移動量がクリック閾値未満か（＝クリックとみなすか）を返す。
 *
 * mousedown → mouseup（pointerdown → pointerup）の距離で判定する。チェビシェフ距離
 * （dx・dy の大きい方）を使い、CLICK_MOVE_THRESHOLD_PX 未満なら真。閾値ちょうどは
 * ドラッグ扱い（自由範囲選択と同じ「未満はクリック」規約に合わせる）。
 */
export function isClick(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	threshold = CLICK_MOVE_THRESHOLD_PX,
): boolean {
	const dx = Math.abs(x2 - x1);
	const dy = Math.abs(y2 - y1);
	return Math.max(dx, dy) < threshold;
}

/**
 * 要素の DOMRect（相当の値）を、ハイライト対象として妥当か判定しつつ
 * ビューポートへクランプした Rect を返す。対象外なら null。
 *
 * - 幅・高さのどちらかが MIN_ELEMENT_SIZE_PX 未満なら null（極小要素は無視）。
 * - ビューポート外へはみ出す部分は切り詰める（画面内に見えている範囲だけを対象にする）。
 * - クランプ後に幅・高さが MIN_ELEMENT_SIZE_PX 未満になった場合も null（ほぼ画面外）。
 *
 * 返す Rect は CSS px。REGION_SELECTED にそのまま載せられる（ドラッグ確定と同一系）。
 */
export function elementRectToSnapRect(
	rect: { left: number; top: number; width: number; height: number },
	viewport: Size,
	minSize = MIN_ELEMENT_SIZE_PX,
): Rect | null {
	if (viewport.width <= 0 || viewport.height <= 0) return null;
	// 生の要素サイズが極小なら弾く（クランプ前に判定し、区切り線等を確実に除外する）。
	if (rect.width < minSize || rect.height < minSize) return null;

	const left = clamp(rect.left, 0, viewport.width);
	const top = clamp(rect.top, 0, viewport.height);
	const right = clamp(rect.left + rect.width, 0, viewport.width);
	const bottom = clamp(rect.top + rect.height, 0, viewport.height);

	const width = right - left;
	const height = bottom - top;
	// 画面外に大半が出ていて、見えている領域が極小になった場合も対象外にする。
	if (width < minSize || height < minSize) return null;
	return { x: left, y: top, width, height };
}
