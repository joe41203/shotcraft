import Konva from "konva";
import { curvedArrowControl, normalizeArrowStyle } from "@/lib/editor/arrow";
import { blurCornerRadius, blurRadius } from "@/lib/editor/blur";
import {
	clampEraseRect,
	eraseBlurRadius,
	fillErasedRegion,
	type RgbaImage,
} from "@/lib/editor/erase";
import {
	CALLOUT_CORNER_RADIUS,
	CALLOUT_FILL_ALPHA,
	CALLOUT_PADDING,
	calloutBodyHeight,
	calloutInnerWidth,
	calloutTailPoints,
	hexToRgba,
	normalizeCalloutTail,
} from "@/lib/editor/callout";
import { resolveDash } from "@/lib/editor/dash";
import type {
	ArrowShape,
	BlurShape,
	CalloutShape,
	EditorDoc,
	EraseShape,
	MosaicShape,
	Shape,
	SpotlightShape,
	StepShape,
} from "@/lib/editor/doc";
import { haloColor, haloStrokeWidth } from "@/lib/editor/halo";
import { mosaicPixelSize } from "@/lib/editor/mosaic";
import {
	clampSpotlightHole,
	resolveSpotlightAlpha,
	SPOTLIGHT_DIM_ALPHA,
	spotlightCornerRadius,
	spotlightFeather,
	spotlightVeilIndex,
} from "@/lib/editor/spotlight";
import { STEP_RADIUS, stepFontSize } from "@/lib/editor/step";
import { clampFontSize } from "@/lib/editor/text";
import { theme } from "@/lib/theme";

/** マーカー（蛍光ペン）の描画パラメータ。入力の太さを基準に太く半透明にする。 */
const MARKER_WIDTH_SCALE = 3;
const MARKER_OPACITY = 0.4;

/**
 * ペン・マーカーの手ブレ補正に使う Konva の tension（スプライン補間の張り）。
 * 0 は直線折れ、値を上げるほど各点を通る曲線が滑らかになる。0.4 前後で「震えを
 * ならしつつ描いた軌跡は保つ」バランスになる。間引き（thinPoints）と併用する。
 * 既存の保存図形も同じ tension で描くので、過去の線もそのまま滑らかになる（意図的な改善）。
 */
const STROKE_TENSION = 0.4;

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
 * テキストのハロー（縁取り）を Konva.Text へ渡す属性を返す。
 * stroke（縁色）は文字色の輝度から自動判定、strokeWidth（縁幅）はフォントサイズ連動。
 * fillAfterStrokeEnabled=true で fill（文字色）を stroke（縁）の後に描き、文字の外側に
 * 縁が出るようにする。テキスト注釈・フキダシ内テキストで共有する。
 */
function textHalo(
	color: string,
	fontSize: number,
): {
	stroke: string;
	strokeWidth: number;
	fillAfterStrokeEnabled: boolean;
} {
	return {
		stroke: haloColor(color),
		strokeWidth: haloStrokeWidth(fontSize),
		fillAfterStrokeEnabled: true,
	};
}

/**
 * 矢印を、スタイル（single/double/curved）に応じた Konva.Arrow として作る。
 *
 * - single（既定・省略時）: 終端のみ矢頭。
 * - double: pointerAtBeginning で始端にも矢頭を付ける。
 * - curved: 始点・制御点・終点の 3 点＋ tension で 2 次ベジェ曲線を描く。制御点は
 *   curvedArrowControl（始点終点から一意）。Konva.Arrow は points の最後の 2 点が作る
 *   接線方向へ矢頭を向けるので、制御点→終点の向き＝終端の接線に矢頭が沿う。
 * dash は 3 スタイルすべてで機能する（曲線は点間が短いので Konva が破線を沿わせる）。
 */
function buildArrowNode(
	shape: ArrowShape,
	common: { id: string; name: string; rotation: number; opacity: number },
): Konva.Arrow {
	const style = normalizeArrowStyle(shape.arrowStyle);
	const dash = resolveDash(shape.dash, shape.strokeWidth);
	const base = {
		...common,
		stroke: shape.stroke,
		fill: shape.stroke,
		strokeWidth: shape.strokeWidth,
		dash,
		lineCap: "round" as const,
		lineJoin: "round" as const,
		hitStrokeWidth: Math.max(shape.strokeWidth, 12),
		...arrowHead(shape.strokeWidth),
	};

	if (style === "curved") {
		const c = curvedArrowControl(shape.points);
		const [x1, y1, x2, y2] = shape.points;
		return new Konva.Arrow({
			...base,
			// 始点・制御点・終点。tension で 2 次ベジェ相当の滑らかな曲線にする。
			points: [x1 ?? 0, y1 ?? 0, c.x, c.y, x2 ?? 0, y2 ?? 0],
			tension: 0.5,
		});
	}

	return new Konva.Arrow({
		...base,
		points: shape.points,
		pointerAtBeginning: style === "double",
	});
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
		case "blur":
			return source
				? buildBlurNode(shape, source)
				: new Konva.Rect({
						...common,
						x: shape.x,
						y: shape.y,
						width: shape.width,
						height: shape.height,
						fill: "rgba(15, 23, 42, 0.5)",
					});
		case "erase":
			return source
				? buildEraseNode(shape, source)
				: new Konva.Rect({
						...common,
						x: shape.x,
						y: shape.y,
						width: shape.width,
						height: shape.height,
						fill: "rgba(15, 23, 42, 0.5)",
					});
		case "spotlight":
			// 通常の描画では全 spotlight をまとめて 1 枚の暗幕にするため
			// renderShapes 側で buildSpotlightVeil を使う。ここには来ない想定だが、
			// 型の網羅性と単独プレビュー用に、画像サイズ不明でも安全な穴あき暗幕相当の
			// プレースホルダ（穴の位置に薄い枠）を返す。
			return new Konva.Rect({
				...common,
				x: shape.x,
				y: shape.y,
				width: shape.width,
				height: shape.height,
				stroke: theme.ring,
				strokeWidth: 1,
				dash: [4, 4],
			});
		case "arrow":
			return buildArrowNode(shape, common);
		case "line":
			return new Konva.Line({
				...common,
				points: shape.points,
				stroke: shape.stroke,
				strokeWidth: shape.strokeWidth,
				dash: resolveDash(shape.dash, shape.strokeWidth),
				lineCap: "round",
				lineJoin: "round",
				hitStrokeWidth: Math.max(shape.strokeWidth, 12),
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
				// 塗り（省略・false は塗りなし＝枠線のみ）。true のとき stroke 色の
				// 半透明（フキダシと同じ CALLOUT_FILL_ALPHA）で内側を塗る。
				fill: shape.fill
					? hexToRgba(shape.stroke, CALLOUT_FILL_ALPHA)
					: undefined,
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
				fill: shape.fill
					? hexToRgba(shape.stroke, CALLOUT_FILL_ALPHA)
					: undefined,
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
				// 縁取り（ハロー）: どんな背景でも読めるよう文字の外側に細い縁を付ける。
				// 縁色は文字色の輝度から自動判定、縁幅はフォントサイズ連動。
				// fillAfterStrokeEnabled=true で「文字色（fill）の外側に縁（stroke）」に
				// なる（stroke を先に描くと文字が細って見えるため fill を後に重ねる）。
				...textHalo(shape.stroke, shape.fontSize),
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
				// 手ブレ補正: スプライン補間で点間を滑らかに繋ぐ（間引きと併用）。
				tension: STROKE_TENSION,
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
				// ペンと同じく手ブレ補正の tension を掛ける。
				tension: STROKE_TENSION,
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
	// 強度（弱 0.6 / 標準 1.0 / 強 1.6）を粒度へ反映する。省略時は標準。
	const pixel = mosaicPixelSize(w, h, shape.intensity);
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
 * ぼかし矩形を、ベース画像の該当領域をガウスぼかしした Konva.Image として作る。
 *
 * モザイク（buildMosaicNode）の姉妹。オフスクリーン canvas にベース画像の
 * [x,y,width,height] を ctx.filter = "blur(Npx)" を掛けて原寸で描くことでガウス
 * ぼかしを得る。半径は領域サイズから blurRadius で自動決定する。端がぼけて素の
 * 画像が透けないよう、ソース領域を半径分だけ外側へ広げて描いてから元の矩形で
 * 切り出す。仕上げにパッチを角丸矩形（blurCornerRadius・スポットライトの穴と統一感の
 * ある半径ルール）でクリップして四隅を丸める。サンプリング元はベース画像のみなので
 * 注釈にはぼかしが掛からない。エディタ表示と PNG 書き出しは同じこの関数で描く。
 */
export function buildBlurNode(
	shape: BlurShape,
	source: MosaicSource,
): Konva.Image {
	const w = Math.max(1, Math.round(shape.width));
	const h = Math.max(1, Math.round(shape.height));
	// 強度（弱 0.6 / 標準 1.0 / 強 1.6）をぼかし半径へ反映する。省略時は標準。
	const radius = blurRadius(w, h, shape.intensity);

	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const cx = canvas.getContext("2d");
	if (cx) {
		// 領域を半径分だけ外へ広げてソースを取り、canvas 原点をその分ずらして描く。
		// こうすると矩形の端でも周囲の画素を巻き込んでぼけ、境界に素の帯が残らない。
		const pad = radius;
		const sx = Math.max(0, shape.x - pad);
		const sy = Math.max(0, shape.y - pad);
		const srcW = Math.min(source.width - sx, w + pad * 2);
		const srcH = Math.min(source.height - sy, h + pad * 2);
		cx.filter = `blur(${radius}px)`;
		cx.drawImage(
			source,
			sx,
			sy,
			srcW,
			srcH,
			sx - shape.x,
			sy - shape.y,
			srcW,
			srcH,
		);

		// ぼかし済みパッチを角丸矩形でクリップする（スポットライトの穴と統一感のある
		// 半径ルール）。filter を解除してから destination-in で角丸マスクを掛け、四隅を
		// 透明にする（マスク自体はぼかさず、角の切り口をくっきり保つ）。モザイクは対象外。
		const corner = Math.min(blurCornerRadius(w, h), w / 2, h / 2);
		cx.filter = "none";
		cx.globalCompositeOperation = "destination-in";
		cx.fillStyle = "#000000";
		cx.beginPath();
		roundRectPath(cx, 0, 0, w, h, corner);
		cx.fill();
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
 * スマート消しゴム（なじませ）矩形を、周辺色で自然に塗り潰した Konva.Image として作る。
 *
 * モザイク（buildMosaicNode）・ぼかし（buildBlurNode）の姉妹だが、隠す痕跡を残さず
 * 「消す」ことが目的。手順:
 *   1) 領域を画像範囲へクランプ（clampEraseRect）。範囲外・寸法 0 なら透明ノードを返す。
 *   2) 領域の 4 辺のすぐ外側 1px も含めた「パディング付き領域」をオフスクリーン canvas へ
 *      描き、getImageData で RGBA を取り出す（fillErasedRegion の縁サンプリングに要る）。
 *   3) fillErasedRegion（純粋関数）で、領域内を「周長（4 辺の縁）全ピクセルからの逆距離重み
 *      （IDW）ブレンド」で埋めた RGBA を得て putImageData で書き戻す。縁色は 2 段の外れ値除去
 *      （近傍メディアン＋周長全体の多数派色）で前処理され、IDW のべき 3 距離減衰と合わせて、
 *      縁に写り込んだ別物体（ベル絵文字など）の色が領域へ筋にならない。画像端に接して縁が
 *      取れない辺は自動的に除外される（純粋関数側が担う）。大領域でも粗グリッド IDW＋
 *      バイリニア拡大で計算量は面積に依存しない。
 *   4) 仕上げに領域内へ弱いぼかし（eraseBlurRadius・ぼかしツールより弱い）を 1 回かけて、
 *      粗グリッド由来の微段差をならす。ぼかしが外へにじんで素の画像が透けないよう、
 *      仕上げの矩形クリップで領域外を捨てる。
 * サンプリング元はベース画像のみ（source）で、注釈図形には影響しない。エディタ表示と
 * PNG 書き出しは同じこの関数で描く。
 */
export function buildEraseNode(
	shape: EraseShape,
	source: MosaicSource,
): Konva.Image {
	const w = Math.max(1, Math.round(shape.width));
	const h = Math.max(1, Math.round(shape.height));

	// 出力パッチ（領域と同寸）。塗りに失敗しても空の透明 canvas を返して落ちない。
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const cx = canvas.getContext("2d");

	// 領域を画像範囲へクランプ。範囲外・寸法 0 なら塗るものが無いので空パッチを返す。
	const rect = clampEraseRect(
		{ x: shape.x, y: shape.y, width: shape.width, height: shape.height },
		{ width: source.width, height: source.height },
	);

	if (cx && rect) {
		// 4 辺のすぐ外側 1px を含む「パディング付き領域」を画像範囲へクランプして取り出す。
		// この 1px 帯が fillErasedRegion の縁サンプリング元になる（存在する辺の分だけ）。
		const px0 = Math.max(0, rect.x - 1);
		const py0 = Math.max(0, rect.y - 1);
		const px1 = Math.min(source.width, rect.x + rect.width + 1);
		const py1 = Math.min(source.height, rect.y + rect.height + 1);
		const pw = px1 - px0;
		const ph = py1 - py0;

		// パディング付き領域をオフスクリーン canvas へ描いて RGBA を読む。
		const pad = document.createElement("canvas");
		pad.width = pw;
		pad.height = ph;
		const pctx = pad.getContext("2d");
		if (pctx) {
			pctx.drawImage(source, px0, py0, pw, ph, 0, 0, pw, ph);
			const src = pctx.getImageData(0, 0, pw, ph);
			const rgba: RgbaImage = {
				width: pw,
				height: ph,
				data: src.data,
			};
			// パディング付き領域のローカル座標系での消す矩形（元 rect をパディング分ずらす）。
			const localRect = {
				x: rect.x - px0,
				y: rect.y - py0,
				width: rect.width,
				height: rect.height,
			};
			const filled = fillErasedRegion(rgba, localRect);

			// 塗り結果を出力パッチへ書き戻す。clampEraseRect は shape の左上と一致するとは
			// 限らない（画像端で内側へ寄る）ので、shape.x/y からのオフセットへ putImageData する。
			const patch = new ImageData(rect.width, rect.height);
			patch.data.set(filled);
			const dx = Math.round(rect.x - shape.x);
			const dy = Math.round(rect.y - shape.y);
			cx.putImageData(patch, dx, dy);

			// 補間の縞をならす弱いぼかしを 1 回。ぼかしが領域外へにじんで素の画像が
			// 透けないよう、いったん現パッチをぼかして描き直し、矩形でクリップし直す。
			const radius = eraseBlurRadius(rect.width, rect.height);
			if (radius > 0) {
				const smoothed = document.createElement("canvas");
				smoothed.width = w;
				smoothed.height = h;
				const sctx = smoothed.getContext("2d");
				if (sctx) {
					sctx.filter = `blur(${radius}px)`;
					sctx.drawImage(canvas, 0, 0);
					// ぼかし済みを元パッチへ「塗り領域だけ」戻す（領域外の透明は保つ）。
					cx.clearRect(0, 0, w, h);
					cx.filter = "none";
					cx.drawImage(smoothed, 0, 0);
				}
			}
		}
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
 * doc 内の全 spotlight をまとめた 1 枚の暗幕を単一の Konva.Shape として作る。
 *
 * 描画はオフスクリーン canvas に自前で行い、その結果を sceneFunc で 1 枚絵として
 * ステージへ転写する（エディタ表示と export の同一関数・同一手順で見た目を揃える）。
 * オフスクリーン canvas で:
 *   1) 画像全体を半透明黒（dimAlpha。省略時は SPOTLIGHT_DIM_ALPHA＝標準）で塗る。
 *      暗さは doc.spotlightAlpha（薄め 0.55 / 標準 0.7 / 濃いめ 0.85）で決まる。
 *   2) ctx.filter = blur(feather) を掛けたうえで各穴を destination-out でくり抜く。
 *      これにより穴の縁がフェザー（ぼかし）で柔らかくなり、硬い切り口にならない。
 *   3) 穴は角丸矩形（spotlightCornerRadius）でくり抜く（硬い直角より角丸のほうが
 *      プロ品質に見える）。
 * 穴矩形は画像範囲へクランプ（clampSpotlightHole）し、範囲外・寸法 0 のものは無視する。
 *
 * destination-out はオフスクリーン canvas 内で完結するので、ステージ側の背後（ベース
 * 画像・モザイク等）は消えない。Group.cache() を毎フレーム呼ぶ方式に比べ、単一 Shape の
 * sceneFunc は Konva の内部キャッシュ生成を挟まないぶんドラッグ中のプレビューが軽い。
 * 返す Shape は元の各 spotlight の id を持たないため、選択・変形は個別の透明ヒット矩形
 * （renderShapes で別途追加）が担う。
 */
export function buildSpotlightVeil(
	spotlights: SpotlightShape[],
	size: { width: number; height: number },
	dimAlpha: number = SPOTLIGHT_DIM_ALPHA,
): Konva.Shape {
	const w = Math.max(1, Math.round(size.width));
	const h = Math.max(1, Math.round(size.height));
	// 暗さは呼び出し側から渡された値（doc.spotlightAlpha）を [0,1] へ正規化して使う。
	// 未指定なら既定（標準 0.7）。
	const alpha = resolveSpotlightAlpha(dimAlpha);

	// 暗幕本体をオフスクリーン canvas に一度だけ合成しておき、sceneFunc では
	// それを転写するだけにする（ドラッグ中の再描画でも合成は 1 回で済む）。
	const veil = document.createElement("canvas");
	veil.width = w;
	veil.height = h;
	const vx = veil.getContext("2d");
	if (vx) {
		vx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
		vx.fillRect(0, 0, w, h);

		for (const s of spotlights) {
			const hole = clampSpotlightHole(
				{ x: s.x, y: s.y, width: s.width, height: s.height },
				size,
			);
			if (!hole) continue;
			const feather = spotlightFeather(hole.width, hole.height);
			// ぼかしフィルタを掛けたまま穴形を destination-out で塗ると、穴の縁が
			// feather 幅ぶん内外へなめらかに減衰する（硬い切り口にならない）。穴の
			// 芯（クランプ後の矩形／楕円の内側）は完全にくり抜かれて明るく残る。
			const r = Math.min(
				spotlightCornerRadius(hole.width, hole.height),
				hole.width / 2,
				hole.height / 2,
			);
			vx.save();
			vx.filter = `blur(${feather}px)`;
			vx.globalCompositeOperation = "destination-out";
			vx.fillStyle = "#000000";
			vx.beginPath();
			roundRectPath(vx, hole.x, hole.y, hole.width, hole.height, r);
			vx.fill();
			vx.restore();
		}
	}

	// 合成済みオフスクリーン canvas を転写するだけの Shape。sceneFunc は再描画のたびに
	// 呼ばれるが、重い合成（塗り＋フェザーくり抜き）は上で 1 回済ませてある。
	return new Konva.Shape({
		listening: false,
		x: 0,
		y: 0,
		width: w,
		height: h,
		sceneFunc: (ctx, shape) => {
			ctx.drawImage(veil, 0, 0);
			// Konva のヒット判定用フィルパスは張らない（listening:false のため）。
			ctx.fillStrokeShape(shape);
		},
	});
}

/**
 * canvas 2D コンテキストへ角丸矩形のパスを引く。ctx.roundRect が使える環境
 * （Chrome MV3）ではそれを使い、無い場合は 4 隅の円弧で手引きする（フォールバック）。
 */
function roundRectPath(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
): void {
	const r = Math.max(0, Math.min(radius, width / 2, height / 2));
	if (typeof ctx.roundRect === "function") {
		ctx.roundRect(x, y, width, height, r);
		return;
	}
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + width, y, x + width, y + height, r);
	ctx.arcTo(x + width, y + height, x, y + height, r);
	ctx.arcTo(x, y + height, x, y, r);
	ctx.arcTo(x, y, x + width, y, r);
	ctx.closePath();
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
 * calloutBodyHeight で広げる（リサイズ時のテキスト追従）。しっぽは shape.tail の
 * 向き（下 / 上 / 左 / 右。省略時は下）の辺の中央から外向きの三角で固定形状。
 * 塗りは color の淡い背景＋枠線＝color、テキストは shape.stroke（注釈色）で描き、
 * テキスト注釈と色を統一する。
 */
function buildCalloutNode(
	shape: CalloutShape,
	common: { id: string; name: string; rotation: number; opacity: number },
): Konva.Group {
	const group = new Konva.Group({ ...common, x: shape.x, y: shape.y });

	const innerWidth = calloutInnerWidth(shape.width, CALLOUT_PADDING);
	const fontFamily = theme.fontAnnotation;

	// テキストを先に組んで折返し後の高さを測り、本体高さへ反映する。
	// フキダシ内テキストにもハロー（縁取り）を付け、淡い背景でも文字が読めるようにする
	// （テキスト注釈と同じ扱い）。
	const text = new Konva.Text({
		x: CALLOUT_PADDING,
		y: CALLOUT_PADDING,
		width: innerWidth,
		text: shape.text,
		fontSize: shape.fontSize,
		fontFamily,
		fill: shape.stroke,
		lineHeight: 1.25,
		wrap: "word",
		listening: false,
		...textHalo(shape.stroke, shape.fontSize),
	});
	const bodyHeight = Math.max(
		shape.height,
		calloutBodyHeight(text.height(), shape.fontSize, CALLOUT_PADDING),
	);

	// しっぽ（本体より背面）→本体→テキストの順に重ねる。しっぽの向きは
	// shape.tail（省略時は下向き）に応じて頂点を計算する。
	group.add(
		new Konva.Line({
			points: calloutTailPoints(
				0,
				0,
				shape.width,
				bodyHeight,
				undefined,
				undefined,
				normalizeCalloutTail(shape.tail),
			),
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
	veilSize?: { width: number; height: number },
): void {
	layer.destroyChildren();

	// spotlight は全体で 1 枚の暗幕にまとめる。暗幕の挿入位置は描き順に依らず
	// spotlightVeilIndex（＝最初の注釈系図形の直下、無ければ最上位）に固定する。
	// これにより注釈（矢印・テキスト等）は常に暗幕より上＝明るいまま、注釈より前に
	// 置いた mosaic/blur は暗幕の下＝暗くなる。各 spotlight の選択・変形は透明な
	// ヒット矩形（select ツール時のみ）が個別に担う。
	const spotlights = doc.shapes.filter(
		(s): s is SpotlightShape => s.type === "spotlight",
	);
	const size =
		veilSize ??
		(source ? { width: source.width, height: source.height } : undefined);
	const veilIndex =
		spotlights.length > 0 && size ? spotlightVeilIndex(doc.shapes) : -1;
	// 暗幕の暗さは doc レベルの単一フィールド（省略時は標準 0.7）。
	const dimAlpha = resolveSpotlightAlpha(doc.spotlightAlpha);

	doc.shapes.forEach((shape, index) => {
		// 暗幕は「注釈系が始まる直前」に 1 枚だけ差し込む。veilIndex が末尾（注釈系
		// なし）のときは下のループ後に追加する。
		if (index === veilIndex && size) {
			layer.add(buildSpotlightVeil(spotlights, size, dimAlpha));
		}
		if (shape.type === "spotlight") {
			// select ツール時のみ、個別選択・変形用の透明ヒット矩形を重ねる。
			if (draggable) {
				const hit = new Konva.Rect({
					id: shape.id,
					name: "shape",
					x: shape.x,
					y: shape.y,
					width: shape.width,
					height: shape.height,
					rotation: shape.rotation,
					// ほぼ透明だがヒット判定を持たせるための塗り（見た目には出ない）。
					fill: "rgba(0, 0, 0, 0.001)",
					draggable: true,
				});
				layer.add(hit);
			}
			return;
		}
		const node = shapeToNode(shape, source);
		node.draggable(draggable);
		layer.add(node);
	});

	// 注釈系図形が無い場合（veilIndex === shapes.length）は最上位へ差し込む。
	if (veilIndex === doc.shapes.length && size) {
		layer.add(buildSpotlightVeil(spotlights, size, dimAlpha));
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
			const scaled = scalePoints(
				line.points(),
				line.x(),
				line.y(),
				line.scaleX(),
				line.scaleY(),
			);
			// curved 矢印のノードは [始点, 制御点, 終点] の 3 点を持つが、doc の
			// ArrowShape.points は常に [x1,y1,x2,y2]（始点・終点）だけ。制御点は
			// 始点終点から再計算するので、変形後は端の 2 点だけを焼き込む。
			const points =
				scaled.length >= 6
					? [scaled[0] ?? 0, scaled[1] ?? 0, scaled[4] ?? 0, scaled[5] ?? 0]
					: scaled;
			return {
				...prev,
				points,
				rotation: line.rotation(),
			};
		}
		case "line":
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
		case "mosaic":
		case "blur":
		case "erase":
		case "spotlight": {
			// リサイズ後の位置・寸法を焼き込む。次の renderShapes で新寸法から
			// モザイクのピクセル化・ぼかし半径・なじませ塗り・暗幕の穴を再計算する。
			// 回転は無効なので rotation は据え置き。spotlight は透明なヒット矩形、
			// mosaic/blur/erase は Konva.Image だが、いずれも x/y/width/height/scale の
			// 取り方は共通。
			const rect = node as Konva.Rect;
			return {
				...prev,
				x: rect.x(),
				y: rect.y(),
				width: Math.max(1, rect.width() * rect.scaleX()),
				height: Math.max(1, rect.height() * rect.scaleY()),
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
