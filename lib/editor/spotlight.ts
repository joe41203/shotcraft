/**
 * スポットライト（暗幕）の純粋ロジック。
 *
 * スポットライトは「画像全体を覆う半透明の黒い暗幕に、指定矩形の穴を開ける」ことで
 * 選んだ領域だけを明るく残し、視線を誘導する注釈。実際の暗幕描画（Konva の
 * globalCompositeOperation="destination-out" による穴あけ）は DOM 依存なので
 * render.ts 側に置く。ここには「暗幕の不透明度」「穴矩形の正規化・クランプ」
 * 「角丸・フェザーの寸法」「暗幕の挿入位置」など描画に依らない純粋計算だけを置き、
 * テスト可能にする。
 */

import type { Rect, Size } from "../messages";
import type { ShapeType } from "./doc";

/**
 * 暗幕（画像全体を覆う黒）の既定不透明度（0〜1）。
 * 明るく残る穴との差が視線誘導として十分つく程度に濃くする。0.70 は「暗部の
 * 内容がうっすら残る」より一段濃く、明るい穴へ視線が強く集まる濃さ。
 * doc.spotlightAlpha 未設定（旧データ）のフォールバック値でもある。
 */
export const SPOTLIGHT_DIM_ALPHA = 0.7;

/** 暗さ（薄め / 標準 / 濃いめ）の選択肢。値は暗幕の不透明度（0〜1）。標準は SPOTLIGHT_DIM_ALPHA。 */
export const SPOTLIGHT_DIM_OPTIONS = [
	{ value: 0.55, label: "薄め" },
	{ value: SPOTLIGHT_DIM_ALPHA, label: "標準" },
	{ value: 0.85, label: "濃いめ" },
] as const;

/** SPOTLIGHT_DIM_OPTIONS の値の集合（正規化・プリセット一致判定に使う）。 */
const DIM_ALPHA_VALUES: ReadonlySet<number> = new Set(
	SPOTLIGHT_DIM_OPTIONS.map((o) => o.value),
);

/**
 * 任意の値を暗幕の不透明度（0〜1）へ正規化する純粋関数。
 * 有限数なら [0, 1] へクランプ、数値でなければ既定（SPOTLIGHT_DIM_ALPHA）へ落とす。
 * doc.spotlightAlpha の読み込み・style-prefs の検証で使う。
 */
export function normalizeSpotlightAlpha(raw: unknown): number {
	if (typeof raw === "number" && Number.isFinite(raw)) {
		return clamp(raw, 0, 1);
	}
	return SPOTLIGHT_DIM_ALPHA;
}

/**
 * 暗幕の不透明度（省略時は既定 SPOTLIGHT_DIM_ALPHA）を解決する純粋関数。
 * doc.spotlightAlpha が未設定（旧データ）や不正値でも既定へ落として必ず有効な値を返す。
 */
export function resolveSpotlightAlpha(alpha?: number): number {
	return alpha != null ? normalizeSpotlightAlpha(alpha) : SPOTLIGHT_DIM_ALPHA;
}

/** alpha がプリセット（薄め / 標準 / 濃いめ）のどれかに一致するか。フライアウトの active 表示に使う。 */
export function isSpotlightDimPreset(alpha: number): boolean {
	return DIM_ALPHA_VALUES.has(alpha);
}

/**
 * 矩形穴の角丸半径（px）を穴の寸法から決める純粋関数。
 * 短辺の 12% を目安に、下限 4 / 上限 16px へクランプする。硬い直角の穴より
 * 角丸のほうがプロ品質に見える（矩形スポットライトのみで使い、楕円では使わない）。
 */
export function spotlightCornerRadius(width: number, height: number): number {
	const shortSide = Math.min(Math.abs(width), Math.abs(height));
	return clamp(shortSide * 0.12, 4, 16);
}

/**
 * 穴の縁のフェザー（ぼかし）幅（px）を穴の寸法から決める純粋関数。
 * 短辺の 8% を目安に、下限 6 / 上限 24px へクランプする。縁を硬い切り口でなく
 * 柔らかくぼかすことで、暗部から明部へなめらかに繋がって見える。矩形・楕円の
 * 両方で使う。
 */
export function spotlightFeather(width: number, height: number): number {
	const shortSide = Math.min(Math.abs(width), Math.abs(height));
	return clamp(shortSide * 0.08, 6, 24);
}

/**
 * 暗幕を shapes 配列のどのインデックス位置へ差し込むかを決める純粋関数。
 *
 * 新ルール: 「最初に現れる注釈系図形（spotlight/mosaic/blur 以外）の直下」に暗幕を
 * 置く。注釈系が 1 つも無ければ全図形の上（＝配列長）を返す。これにより:
 * - 注釈（矢印・テキスト・フキダシ等）は描き順に関係なく常に暗幕より上＝明るいまま
 * - 注釈より前に置いた mosaic/blur は暗幕の下＝暗くなる（自然）
 * - 「モザイクを最前面（注釈の後）に置いて注釈を隠す」ハックは、そのモザイクが
 *   暗幕より上に来るため維持される
 * type 情報だけで判定でき、描き順（配列内の spotlight の位置）に依存しない。
 */
export function spotlightVeilIndex(shapes: { type: ShapeType }[]): number {
	const index = shapes.findIndex(
		(s) => s.type !== "spotlight" && s.type !== "mosaic" && s.type !== "blur",
	);
	return index === -1 ? shapes.length : index;
}

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
