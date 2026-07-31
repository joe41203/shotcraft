import Konva from "konva";
import {
	CALLOUT_CORNER_RADIUS,
	CALLOUT_FILL_ALPHA,
	CALLOUT_PADDING,
	calloutBodyHeight,
	calloutInnerWidth,
	calloutTailPoints,
	hexToRgba,
} from "@/lib/editor/callout";
import type {
	CalloutShape,
	EditorDoc,
	MosaicShape,
	Shape,
	StepShape,
} from "@/lib/editor/doc";
import { resolveDash } from "@/lib/editor/dash";
import { mosaicPixelSize } from "@/lib/editor/mosaic";
import { STEP_RADIUS, stepFontSize } from "@/lib/editor/step";
import { clampFontSize } from "@/lib/editor/text";
import { theme } from "@/lib/theme";

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
export function shapeToNode(
	shape: Shape,
	source?: MosaicSource,
): Konva.Shape | Konva.Group {
	const common = {
		id: shape.id,
		name: "shape",
		rotation: shape.rotation,
		opacity: shape.opacity,
	};

	switch (shape.type) {
		case "step":
			return buildStepNode(shape, common);
		case "callout":
			return buildCalloutNode(shape, common);
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
				dash: resolveDash(shape.dash, shape.strokeWidth),
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
				dash: resolveDash(shape.dash, shape.strokeWidth),
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
				dash: resolveDash(shape.dash, shape.strokeWidth),
			});
		case "text":
			return new Konva.Text({
				...common,
				x: shape.x,
				y: shape.y,
				text: shape.text,
				fontSize: shape.fontSize,
				fill: shape.stroke,
				// テキスト注釈は Mochiy Pop One 固定。text-overlay（textarea）と同じ
				// stack を使い、編集中と確定後の見た目を一致させる。旧データに
				// fontFamily key が残っていても無視して固定スタックで描く。canvas 描画
				// なので、フォント読み込み完了前に描くとフォールバックされる。エディタ
				// 初期化時に main.ts で document.fonts.load() を await してから描画に入る。
				fontFamily: theme.fontAnnotation,
				lineHeight: 1.2,
			});
		case "pen":
			return new Konva.Line({
				...common,
				points: shape.points,
				stroke: shape.stroke,
				strokeWidth: shape.strokeWidth,
				dash: resolveDash(shape.dash, shape.strokeWidth),
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
 * ステップバッジ（塗り円 + 中央の白抜き数字）を Konva.Group として作る。
 *
 * Group の x/y はバッジ中心。円とテキストは Group ローカル座標で中心 (0,0) に
 * 配置し、Group ごと移動・削除する。数字は白・太字で、円は shape.stroke（現在の
 * 注釈色）で塗る。半径は shape.radius（省略時 STEP_RADIUS）。
 * テキストは幅・高さを直径に合わせ align/verticalAlign で中央寄せする。
 */
function buildStepNode(
	shape: StepShape,
	common: { id: string; name: string; rotation: number; opacity: number },
): Konva.Group {
	const radius = shape.radius ?? STEP_RADIUS;
	const group = new Konva.Group({ ...common, x: shape.x, y: shape.y });

	group.add(
		new Konva.Circle({
			x: 0,
			y: 0,
			radius,
			fill: shape.stroke,
			listening: true,
		}),
	);

	const fontSize = stepFontSize(radius);
	group.add(
		new Konva.Text({
			x: -radius,
			y: -radius,
			width: radius * 2,
			height: radius * 2,
			text: String(shape.number),
			fontSize,
			fontStyle: "bold",
			fill: "#ffffff",
			align: "center",
			verticalAlign: "middle",
			listening: false,
		}),
	);

	return group;
}

/**
 * コールアウト（フキダシ）を Konva.Group（しっぽ + 本体 + テキスト）として作る。
 *
 * Group の x/y は本体左上。内部はローカル座標で組み、Group ごと移動する。
 * 本体高さは shape.height を下限に、折り返したテキストが収まるよう
 * calloutBodyHeight で広げる（リサイズ時のテキスト追従）。しっぽは本体下辺
 * 中央から下向きの三角で固定形状。塗りは color の淡い背景＋枠線＝color、
 * テキストは視認できる濃色（#0b0f19）にする。
 */
function buildCalloutNode(
	shape: CalloutShape,
	common: { id: string; name: string; rotation: number; opacity: number },
): Konva.Group {
	const group = new Konva.Group({ ...common, x: shape.x, y: shape.y });

	const innerWidth = calloutInnerWidth(shape.width, CALLOUT_PADDING);
	const fontFamily = theme.fontAnnotation;

	// テキストを先に組んで折返し後の高さを測り、本体高さへ反映する。
	const text = new Konva.Text({
		x: CALLOUT_PADDING,
		y: CALLOUT_PADDING,
		width: innerWidth,
		text: shape.text,
		fontSize: shape.fontSize,
		fontFamily,
		fill: "#0b0f19",
		lineHeight: 1.25,
		wrap: "word",
		listening: false,
	});
	const bodyHeight = Math.max(
		shape.height,
		calloutBodyHeight(text.height(), shape.fontSize, CALLOUT_PADDING),
	);

	// しっぽ（本体より背面）→本体→テキストの順に重ねる。
	group.add(
		new Konva.Line({
			points: calloutTailPoints(0, 0, shape.width, bodyHeight),
			closed: true,
			fill: hexToRgba(shape.stroke, CALLOUT_FILL_ALPHA),
			stroke: shape.stroke,
			strokeWidth: shape.strokeWidth,
			lineJoin: "round",
			listening: true,
		}),
	);
	group.add(
		new Konva.Rect({
			x: 0,
			y: 0,
			width: shape.width,
			height: bodyHeight,
			cornerRadius: CALLOUT_CORNER_RADIUS,
			fill: hexToRgba(shape.stroke, CALLOUT_FILL_ALPHA),
			stroke: shape.stroke,
			strokeWidth: shape.strokeWidth,
			listening: true,
		}),
	);
	group.add(text);

	return group;
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
		case "step": {
			// バッジは移動のみ（Group の x/y はバッジ中心）。半径・番号は据え置き、
			// リサイズ・回転は無効なので scale/rotation は焼き込まない。
			return {
				...prev,
				x: node.x(),
				y: node.y(),
			};
		}
		case "callout": {
			// Group の移動・リサイズを焼き込む。Transformer の scale は width/height へ
			// 反映し、fontSize は据え置く（次の renderShapes でテキストが新幅へ折り返す）。
			// scale をリセットしたいので width/height に掛けた値を保存する。
			return {
				...prev,
				x: node.x(),
				y: node.y(),
				width: Math.max(1, prev.width * node.scaleX()),
				height: Math.max(1, prev.height * node.scaleY()),
				rotation: node.rotation(),
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
