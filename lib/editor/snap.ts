/**
 * 整列スナップ（Canvas Snapping）の吸着計算に使う純粋計算。
 *
 * ドラッグ中の図形（movingBox）の端が、他の図形（otherBoxes・ドラッグ対象外）の端に
 * 近づいたら吸着させ、赤いガイド線を出す（Figma / Snagit 風）。UI/Konva に依存しない
 * 純粋関数として計算だけをここに置き、描画・ドラッグ機構への統合は app 側が担う。
 *
 * 吸着候補は各軸で「自分の左/中央/右（x 軸）× 相手の左/中央/右」の 9 組合せ
 * （y 軸も上/中央/下で 9 組合せ）。各組合せのずれ（相手位置 − 自分位置）が
 * しきい値以内なら候補になり、軸ごとに最も近い（|ずれ| 最小の）候補を採る。
 * しきい値は画面上で一定の吸着感になるよう、呼び出し側でズーム率で割った
 * ドキュメント座標のしきい値を渡す（例: 6px / scale）。
 */

import type { BBox } from "./selection";

/** スナップのガイド線が伸びる軸。"x" = 縦線（x 位置に整列）、"y" = 横線（y 位置に整列）。 */
export type SnapAxis = "x" | "y";

/**
 * 1 本の整列ガイド線。position は整列した座標（縦線なら x、横線なら y）。
 * from/to はガイド線を描く区間（縦線なら y の区間、横線なら x の区間）で、
 * 吸着した「自分」と「相手」の両ボックスを覆う範囲にする（視覚的に整列が分かるように）。
 */
export interface SnapGuide {
	axis: SnapAxis;
	position: number;
	from: number;
	to: number;
}

/**
 * computeSnap の結果。dx/dy は movingBox をそのぶん平行移動すると端が整列する補正量
 * （吸着が無い軸は 0）。guides は表示するガイド線（吸着した軸のぶんだけ）。
 */
export interface SnapResult {
	dx: number;
	dy: number;
	guides: SnapGuide[];
}

/** 軸並行矩形の x 軸方向の 3 つの端（左 / 中央 / 右）。 */
function edgesX(box: BBox): number[] {
	return [box.x, box.x + box.width / 2, box.x + box.width];
}

/** 軸並行矩形の y 軸方向の 3 つの端（上 / 中央 / 下）。 */
function edgesY(box: BBox): number[] {
	return [box.y, box.y + box.height / 2, box.y + box.height];
}

/** 1 軸ぶんの最良吸着候補。delta は補正量（相手位置 − 自分位置）、pos は整列座標。 */
interface AxisSnap {
	delta: number;
	/** 整列後の座標（相手の端位置）。ガイド線の position に使う。 */
	pos: number;
	/** 吸着した相手ボックス（ガイド線の区間計算に使う）。 */
	other: BBox;
}

/**
 * 1 軸（x または y）で最も近い吸着候補を求める。
 * moving/others はその軸方向の 3 端（左中右 or 上中下）。しきい値以内の候補のうち
 * |delta| が最小のものを返す。候補が無ければ null。同点は先に見つけた候補を優先
 * （安定した選択）。相手ボックスは候補ごとに追跡し、採用時にガイド区間へ使う。
 */
function bestAxisSnap(
	movingEdges: number[],
	otherBoxes: BBox[],
	otherEdges: (box: BBox) => number[],
	threshold: number,
): AxisSnap | null {
	let best: AxisSnap | null = null;
	for (const mv of movingEdges) {
		for (const box of otherBoxes) {
			for (const ov of otherEdges(box)) {
				const delta = ov - mv;
				if (Math.abs(delta) > threshold) continue;
				// より近い候補のみ更新（同 |delta| は先勝ちで安定させる）。
				if (best === null || Math.abs(delta) < Math.abs(best.delta)) {
					best = { delta, pos: ov, other: box };
				}
			}
		}
	}
	return best;
}

/**
 * ドラッグ中の movingBox を、他ボックス（otherBoxes）の端へ吸着させる補正量と
 * ガイド線を求める純粋関数。
 *
 * x 軸・y 軸を独立に扱い、それぞれ「自分の左/中央/右 × 相手の左/中央/右」（y は上/中央/下）
 * の 9 組合せから、ずれがしきい値以内で最も近い候補を採る。両軸で吸着すれば dx/dy とも
 * 非 0、ガイド線は 2 本になる。しきい値はドキュメント座標系（呼び出し側で画面 px を
 * ズーム率で割って渡す）。otherBoxes が空・どの端も範囲外なら dx=dy=0・guides 空。
 *
 * ガイド線の区間（from/to）は、吸着した自分と相手のボックスを両方覆う範囲にする
 * （縦線なら両者の上端の最小〜下端の最大、横線なら左端の最小〜右端の最大）。区間は
 * 補正後の movingBox 位置で測る（吸着してぴったり整列した見た目に合わせる）。
 */
export function computeSnap(
	movingBox: BBox,
	otherBoxes: BBox[],
	threshold: number,
): SnapResult {
	const guides: SnapGuide[] = [];

	const snapX = bestAxisSnap(edgesX(movingBox), otherBoxes, edgesX, threshold);
	const snapY = bestAxisSnap(edgesY(movingBox), otherBoxes, edgesY, threshold);

	const dx = snapX?.delta ?? 0;
	const dy = snapY?.delta ?? 0;
	// 補正を反映した後の自分ボックス（ガイド区間はこの位置で測る）。
	const moved: BBox = {
		x: movingBox.x + dx,
		y: movingBox.y + dy,
		width: movingBox.width,
		height: movingBox.height,
	};

	if (snapX) {
		// 縦線: x = 整列座標。区間 y は自分と相手の上端最小〜下端最大。
		const o = snapX.other;
		guides.push({
			axis: "x",
			position: snapX.pos,
			from: Math.min(moved.y, o.y),
			to: Math.max(moved.y + moved.height, o.y + o.height),
		});
	}
	if (snapY) {
		// 横線: y = 整列座標。区間 x は自分と相手の左端最小〜右端最大。
		const o = snapY.other;
		guides.push({
			axis: "y",
			position: snapY.pos,
			from: Math.min(moved.x, o.x),
			to: Math.max(moved.x + moved.width, o.x + o.width),
		});
	}

	return { dx, dy, guides };
}
