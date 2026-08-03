/**
 * 複数選択（ラバーバンド）の交差判定に使う純粋計算。
 *
 * ラバーバンド矩形と各図形のバウンディングボックス（軸並行の外接矩形）が交差するかで
 * 選択に含めるかを決める。バウンディングボックスは doc 座標系（画像 px）で、type ごとに
 * 位置の持ち方（x/y/width/height を持つもの・points 列を持つもの・中心＋半径のもの）が
 * 違うので分岐して求める。回転は考慮しない（回転済み図形も未回転の外接矩形で近似する。
 * ラバーバンドは「触れていれば選ぶ」大掴みの操作なので実用上十分）。
 */

import { STEP_RADIUS } from "./step";
import type { Shape } from "./doc";

/** 軸並行の矩形（doc 座標系）。 */
export interface BBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * 2 つの軸並行矩形が交差する（重なりを持つ）か。辺だけが接する場合も交差とみなす
 * （< でなく <= 判定）。ラバーバンドは負方向ドラッグもあり得るので、呼び出し側で
 * 正規化済み（width/height が非負）の矩形を渡す前提。
 */
export function rectsIntersect(a: BBox, b: BBox): boolean {
	return (
		a.x <= b.x + b.width &&
		b.x <= a.x + a.width &&
		a.y <= b.y + b.height &&
		b.y <= a.y + a.height
	);
}

/** points 列 [x0,y0,x1,y1,...] の外接矩形を求める。空・奇数長でも安全に扱う。 */
function pointsBBox(points: number[]): BBox {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (let i = 0; i + 1 < points.length; i += 2) {
		const x = points[i] ?? 0;
		const y = points[i + 1] ?? 0;
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}
	if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * テキストの外接矩形を概算するための 1 文字あたりの平均幅（フォントサイズ比）。
 * 実測せずに近似するための係数。ラバーバンドの当たり判定は大掴みでよいので、
 * 丸文字フォントの平均的な字幅として控えめに見積もる。
 */
const TEXT_CHAR_WIDTH_RATIO = 0.6;

/**
 * テキスト（複数行対応）の外接矩形を概算する。実際の描画幅は canvas 計測が要るが、
 * ラバーバンド交差は「触れていれば選ぶ」大掴み判定なので、最長行の文字数 × 平均字幅、
 * 行数 × 行高（lineHeight 1.2）で近似する。
 */
function textBBox(x: number, y: number, text: string, fontSize: number): BBox {
	const lines = text.length > 0 ? text.split("\n") : [""];
	const maxLen = lines.reduce((m, line) => Math.max(m, line.length), 0);
	const width = Math.max(fontSize, maxLen * fontSize * TEXT_CHAR_WIDTH_RATIO);
	const height = lines.length * fontSize * 1.2;
	return { x, y, width, height };
}

/**
 * 図形の軸並行バウンディングボックス（doc 座標系）を返す純粋関数。
 * type ごとに位置・寸法の持ち方が違うので分岐する。
 * - x/y/width/height を持つ（矩形・楕円・モザイク・ぼかし・スマート消しゴム・
 *   スポットライト・フキダシ）はそのまま（フキダシはしっぽを無視して本体のみ。近似で十分）。
 * - points を持つ（矢印・直線・ペン・マーカー）は点列の外接矩形。
 * - text は文字数・行数から概算。
 * - step は中心 (x,y) ± 半径の正方形。
 */
export function shapeBoundingBox(shape: Shape): BBox {
	switch (shape.type) {
		case "rect":
		case "ellipse":
		case "mosaic":
		case "blur":
		case "erase":
		case "spotlight":
		case "callout":
			return {
				x: shape.x,
				y: shape.y,
				width: shape.width,
				height: shape.height,
			};
		case "arrow":
		case "line":
		case "pen":
		case "marker":
			return pointsBBox(shape.points);
		case "text":
			return textBBox(shape.x, shape.y, shape.text, shape.fontSize);
		case "step": {
			const r = shape.radius ?? STEP_RADIUS;
			return { x: shape.x - r, y: shape.y - r, width: r * 2, height: r * 2 };
		}
	}
}

/**
 * ラバーバンド矩形 band に外接矩形が交差する図形の id 配列を、doc の並び順で返す。
 * 複数選択の確定に使う。band は正規化済み（width/height が非負）を渡す前提。
 */
export function shapesInBand(shapes: Shape[], band: BBox): string[] {
	const ids: string[] = [];
	for (const shape of shapes) {
		if (rectsIntersect(band, shapeBoundingBox(shape))) ids.push(shape.id);
	}
	return ids;
}

/**
 * 選択 id 群を「グループ所属の図形はその同グループ全員も含む」ように拡張して返す
 * 純粋関数（doc の並び順・重複なし）。
 *
 * 図形をクリック / ラバーバンドで選ぶとき、その図形が groupId を持つなら同じ groupId の
 * 図形すべてを選択に加える。これにより単一クリックでもグループ全体がまとまって選ばれ、
 * 既存の複数選択機構（一括移動・削除・複製・nudge）がそのまま効く。groupId を持たない
 * （非所属の）図形はそのまま単独で扱う。
 *
 * 入力 ids に含まれない id は追加されない（拡張は「選ばれた図形の所属グループ」に限る）。
 * 存在しない id は無視する。
 */
export function expandSelectionToGroups(
	ids: string[],
	shapes: Shape[],
): string[] {
	// 選ばれた図形が属するグループの集合を集める。
	const byId = new Map(shapes.map((s) => [s.id, s]));
	const groups = new Set<string>();
	for (const id of ids) {
		const g = byId.get(id)?.groupId;
		if (g !== undefined) groups.add(g);
	}
	const selected = new Set(ids);
	// doc の並び順を保ったまま、元の選択 id と「所属グループが選択に触れた図形」を返す。
	return shapes
		.filter(
			(s) =>
				selected.has(s.id) ||
				(s.groupId !== undefined && groups.has(s.groupId)),
		)
		.map((s) => s.id);
}
