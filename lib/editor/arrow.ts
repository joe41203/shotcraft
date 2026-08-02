/**
 * 矢印スタイル（片側 / 両側 / 曲線）の純粋計算。
 *
 * 曲線矢印は始点・終点を結ぶ 2 次ベジェで描く。制御点は「始点終点の中点を、その線分の
 * 法線方向へ距離の一定割合ぶん膨らませた点」で、ここで一意に決める（制御点の UI は無い）。
 * 描画（render.ts）はこの制御点から Konva.Line の points（始点・制御点・終点）＋
 * tension でベジェ曲線を描き、矢頭は終端の接線方向（制御点→終点のベクトル）を向かせる。
 */

import type { ArrowShape } from "./doc";

/**
 * 矢印のスタイル。省略時（未設定の旧データ）は "single" 扱い（後方互換）。
 * - single: 終端のみ矢頭（既定）。
 * - double: 始端・終端の両方に矢頭。
 * - curved: 始点終点を 2 次ベジェで結んだ曲線。矢頭は終端のみ。
 */
export type ArrowStyle = NonNullable<ArrowShape["arrowStyle"]>;

/** 曲線の膨らみ量（線分長に対する割合）。中点を法線方向へこの割合ぶんずらす。 */
export const CURVE_BULGE_RATIO = 0.18;

/** 有効な矢印スタイルの集合（正規化に使う）。 */
const ARROW_STYLES: ReadonlySet<string> = new Set([
	"single",
	"double",
	"curved",
]);

/**
 * 任意の値を ArrowStyle へ正規化する純粋関数。
 * "single" / "double" / "curved" のいずれかならそのまま、それ以外（未設定・不正値）は
 * "single"（後方互換の既定）へ落とす。style-prefs の保存値の検証にも使う。
 */
export function normalizeArrowStyle(raw: unknown): ArrowStyle {
	return typeof raw === "string" && ARROW_STYLES.has(raw)
		? (raw as ArrowStyle)
		: "single";
}

/**
 * 曲線矢印の 2 次ベジェ制御点を返す純粋関数。
 *
 * points は [x1, y1, x2, y2]（始点・終点）。始点終点の中点を、線分に対する法線方向へ
 * 「線分長 × CURVE_BULGE_RATIO」ぶんずらした点を制御点とする。膨らむ向きは法線
 * (-dy, dx)（線分を始点→終点に見て左側）で一定にし、同じ 2 点なら常に同じ曲率になる。
 * 線分長が 0（始点＝終点）のときは中点（＝始点）をそのまま返す。
 */
export function curvedArrowControl(points: number[]): { x: number; y: number } {
	const x1 = points[0] ?? 0;
	const y1 = points[1] ?? 0;
	const x2 = points[2] ?? 0;
	const y2 = points[3] ?? 0;
	const mx = (x1 + x2) / 2;
	const my = (y1 + y2) / 2;
	const dx = x2 - x1;
	const dy = y2 - y1;
	const len = Math.hypot(dx, dy);
	if (len === 0) return { x: mx, y: my };
	// 単位法線 (-dy, dx) / len を、膨らみ量（線分長の一定割合）ぶん中点へ足す。
	const bulge = len * CURVE_BULGE_RATIO;
	return {
		x: mx + (-dy / len) * bulge,
		y: my + (dx / len) * bulge,
	};
}
