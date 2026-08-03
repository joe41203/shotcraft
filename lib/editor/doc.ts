/**
 * エディタのドキュメントモデル。
 *
 * 図形はすべてシリアライズ可能なプレーンオブジェクトで表現し、Konva ノードは
 * この投影として描画する（描画の正は常にこの Shape 側で、Konva ノードは使い捨て）。
 * undo/redo はこの EditorDoc のスナップショット履歴で実現する（history.ts）。
 */

/**
 * モザイク・ぼかしの強度。弱 / 標準 / 強の 3 段階。自動決定した粒度・半径への
 * 倍率で表現する（mosaic.ts / blur.ts の intensityScale）。省略時（未設定の旧データ）は
 * "normal" 扱い（後方互換）。
 */
export type MosaicBlurIntensity = "weak" | "normal" | "strong";

/** 図形の色・太さ・回転など、種類によらず共通のスタイル。 */
export interface ShapeBase {
	id: string;
	/** 線・輪郭の色（CSS カラー）。 */
	stroke: string;
	strokeWidth: number;
	/** 度数法の回転角。Transformer による回転を焼き込む。 */
	rotation: number;
	/** 0〜1。マーカーの半透明表現などに使う。 */
	opacity: number;
	/**
	 * 線種を破線にするか。線・輪郭を持つ図形（矢印・矩形・楕円・ペン・マーカー）
	 * でのみ意味を持ち、render.ts が Konva の dash プロパティへ解決する。
	 * 省略・false は実線（レガシー doc 互換）。
	 */
	dash?: boolean;
}

/** 矢印。points は始点・終点の [x1, y1, x2, y2]。 */
export interface ArrowShape extends ShapeBase {
	type: "arrow";
	points: number[];
	/**
	 * 矢印のスタイル。省略時は "single"（終端のみ矢頭）＝後方互換の既定。
	 * - "single": 終端のみ矢頭。
	 * - "double": 始端・終端の両方に矢頭（pointerAtBeginning）。
	 * - "curved": 始点終点を 2 次ベジェで結んだ曲線。矢頭は終端のみ。
	 * 曲線の制御点は始点終点から一意に決まる（curvedArrowControl。制御点 UI は無い）。
	 */
	arrowStyle?: "single" | "double" | "curved";
}

/** 直線（矢頭なし）。points は始点・終点の [x1, y1, x2, y2]。 */
export interface LineShape extends ShapeBase {
	type: "line";
	points: number[];
}

/** 矩形。x,y は左上、width/height は正の寸法。 */
export interface RectShape extends ShapeBase {
	type: "rect";
	x: number;
	y: number;
	width: number;
	height: number;
	/**
	 * 塗り（半透明の内側塗り）を付けるか。省略・false は塗りなし（枠線のみ＝レガシー
	 * doc 互換）。true のとき stroke 色の alpha 0.15（フキダシと同じ CALLOUT_FILL_ALPHA）で
	 * 内側を塗る。render.ts が Konva の fill プロパティへ解決する。
	 */
	fill?: boolean;
}

/** 楕円。x,y は外接矩形の左上、width/height は外接矩形の寸法。 */
export interface EllipseShape extends ShapeBase {
	type: "ellipse";
	x: number;
	y: number;
	width: number;
	height: number;
	/**
	 * 塗り（半透明の内側塗り）を付けるか。矩形（RectShape.fill）と同じ扱い。
	 * 省略・false は塗りなし（後方互換）、true は stroke 色の alpha 0.15 で内側を塗る。
	 */
	fill?: boolean;
}

/** テキスト。x,y は左上。 */
export interface TextShape extends ShapeBase {
	type: "text";
	x: number;
	y: number;
	text: string;
	fontSize: number;
	/**
	 * 後方互換のためだけに残す旧フィールド。かつてフォント選択機能があった頃に
	 * 保存された注釈に key（"mochiy" 等）が残っていても型エラーにせず読み込むための
	 * 受け皿。現在はフォント固定（Mochiy Pop One）なので値は無視して描画する
	 * （render.ts / text.ts / callout.ts は theme.fontAnnotation を使う）。
	 * 新規保存ではこのフィールドは書かない。
	 */
	fontFamily?: string;
}

/** フリーハンドのペン。points は [x0, y0, x1, y1, ...] の連続点。 */
export interface PenShape extends ShapeBase {
	type: "pen";
	points: number[];
}

/** 蛍光マーカー。入力はペンと同じだが太く半透明に描く。 */
export interface MarkerShape extends ShapeBase {
	type: "marker";
	points: number[];
}

/**
 * モザイク（ピクセル化）矩形。x,y は左上、width/height は正の寸法（画像座標系）。
 * ベース画像の該当領域を縮小→拡大でピクセル化して重ねる。ピクセルの粗さは
 * 領域サイズから自動決定するので、stroke 等のスタイル属性は持たない。
 * モザイクはベース画像のみをサンプリング元にする（注釈図形には掛からない）。
 */
export interface MosaicShape extends ShapeBase {
	type: "mosaic";
	x: number;
	y: number;
	width: number;
	height: number;
	/**
	 * ピクセルの粗さ（強度）。省略時は "normal"（後方互換）。自動決定した blockSize に
	 * 倍率（弱=0.6 / 標準=1.0 / 強=1.6）を掛けてから上下限クランプする（mosaic.ts）。
	 * 強いほどブロックが大きく粗く伏せられる。
	 */
	intensity?: MosaicBlurIntensity;
}

/**
 * ぼかし（ガウスぼかし）矩形。x,y は左上、width/height は正の寸法（画像座標系）。
 * モザイクの姉妹で、ベース画像の該当領域をガウスぼかしにして重ねる。ぼかしの強さ
 * （半径）は領域サイズから自動決定するので、stroke 等のスタイル属性は持たない。
 * ぼかしもベース画像のみをサンプリング元にする（注釈図形には掛からない）。
 * モザイクと同じ扱いで回転不可。
 */
export interface BlurShape extends ShapeBase {
	type: "blur";
	x: number;
	y: number;
	width: number;
	height: number;
	/**
	 * ぼかしの強さ（強度）。モザイク（MosaicShape.intensity）と同じ扱い。省略時は
	 * "normal"（後方互換）。自動決定した blurRadius に倍率（弱=0.6 / 標準=1.0 / 強=1.6）を
	 * 掛けてから上下限クランプする（blur.ts）。
	 */
	intensity?: MosaicBlurIntensity;
}

/**
 * スポットライト（暗幕）矩形。x,y は左上、width/height は正の寸法（画像座標系）。
 * doc 内の全 spotlight をまとめて 1 枚の暗幕として描き、各矩形の位置に角丸の穴を開けて
 * その領域だけを明るく残す（視線誘導）。穴の縁はフェザー（ぼかし）で柔らかくする。
 * 暗幕の色・不透明度は spotlight.ts の定数で決まるので stroke 等のスタイル属性は
 * 持たない。モザイク同様に回転不可。
 */
export interface SpotlightShape extends ShapeBase {
	type: "spotlight";
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * 番号付きステップバッジ。手順を示す丸バッジ（①②③…）を連番で置く。
 * x,y はバッジ中心。number は配置時点の連番（nextStepNumber で決める）。
 * 円は stroke 色で塗り、中央に白抜きの数字を描く。半径は省略時に既定を使う。
 * 削除しても他バッジの番号は振り直さない（安定性優先）。
 */
export interface StepShape extends ShapeBase {
	type: "step";
	x: number;
	y: number;
	number: number;
	/** バッジ半径（px）。省略時は既定値。 */
	radius?: number;
}

/**
 * フキダシのしっぽ（三角）を出す辺の向き。省略時は "down"（下辺中央から下向き）＝
 * 後方互換の既定。up=上辺中央から上向き / left=左辺中央から左向き /
 * right=右辺中央から右向き。しっぽ長さ・幅は向きに依らず共通（callout.ts）。
 */
export type CalloutTail = "down" | "up" | "left" | "right";

/**
 * コールアウト（フキダシ）注釈。x,y は本体（角丸長方形）の左上、width/height は
 * 本体の寸法。しっぽ（三角）は tail の向きの辺の中央から外向きに固定形状で出す
 * （省略時は下辺中央から下向き）。
 * 塗りは stroke 色の淡い背景＋枠線＝stroke 色、テキストも stroke 色で本体内に
 * 折り返す（テキスト注釈と色を統一）。
 * text はテキスト注釈のオーバーレイ機構で編集する。
 */
export interface CalloutShape extends ShapeBase {
	type: "callout";
	x: number;
	y: number;
	width: number;
	height: number;
	text: string;
	fontSize: number;
	/**
	 * しっぽの向き（下 / 上 / 左 / 右）。省略時は "down"（後方互換）。
	 * render.ts が calloutTailPoints へ渡して三角の頂点を向きに応じて計算する。
	 */
	tail?: CalloutTail;
	/**
	 * 後方互換のためだけに残す旧フィールド（TextShape.fontFamily と同じ扱い）。
	 * 現在はフォント固定なので値は無視する。新規保存では書かない。
	 */
	fontFamily?: string;
}

/**
 * バグ報告ラベル。角丸の塗りつぶしプレート＋内側に折り返したテキストを描く。
 * 見た目・寸法計算はフキダシ（CalloutShape）の本体を流用する（しっぽは無い）。
 * プレートは stroke 色の不透明塗り、文字色は haloColor(stroke) で白/ダーク自動判定。
 * x,y は左上、width/height はプレートの寸法（テキスト折返しで height は追従する）。
 * 「バグ報告」ボタンからのみ生成し、描画ツールとしては持たない（ツールバー非表示）。
 * text はテキスト注釈のオーバーレイ機構で再編集する。type 追加のみで後方互換。
 */
export interface LabelShape extends ShapeBase {
	type: "label";
	x: number;
	y: number;
	width: number;
	height: number;
	text: string;
	fontSize: number;
}

/** 全図形の判別可能ユニオン。type で分岐する。 */
export type Shape =
	| ArrowShape
	| LineShape
	| RectShape
	| EllipseShape
	| TextShape
	| PenShape
	| MarkerShape
	| MosaicShape
	| BlurShape
	| SpotlightShape
	| StepShape
	| CalloutShape
	| LabelShape;

export type ShapeType = Shape["type"];

/** クロップ矩形。常に元画像座標系で保持する（表示ズームや過去のクロップに依らない）。 */
export interface CropRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * エディタの編集対象ドキュメント。図形の並び順は描画順（末尾が最前面）。
 * crop はトップレベルの単一フィールド（シェイプ配列とは別）。null はクロップ無し
 * （＝画像全体）。値は常に元画像座標系で、再クロップ時も入れ子にせず 1 個の矩形へ
 * 合成する（cropWithin 参照）。
 */
export interface EditorDoc {
	shapes: Shape[];
	crop: CropRect | null;
	/**
	 * スポットライト暗幕の暗さ（不透明度 0〜1）。doc 内の全 spotlight は 1 枚の暗幕に
	 * まとまるため、暗さも図形ごとでなく doc レベルの単一フィールドで持つ。省略時は
	 * SPOTLIGHT_DIM_ALPHA（0.7）＝標準（後方互換。旧 doc は未設定でも 0.7 で描く）。
	 * 薄め=0.55 / 標準=0.7 / 濃いめ=0.85（spotlight.ts の SPOTLIGHT_DIM_OPTIONS）。
	 */
	spotlightAlpha?: number;
}

/** 空のドキュメント。 */
export function emptyDoc(): EditorDoc {
	return { shapes: [], crop: null };
}

/**
 * updateShape で渡せる更新パッチ。全バリアントの更新可能なプロパティを
 * 任意指定できる（id/type は変更不可なので含めない）。実際に反映されるのは
 * 対象図形の type が持つプロパティだけで、余分なキーは無害にマージされる。
 */
export type ShapePatch = Partial<Omit<ArrowShape, "id" | "type">> &
	Partial<Omit<LineShape, "id" | "type">> &
	Partial<Omit<RectShape, "id" | "type">> &
	Partial<Omit<EllipseShape, "id" | "type">> &
	Partial<Omit<TextShape, "id" | "type">> &
	Partial<Omit<PenShape, "id" | "type">> &
	Partial<Omit<MarkerShape, "id" | "type">> &
	Partial<Omit<MosaicShape, "id" | "type">> &
	Partial<Omit<BlurShape, "id" | "type">> &
	Partial<Omit<SpotlightShape, "id" | "type">> &
	Partial<Omit<StepShape, "id" | "type">> &
	Partial<Omit<CalloutShape, "id" | "type">> &
	Partial<Omit<LabelShape, "id" | "type">>;

/**
 * 次に配置するステップバッジの番号を返す純粋関数。
 * 「既存の step シェイプの最大 number + 1」を採る。step が 1 つも無ければ 1。
 * 削除で番号が飛んでいても最大値基準なので既存バッジと重複しない
 * （振り直しはしない＝安定性優先）。
 */
export function nextStepNumber(shapes: Shape[]): number {
	let max = 0;
	for (const shape of shapes) {
		if (shape.type === "step" && shape.number > max) {
			max = shape.number;
		}
	}
	return max + 1;
}

/**
 * 図形 type が「色（stroke）を持つ」か。色スウォッチの選択を選択中の図形へ即適用
 * できるかの判定に使う。矢印・直線・矩形・楕円・ペン・マーカー・テキスト・ステップ・
 * フキダシは stroke が色の正。モザイク・ぼかし・スポットライトは色を持たない
 * （stroke フィールドは ShapeBase 上にあるが描画に使わない）ので false。
 */
export function shapeSupportsColor(type: ShapeType): boolean {
	return type !== "mosaic" && type !== "blur" && type !== "spotlight";
}

/** 図形を末尾（最前面）に追加した新しい doc を返す。 */
export function addShape(doc: EditorDoc, shape: Shape): EditorDoc {
	return { ...doc, shapes: [...doc.shapes, shape] };
}

/**
 * id の図形を patch でマージ更新した新しい doc を返す。
 * type は変えられない（patch から除外して同一 type を保つ）。
 * 対象 id が無ければ doc をそのまま返す。
 */
export function updateShape(
	doc: EditorDoc,
	id: string,
	patch: ShapePatch,
): EditorDoc {
	let changed = false;
	const shapes = doc.shapes.map((shape) => {
		if (shape.id !== id) return shape;
		changed = true;
		return { ...shape, ...patch } as Shape;
	});
	return changed ? { ...doc, shapes } : doc;
}

/**
 * id の図形を shape で丸ごと置き換えた新しい doc を返す。
 * Transformer による変形結果（shapeFromNode の戻り値）を焼き込む用途。
 * 対象 id が無ければ doc をそのまま返す。
 */
export function replaceShape(
	doc: EditorDoc,
	id: string,
	shape: Shape,
): EditorDoc {
	let changed = false;
	const shapes = doc.shapes.map((s) => {
		if (s.id !== id) return s;
		changed = true;
		return shape;
	});
	return changed ? { ...doc, shapes } : doc;
}

/** id の図形を除いた新しい doc を返す。無ければそのまま返す。 */
export function removeShape(doc: EditorDoc, id: string): EditorDoc {
	const shapes = doc.shapes.filter((shape) => shape.id !== id);
	return shapes.length === doc.shapes.length ? doc : { ...doc, shapes };
}

/** id の図形を取得する。無ければ undefined。 */
export function findShape(doc: EditorDoc, id: string): Shape | undefined {
	return doc.shapes.find((shape) => shape.id === id);
}

/** クロップ矩形を差し替えた新しい doc を返す（null でクロップ解除）。 */
export function setCrop(doc: EditorDoc, crop: CropRect | null): EditorDoc {
	return { ...doc, crop };
}

/**
 * shapes 配列の from 番目を to 番目へ移し替えた新しい配列を返す純粋関数。
 * z 順変更（moveShapeForward/Backward/ToFront/ToBack）の共通土台。
 */
function moveInArray<T>(items: T[], from: number, to: number): T[] {
	const next = [...items];
	const [moved] = next.splice(from, 1);
	if (moved === undefined) return items;
	next.splice(to, 0, moved);
	return next;
}

/**
 * id の図形を 1 つ前面（配列の末尾方向へ 1 つ）へ移動した新しい doc を返す。
 * 既に最前面（末尾）または対象が無ければ同一参照の doc をそのまま返す。
 * 描画順は「配列末尾が最前面」なので、前面 = インデックスを +1 する。
 * スポットライトの暗幕位置は spotlightVeilIndex が type ベースで再計算するので、
 * ここで配列を並べ替えても暗幕は常に「最初の注釈系の直下」に保たれ整合する。
 */
export function moveShapeForward(doc: EditorDoc, id: string): EditorDoc {
	const index = doc.shapes.findIndex((s) => s.id === id);
	if (index < 0 || index === doc.shapes.length - 1) return doc;
	return { ...doc, shapes: moveInArray(doc.shapes, index, index + 1) };
}

/**
 * id の図形を 1 つ背面（配列の先頭方向へ 1 つ）へ移動した新しい doc を返す。
 * 既に最背面（先頭）または対象が無ければ同一参照の doc をそのまま返す。
 */
export function moveShapeBackward(doc: EditorDoc, id: string): EditorDoc {
	const index = doc.shapes.findIndex((s) => s.id === id);
	if (index <= 0) return doc;
	return { ...doc, shapes: moveInArray(doc.shapes, index, index - 1) };
}

/**
 * id の図形を最前面（配列末尾）へ移動した新しい doc を返す。
 * 既に最前面または対象が無ければ同一参照の doc をそのまま返す。
 */
export function moveShapeToFront(doc: EditorDoc, id: string): EditorDoc {
	const index = doc.shapes.findIndex((s) => s.id === id);
	if (index < 0 || index === doc.shapes.length - 1) return doc;
	return {
		...doc,
		shapes: moveInArray(doc.shapes, index, doc.shapes.length - 1),
	};
}

/**
 * id の図形を最背面（配列先頭）へ移動した新しい doc を返す。
 * 既に最背面または対象が無ければ同一参照の doc をそのまま返す。
 */
export function moveShapeToBack(doc: EditorDoc, id: string): EditorDoc {
	const index = doc.shapes.findIndex((s) => s.id === id);
	if (index <= 0) return doc;
	return { ...doc, shapes: moveInArray(doc.shapes, index, 0) };
}

/** 複製時の既定オフセット（px）。元図形と重ならないよう右下へずらす。 */
export const DUPLICATE_OFFSET = 16;

/**
 * 図形を (dx, dy) だけ平行移動した図形を返す純粋関数。
 * 位置の持ち方が type ごとに違う（x/y を持つもの・points 列を持つもの）ので
 * type で分岐して該当フィールドをずらす。複製・nudge の両方から使う。
 */
export function translateShape(shape: Shape, dx: number, dy: number): Shape {
	switch (shape.type) {
		case "arrow":
		case "line":
		case "pen":
		case "marker": {
			const points = shape.points.map((v, i) => v + (i % 2 === 0 ? dx : dy));
			return { ...shape, points };
		}
		default:
			return { ...shape, x: shape.x + dx, y: shape.y + dy };
	}
}

/**
 * 図形を複製するための新しい図形を作る純粋関数。
 * - id は newId で新規採番する。
 * - 位置は (dx, dy) だけずらす（既定は右下へ DUPLICATE_OFFSET）。
 * - step バッジは番号が重複しないよう、複製後の並びで nextStepNumber を採り直す
 *   （baseShapes に元図形を含めて渡し「次の連番」を割り当てる）。
 * - text/callout は文言（text フィールド）ごとそのまま複製する。
 * baseShapes には「複製を追加する前の doc.shapes」を渡す。
 */
export function duplicateShape(
	shape: Shape,
	newId: string,
	baseShapes: Shape[],
	dx: number = DUPLICATE_OFFSET,
	dy: number = DUPLICATE_OFFSET,
): Shape {
	const moved = translateShape({ ...shape, id: newId }, dx, dy);
	if (moved.type === "step") {
		// 同番号の重複を避け、既存 step の最大 +1 を採る（安定した自動採番）。
		return { ...moved, number: nextStepNumber(baseShapes) };
	}
	return moved;
}
