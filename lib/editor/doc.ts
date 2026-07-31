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

/** 全図形の判別可能ユニオン。type で分岐する。 */
export type Shape =
	| ArrowShape
	| RectShape
	| EllipseShape
	| TextShape
	| PenShape
	| MarkerShape;

export type ShapeType = Shape["type"];

/** エディタの編集対象ドキュメント。図形の並び順は描画順（末尾が最前面）。 */
export interface EditorDoc {
	shapes: Shape[];
}

/** 空のドキュメント。 */
export function emptyDoc(): EditorDoc {
	return { shapes: [] };
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
	Partial<Omit<MarkerShape, "id" | "type">>;

/** 図形を末尾（最前面）に追加した新しい doc を返す。 */
export function addShape(doc: EditorDoc, shape: Shape): EditorDoc {
	return { shapes: [...doc.shapes, shape] };
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
	return changed ? { shapes } : doc;
}

/** id の図形を除いた新しい doc を返す。無ければそのまま返す。 */
export function removeShape(doc: EditorDoc, id: string): EditorDoc {
	const shapes = doc.shapes.filter((shape) => shape.id !== id);
	return shapes.length === doc.shapes.length ? doc : { shapes };
}

/** id の図形を取得する。無ければ undefined。 */
export function findShape(doc: EditorDoc, id: string): Shape | undefined {
	return doc.shapes.find((shape) => shape.id === id);
}
