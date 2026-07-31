import type { Size } from "@/lib/messages";

export interface Point {
	x: number;
	y: number;
}

/** ステージの変換状態（スケールと左上位置）。 */
export interface ViewTransform {
	scale: number;
	x: number;
	y: number;
}

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;
/** 全体フィット時にコンテナ端との間に空ける余白（px）。 */
export const FIT_PADDING = 24;

export function clampScale(scale: number): number {
	return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * 画像（doc サイズ）をコンテナに収める変換を求める。
 * 縦横比を保ったまま中央寄せする。画像がコンテナより小さいときは拡大しない
 * （scale の上限を 1 にする）。
 *
 * 余白（FIT_PADDING）は「画像がコンテナに収まらず縮小が必要なとき」だけ確保する。
 * 原寸（scale 1）でパディング無しでも収まる画像は 100% のまま表示する。
 * こうしないと、表示範囲キャプチャのようにコンテナ幅とほぼ同じ画像が
 * 余白のぶんだけ 96% 程度に縮小されてしまう。
 */
export function fitTransform(container: Size, content: Size): ViewTransform {
	if (content.width <= 0 || content.height <= 0) {
		return { scale: 1, x: 0, y: 0 };
	}
	// まず原寸（パディング無し）で収まるか判定する。収まるなら 100%。
	const fitsAtFullSize =
		content.width <= container.width && content.height <= container.height;
	let scale: number;
	if (fitsAtFullSize) {
		scale = 1;
	} else {
		// 収まらない場合はパディングを確保して縮小率を求める。
		const scaleX = (container.width - FIT_PADDING * 2) / content.width;
		const scaleY = (container.height - FIT_PADDING * 2) / content.height;
		scale = clampScale(Math.min(1, scaleX, scaleY));
	}
	return {
		scale,
		x: (container.width - content.width * scale) / 2,
		y: (container.height - content.height * scale) / 2,
	};
}

/**
 * ある一点（コンテナ座標 pivot）を固定したままスケールを nextScale へ変える変換を求める。
 * pivot 直下のドキュメント点が画面上で動かないように position を再計算する。
 */
export function zoomAtTransform(
	current: ViewTransform,
	pivot: Point,
	nextScale: number,
): ViewTransform {
	const scale = clampScale(nextScale);
	// pivot 直下のドキュメント座標を旧スケールで逆算する。
	const anchorX = (pivot.x - current.x) / current.scale;
	const anchorY = (pivot.y - current.y) / current.scale;
	return {
		scale,
		x: pivot.x - anchorX * scale,
		y: pivot.y - anchorY * scale,
	};
}
