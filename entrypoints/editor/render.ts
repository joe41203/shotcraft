import Konva from "konva";
import type { EditorDoc, MosaicShape, Shape } from "@/lib/editor/doc";
import { mosaicPixelSize } from "@/lib/editor/mosaic";
import { clampFontSize } from "@/lib/editor/text";
import { resolveFontStack } from "@/lib/theme";

/** マーカー（蛍光ペン）の描画パラメータ。入力の太さを基準に太く半透明にする。 */
const MARKER_WIDTH_SCALE = 3;
const MARKER_OPACITY = 0.4;

/**
 * モザイク描画のサンプリング元。ベース画像そのもの（キャプチャ原寸）を
 * 描画可能なソースとして受け取る。renderShapes / shapeToNode に渡す。
 */
export type MosaicSource = CanvasImageSource & {
	width: number;
	height: number;
};

/** 線幅に応じた矢印ヘッドの寸法。太い線ほどヘッドも大きくする。 */
function arrowHead(strokeWidth: number): {
	pointerLength: number;
	pointerWidth: number;
} {
	return {
		pointerLength: 6 + strokeWidth * 3,
		pointerWidth: 6 + strokeWidth * 2.5,
	};
}

/**
 * 1 つの Shape から対応する Konva ノードを生成する。
 * ノードには figure 用の共通属性（id, name, draggable）を付け、
 * shape.id を Konva ノードの id() に一致させて doc との対応付けに使う。
 * draggable は呼び出し側（select ツール時のみ true）で制御する。
 *
 * mosaic だけはベース画像をサンプリング元にするため source を要する。
 * source が無い場合（プレビュー等）はプレースホルダの半透明矩形を返す。
 */
export function shapeToNode(shape: Shape, source?: MosaicSource): Konva.Shape {
	const common = {
		id: shape.id,
		name: "shape",
		rotation: shape.rotation,
		opacity: shape.opacity,
	};

	switch (shape.type) {
		case "mosaic":
			return source
				? buildMosaicNode(shape, source)
				: new Konva.Rect({
						...common,
						x: shape.x,
						y: shape.y,
						width: shape.width,
						height: shape.height,
						fill: "rgba(15, 23, 42, 0.5)",
					});
		case "arrow":
			return new Konva.Arrow({
				...common,
				points: shape.points,
				stroke: shape.stroke,
				fill: shape.stroke,
				strokeWidth: shape.strokeWidth,
				lineCap: "round",
				lineJoin: "round",
				hitStrokeWidth: Math.max(shape.strokeWidth, 12),
				...arrowHead(shape.strokeWidth),
			});
		case "rect":
			return new Konva.Rect({
				...common,
				x: shape.x,
				y: shape.y,
				width: shape.width,
				height: shape.height,
				stroke: shape.stroke,
				strokeWidth: shape.strokeWidth,
			});
		case "ellipse":
			return new Konva.Ellipse({
				...common,
				x: shape.x + shape.width / 2,
				y: shape.y + shape.height / 2,
				radiusX: shape.width / 2,
				radiusY: shape.height / 2,
				stroke: shape.stroke,
				strokeWidth: shape.strokeWidth,
			});
		case "text":
			return new Konva.Text({
				...common,
				x: shape.x,
				y: shape.y,
				text: shape.text,
				fontSize: shape.fontSize,
				fill: shape.stroke,
				// text-overlay（textarea）と同じ見た目にするため fontFamily key を
				// stack へ解決して使う（未指定・旧データは既定の mochiy/モッチーポップに
				// フォールバック。レガシー "rounded"→kiwi、"pop"→hachi へ移行）。canvas 描画
				// なので、フォント読み込み完了前に描くとフォールバックされる。エディタ
				// 初期化時に main.ts で document.fonts.load() を await してから描画に入る。
				fontFamily: resolveFontStack(shape.fontFamily),
				lineHeight: 1.2,
			});
		case "pen":
			return new Konva.Line({
				...common,
				points: shape.points,
				stroke: shape.stroke,
				strokeWidth: shape.strokeWidth,
				lineCap: "round",
				lineJoin: "round",
				tension: 0,
				hitStrokeWidth: Math.max(shape.strokeWidth, 12),
			});
		case "marker":
			return new Konva.Line({
				...common,
				points: shape.points,
				stroke: shape.stroke,
				strokeWidth: shape.strokeWidth * MARKER_WIDTH_SCALE,
				opacity: shape.opacity * MARKER_OPACITY,
				lineCap: "round",
				lineJoin: "round",
				tension: 0,
				hitStrokeWidth: Math.max(shape.strokeWidth * MARKER_WIDTH_SCALE, 12),
			});
	}
}

/**
 * モザイク矩形を、ベース画像の該当領域をピクセル化した Konva.Image として作る。
 *
 * オフスクリーン canvas にベース画像の [x,y,width,height] を「一旦 1/pixelSize に
 * 縮小して描き、それを imageSmoothingEnabled=false のまま原寸へ引き伸ばす」ことで
 * ブロック状のピクセル化を得る（縮小時の平均化 → 拡大時の最近傍で角ばる）。
 * サンプリング元はベース画像のみなので、下に重なる注釈にはモザイクが掛からない。
 */
export function buildMosaicNode(
	shape: MosaicShape,
	source: MosaicSource,
): Konva.Image {
	const w = Math.max(1, Math.round(shape.width));
	const h = Math.max(1, Math.round(shape.height));
	const pixel = mosaicPixelSize(w, h);
	// 縮小先の寸法（最低 1px）。ここが粗さを決める。
	const sw = Math.max(1, Math.round(w / pixel));
	const sh = Math.max(1, Math.round(h / pixel));

	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const cx = canvas.getContext("2d");
	if (cx) {
		// 1) ベース画像の該当領域を小さな canvas 相当に縮小して描く。
		cx.imageSmoothingEnabled = true;
		cx.drawImage(source, shape.x, shape.y, w, h, 0, 0, sw, sh);
		// 2) その縮小結果を最近傍補間のまま原寸へ引き伸ばす（ブロック化）。
		cx.imageSmoothingEnabled = false;
		cx.drawImage(canvas, 0, 0, sw, sh, 0, 0, w, h);
	}

	return new Konva.Image({
		id: shape.id,
		name: "shape",
		image: canvas,
		x: shape.x,
		y: shape.y,
		width: shape.width,
		height: shape.height,
		rotation: shape.rotation,
		opacity: shape.opacity,
	});
}

/**
 * doc の全図形を Konva レイヤーへ同期描画する。
 * 差分更新は凝らず全再構築する（描画の正は常に doc 側）。
 * draggable は select ツール時のみ true にしたいので引数で受ける。
 * source はモザイクのサンプリング元（ベース画像）。
 */
export function renderShapes(
	layer: Konva.Layer,
	doc: EditorDoc,
	draggable: boolean,
	source?: MosaicSource,
): void {
	layer.destroyChildren();
	for (const shape of doc.shapes) {
		const node = shapeToNode(shape, source);
		node.draggable(draggable);
		layer.add(node);
	}
	layer.batchDraw();
}

/**
 * Konva ノードの現在状態（Transformer による移動・リサイズ・回転を含む）を
 * Shape へ焼き込んで返す。scaleX/scaleY は width/height・fontSize・points 等へ
 * 反映し、ノード側に scale を残さない（次の renderShapes で作り直すため）。
 * 対応する shape が無い、または未対応 type の場合は null。
 */
export function shapeFromNode(node: Konva.Node, prev: Shape): Shape {
	switch (prev.type) {
		case "arrow": {
			const line = node as Konva.Arrow;
			return {
				...prev,
				points: scalePoints(
					line.points(),
					line.x(),
					line.y(),
					line.scaleX(),
					line.scaleY(),
				),
				rotation: line.rotation(),
			};
		}
		case "pen":
		case "marker": {
			const line = node as Konva.Line;
			return {
				...prev,
				points: scalePoints(
					line.points(),
					line.x(),
					line.y(),
					line.scaleX(),
					line.scaleY(),
				),
				rotation: line.rotation(),
			};
		}
		case "rect": {
			const rect = node as Konva.Rect;
			return {
				...prev,
				x: rect.x(),
				y: rect.y(),
				width: Math.max(1, rect.width() * rect.scaleX()),
				height: Math.max(1, rect.height() * rect.scaleY()),
				rotation: rect.rotation(),
			};
		}
		case "ellipse": {
			const el = node as Konva.Ellipse;
			const rx = Math.max(0.5, el.radiusX() * el.scaleX());
			const ry = Math.max(0.5, el.radiusY() * el.scaleY());
			return {
				...prev,
				x: el.x() - rx,
				y: el.y() - ry,
				width: rx * 2,
				height: ry * 2,
				rotation: el.rotation(),
			};
		}
		case "text": {
			// 四隅ハンドルの比例スケール（scaleX===scaleY）を fontSize へ焼き込む。
			// 下限 8px・上限 200px にクランプして極端なサイズを防ぐ。
			const text = node as Konva.Text;
			return {
				...prev,
				x: text.x(),
				y: text.y(),
				fontSize: clampFontSize(text.fontSize() * text.scaleX()),
				rotation: text.rotation(),
			};
		}
		case "mosaic": {
			// リサイズ後の位置・寸法を焼き込む。次の renderShapes で新寸法から
			// ピクセル化を再計算する。回転は無効なので rotation は据え置き。
			const img = node as Konva.Image;
			return {
				...prev,
				x: img.x(),
				y: img.y(),
				width: Math.max(1, img.width() * img.scaleX()),
				height: Math.max(1, img.height() * img.scaleY()),
			};
		}
	}
}

/**
 * 線系ノードの points に、ノードの位置オフセットとスケールを焼き込む。
 * Transformer はノードの x/y/scale を変えるので、points 座標に反映して
 * ノード自身の x/y/scale をリセットできるようにする。
 */
function scalePoints(
	points: number[],
	offsetX: number,
	offsetY: number,
	scaleX: number,
	scaleY: number,
): number[] {
	const out: number[] = [];
	for (let i = 0; i < points.length; i += 2) {
		out.push(offsetX + (points[i] ?? 0) * scaleX);
		out.push(offsetY + (points[i + 1] ?? 0) * scaleY);
	}
	return out;
}
