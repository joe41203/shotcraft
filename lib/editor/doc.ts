/**
 * エディタのドキュメントモデル。
 *
 * 図形はすべてシリアライズ可能なプレーンオブジェクトで表現し、Konva ノードは
 * この投影として描画する（描画の正は常にこの Shape 側で、Konva ノードは使い捨て）。
 * undo/redo はこの EditorDoc のスナップショット履歴で実現する（history.ts）。
 */

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
}

/** 矩形。x,y は左上、width/height は正の寸法。 */
export interface RectShape extends ShapeBase {
	type: "rect";
	x: number;
	y: number;
	width: number;
	height: number;
}

/** 楕円。x,y は外接矩形の左上、width/height は外接矩形の寸法。 */
export interface EllipseShape extends ShapeBase {
	type: "ellipse";
	x: number;
	y: number;
	width: number;
	height: number;
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
 * コールアウト（フキダシ）注釈。x,y は本体（角丸長方形）の左上、width/height は
 * 本体の寸法。下辺中央から下向きのしっぽ（三角）を固定形状で出す。
 * 塗りは color の淡い背景＋枠線＝color、テキストは視認できる濃色で本体内に折り返す。
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
	 * 後方互換のためだけに残す旧フィールド（TextShape.fontFamily と同じ扱い）。
	 * 現在はフォント固定なので値は無視する。新規保存では書かない。
	 */
	fontFamily?: string;
}

/** 全図形の判別可能ユニオン。type で分岐する。 */
export type Shape =
	| ArrowShape
	| RectShape
	| EllipseShape
	| TextShape
	| PenShape
	| MarkerShape
	| MosaicShape
	| StepShape
	| CalloutShape;

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
	Partial<Omit<RectShape, "id" | "type">> &
	Partial<Omit<EllipseShape, "id" | "type">> &
	Partial<Omit<TextShape, "id" | "type">> &
	Partial<Omit<PenShape, "id" | "type">> &
	Partial<Omit<MarkerShape, "id" | "type">> &
	Partial<Omit<MosaicShape, "id" | "type">> &
	Partial<Omit<StepShape, "id" | "type">> &
	Partial<Omit<CalloutShape, "id" | "type">>;

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
