import type Konva from "konva";
import type { EditorDoc, Shape } from "@/lib/editor/doc";
import type { FontFamilyKey } from "@/lib/theme";
import type { Point } from "../geometry-view";

/** ツール識別子。ツールバーのボタン・ショートカットと対応する。 */
export type ToolName =
	| "select"
	| "arrow"
	| "rect"
	| "ellipse"
	| "text"
	| "pen"
	| "marker"
	| "step"
	| "callout"
	| "mosaic"
	| "crop";

/**
 * ツールが app に対して要求する操作の窓口。
 * ツールは app の内部に直接触れず、この context 経由で
 * 「今のスタイル」「プレビュー用レイヤー」「doc の確定」等にアクセスする。
 */
export interface EditorContext {
	/** ドラッグ中のプレビュー図形を載せる一時レイヤー（doc には入らない）。 */
	readonly previewLayer: Konva.Layer;
	/**
	 * 新規図形に適用する現在のスタイル。fontFamily/fontSize は新規テキストの
	 * デフォルトに使う（色・線幅と同じ扱いで、直近の選択を記憶する）。
	 */
	readonly style: {
		stroke: string;
		strokeWidth: number;
		fontFamily: FontFamilyKey;
		fontSize: number;
		/** 新規の線系図形（矢印・矩形・楕円・ペン）を破線にするか。 */
		dash: boolean;
	};
	/** ステージ（座標変換・コンテナ取得に使う）。 */
	readonly stage: Konva.Stage;
	/** 現在の描画スケール（ズーム率）。テキスト編集オーバーレイのフォント換算に使う。 */
	scale(): number;
	/** 一意な図形 id を生成する。 */
	newId(): string;
	/** ズーム/パンを考慮したドキュメント座標のポインタ位置。範囲外なら null。 */
	docPointer(): Point | null;
	/** ドキュメント座標をブラウザのクライアント座標（ページ絶対座標）へ変換する。 */
	docToClient(docPos: Point): Point;
	/** doc を差し替えて履歴に commit し、再描画・自動保存する（唯一の書き込み経路）。 */
	commitDoc(next: EditorDoc): void;
	/** 現在の doc（読み取り用）。 */
	getDoc(): EditorDoc;
	/** 図形を選択状態にする（select ツール用）。null で選択解除。 */
	select(id: string | null): void;
	/** テキスト編集オーバーレイの表示中はキーボードショートカットを抑止する。 */
	setTextEditing(editing: boolean): void;
	/** 指定 id の図形ノードの表示/非表示を切り替える（編集中は元ノードを隠す）。 */
	setNodeVisible(id: string, visible: boolean): void;
}

/**
 * ツールのライフサイクル。app がポインタイベントをこの形に正規化して渡す。
 * pointer 座標はすべてドキュメント座標系。
 */
export interface Tool {
	readonly name: ToolName;
	/** このツールに切り替わったとき。 */
	activate?(): void;
	/** 別ツールへ切り替わる直前。プレビューの後始末等。 */
	deactivate?(): void;
	onPointerDown?(pos: Point): void;
	onPointerMove?(pos: Point): void;
	onPointerUp?(pos: Point): void;
	/** 図形ノードのダブルクリック（テキスト再編集など）。 */
	onDblClick?(shape: Shape): void;
}
