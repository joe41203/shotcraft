/**
 * スポットライト（暗幕）の純粋ロジック。
 *
 * スポットライトは「画像全体を覆う半透明の黒い暗幕に、指定矩形の穴を開ける」ことで
 * 選んだ領域だけを明るく残し、視線を誘導する注釈。実際の暗幕描画（Konva の
 * globalCompositeOperation="destination-out" による穴あけ）は DOM 依存なので
 * render.ts 側に置く。ここには「暗幕の不透明度」と「穴矩形の正規化・クランプ」など
 * 描画に依らない純粋計算だけを置き、テスト可能にする。
 */

import type { Rect, Size } from "../messages";

/**
 * 暗幕（画像全体を覆う黒）の不透明度（0〜1）。
 * 明るく残る穴との差が視線誘導として十分つく程度に濃くしつつ、
 * 暗部の内容がうっすら見える程度に留める。
 */
export const SPOTLIGHT_DIM_ALPHA = 0.55;

/**
 * 穴矩形（スポットライトの明るく残す領域）を画像全体の範囲内へクランプした
 * 正の矩形へ正規化する。負の寸法や画像外へはみ出す矩形でも安全に扱えるようにする。
 *
 * - 左上・右下を画像境界 [0, size] にクランプしてから幅・高さを求める。
 * - 完全に画像外・幅か高さが 0 以下になる矩形は null を返す（穴を開けない）。
 */
export function clampSpotlightHole(hole: Rect, size: Size): Rect | null {
	const left = clamp(Math.min(hole.x, hole.x + hole.width), 0, size.width);
	const right = clamp(Math.max(hole.x, hole.x + hole.width), 0, size.width);
	const top = clamp(Math.min(hole.y, hole.y + hole.height), 0, size.height);
	const bottom = clamp(Math.max(hole.y, hole.y + hole.height), 0, size.height);

	const width = right - left;
	const height = bottom - top;
	if (width <= 0 || height <= 0) return null;
	return { x: left, y: top, width, height };
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
