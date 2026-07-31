/**
 * 注釈の線種（実線/破線）を Konva の dash パターンへ解決する純粋ロジック。
 * 線・輪郭を持つ図形（矢印・矩形・楕円・ペン）で共有する。
 */

import type { ShapeType } from "./doc";

/**
 * 線種（実線/破線）の切り替えを持つ図形 type の集合。
 * 矢印・矩形・楕円・ペンが対象。マーカー（太い半透明のハイライト）は破線が
 * 用途に合わないため対象外。テキスト・モザイク・ステップ・フキダシも線種を持たない。
 */
const DASH_SUPPORTED: ReadonlySet<ShapeType> = new Set<ShapeType>([
	"arrow",
	"rect",
	"ellipse",
	"pen",
]);

/** 図形 type が線種（実線/破線）の切り替えに対応するか。 */
export function shapeSupportsDash(type: ShapeType): boolean {
	return DASH_SUPPORTED.has(type);
}

/**
 * 破線のダッシュ長・間隔を線幅の何倍にするか。
 * 線が太いほどダッシュも比例して大きくし、どの太さでも破線と分かるようにする。
 */
const DASH_LENGTH_SCALE = 3;
const GAP_LENGTH_SCALE = 2;
/** 細い線でも破線が潰れないよう、ダッシュ・間隔に設ける下限（px）。 */
const MIN_DASH = 4;
const MIN_GAP = 4;

/**
 * dash フラグと線幅から Konva の dash 配列（[ダッシュ長, 間隔]）を返す純粋関数。
 * - dash が false / 未指定 → 実線（空配列。Konva は空配列で実線扱い）。
 * - dash が true → 線幅に比例した [ダッシュ, 間隔]（下限つき）。
 */
export function resolveDash(
	dash: boolean | undefined,
	strokeWidth: number,
): number[] {
	if (!dash) return [];
	const w = Math.max(0, strokeWidth);
	const dashLen = Math.max(MIN_DASH, w * DASH_LENGTH_SCALE);
	const gapLen = Math.max(MIN_GAP, w * GAP_LENGTH_SCALE);
	return [dashLen, gapLen];
}
