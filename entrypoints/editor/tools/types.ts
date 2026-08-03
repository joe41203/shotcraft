import type Konva from "konva";
import type { ArrowStyle } from "@/lib/editor/arrow";
import type { CalloutTail } from "@/lib/editor/callout";
import type { CropRatio } from "@/lib/editor/crop";
import type { EditorDoc, MosaicBlurIntensity, Shape } from "@/lib/editor/doc";
import type { Point } from "../geometry-view";

/** ツール識別子。ツールバーのボタン・ショートカットと対応する。 */
export type ToolName =
	| "select"
	| "arrow"
	| "line"
	| "rect"
	| "ellipse"
	| "text"
	| "pen"
	| "marker"
	| "step"
	| "callout"
	| "mosaic"
	| "blur"
	| "spotlight"
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
	 * 新規図形に適用する現在のスタイル。fontSize は新規テキストのデフォルトに
	 * 使う（色・線幅と同じ扱いで、直近の選択を記憶する）。フォントは Mochiy Pop
	 * One 固定なのでスタイルには持たない。
	 */
	readonly style: {
		stroke: string;
		strokeWidth: number;
		fontSize: number;
		/** 新規の線系図形（矢印・矩形・楕円・ペン）を破線にするか。 */
		dash: boolean;
		/** 新規矢印のスタイル（片側 / 両側 / 曲線）。 */
		arrowStyle: ArrowStyle;
		/** 新規の矩形・楕円に半透明の塗りを付けるか。 */
		fill: boolean;
		/** 新規のモザイク・ぼかしの強度（弱 / 標準 / 強）。 */
		intensity: MosaicBlurIntensity;
		/** 新規 doc のスポットライト暗幕の暗さ（不透明度 0〜1）。 */
		spotlightAlpha: number;
		/** 新規フキダシのしっぽの向き（下 / 上 / 左 / 右）。 */
		calloutTail: CalloutTail;
		/** クロップ枠のアスペクト比拘束（自由 / 1:1 / 4:3 / 16:9）。 */
		cropRatio: CropRatio;
	};
	/** ステージ（座標変換・コンテナ取得に使う）。 */
	readonly stage: Konva.Stage;
	/** キャプチャ原寸（画像全体の寸法・画像座標系）。スポットライト暗幕の範囲などに使う。 */
	contentSize(): { width: number; height: number };
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
	/**
	 * 次に置くステップバッジの番号の明示上書き（フライアウトの「次を1に戻す」で設定）。
	 * 無ければ null。StepTool が resolveNextStepNumber へ渡し、1 個置いたら
	 * clearStepNumberOverride() で破棄する（以降はまた連番）。
	 */
	stepNumberOverride(): number | null;
	/** ステップ番号の明示上書きを破棄する（バッジを 1 個置いた後に呼ぶ）。 */
	clearStepNumberOverride(): void;
	/** テキスト編集オーバーレイの表示中はキーボードショートカットを抑止する。 */
	setTextEditing(editing: boolean): void;
	/** 指定 id の図形ノードの表示/非表示を切り替える（編集中は元ノードを隠す）。 */
	setNodeVisible(id: string, visible: boolean): void;
}

/**
 * ポインタ操作に付随する修飾キーの状態。app が Konva のイベントから読み取って
 * 各ツールへ渡す。矢印・直線の角度スナップ、矩形→正方形・楕円→正円の制約に使う
 * （Shift）。修飾キーを見ないツールは無視してよい。
 */
export interface PointerModifiers {
	/** Shift 押下中か（描画時の制約に使う）。 */
	shift: boolean;
	/** Alt(Option) 押下中か（選択ツールの複製ドラッグに使う）。 */
	alt: boolean;
}

/**
 * ツールのライフサイクル。app がポインタイベントをこの形に正規化して渡す。
 * pointer 座標はすべてドキュメント座標系。第 2 引数の修飾キー（Shift/Alt）は
 * 制約付き描画・複製ドラッグに使うツールだけが参照する（省略時は無し扱い）。
 */
export interface Tool {
	readonly name: ToolName;
	/** このツールに切り替わったとき。 */
	activate?(): void;
	/** 別ツールへ切り替わる直前。プレビューの後始末等。 */
	deactivate?(): void;
	onPointerDown?(pos: Point, mods: PointerModifiers): void;
	onPointerMove?(pos: Point, mods: PointerModifiers): void;
	onPointerUp?(pos: Point, mods: PointerModifiers): void;
	/** 図形ノードのダブルクリック（テキスト再編集など）。 */
	onDblClick?(shape: Shape): void;
}
