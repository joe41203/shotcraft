import Konva from "konva";
import type { CaptureRecord } from "@/lib/capture-store";
import { type ArrowStyle, normalizeArrowStyle } from "@/lib/editor/arrow";
import { type CalloutTail, normalizeCalloutTails } from "@/lib/editor/callout";
import { type CropRatio, croppedSize } from "@/lib/editor/crop";
import { shapeSupportsDash } from "@/lib/editor/dash";
import {
	addShape,
	assignGroup,
	type CropRect,
	duplicateShape,
	type EditorDoc,
	emptyDoc,
	findShape,
	type MosaicBlurIntensity,
	moveShapeBackward,
	moveShapeForward,
	moveShapeToBack,
	moveShapeToFront,
	remapDuplicatedGroups,
	removeShape,
	replaceShape,
	type Shape,
	shapeSupportsColor,
	translateShape,
	ungroup,
	updateShape,
} from "@/lib/editor/doc";
import type { ExportFormat, ExportQuality } from "@/lib/editor/export-format";
import {
	canRedo,
	canUndo,
	commit,
	type History,
	initHistory,
	redo,
	undo,
} from "@/lib/editor/history";
import {
	type BBox,
	expandSelectionToGroups,
	shapeBoundingBox,
	shapesInBand,
} from "@/lib/editor/selection";
import { computeSnap, type SnapGuide } from "@/lib/editor/snap";
import { resolveSpotlightAlpha } from "@/lib/editor/spotlight";
import {
	createStylePrefsSaver,
	DEFAULT_STYLE_PREFS,
	type StylePrefs,
} from "@/lib/editor/style-prefs";
import {
	type StyleSections,
	styleAnchorToolFor,
	styleSectionsFor,
} from "@/lib/editor/style-sections";
import { clampFontSize } from "@/lib/editor/text";
import { CropController } from "./crop-controller";
import {
	canvasToBlob,
	canvasToPngBlob,
	downloadBlob,
	exportFilename,
	exportToCanvas,
} from "./export";
import {
	fitTransform,
	type Point,
	type ViewTransform,
	zoomAtTransform,
} from "./geometry-view";
import { renderShapes, shapeFromNode } from "./render";
import { Toast } from "./toast";
import { Toolbar } from "./toolbar";
import type {
	EditorContext,
	PointerModifiers,
	Tool,
	ToolName,
} from "./tools/types";

/** Konva のポインタイベントから修飾キー（Shift/Alt）の状態を取り出す。 */
function modifiers(e: Konva.KonvaEventObject<PointerEvent>): PointerModifiers {
	return { shift: e.evt.shiftKey, alt: e.evt.altKey };
}

/**
 * 矢印キーの連続 nudge を 1 つの履歴にまとめるデバウンス時間（ms）。
 * この時間だけ追加の nudge が無ければ、それまでの移動をまとめて 1 回 commit する。
 */
const NUDGE_COMMIT_MS = 500;

/**
 * 整列スナップの吸着しきい値（画面 px）。ドラッグ中の図形の端が他図形の端に
 * この距離まで近づいたら吸着する。ドキュメント座標へはズーム率で割って換算し
 * （SNAP_THRESHOLD_PX / scale）、画面上で一定の吸着感になるようにする。
 */
const SNAP_THRESHOLD_PX = 6;

/** 整列スナップのガイド線の色（tokens の danger 系。赤の細線）。 */
const SNAP_GUIDE_COLOR = "#ef4444";

/** Transformer の全 8 アンカー（辺 4 + 四隅 4）。テキスト以外の既定。 */
const ALL_ANCHORS = [
	"top-left",
	"top-center",
	"top-right",
	"middle-left",
	"middle-right",
	"bottom-left",
	"bottom-center",
	"bottom-right",
];

/** テキスト用の四隅アンカーのみ（縦横比固定の比例スケールでフォントサイズを変える）。 */
const TEXT_CORNER_ANCHORS = [
	"top-left",
	"top-right",
	"bottom-left",
	"bottom-right",
];

/** キャプチャ画像とドキュメントを載せる Konva エディタ本体。 */
export class EditorApp {
	readonly stage: Konva.Stage;
	private bgLayer: Konva.Layer;
	private shapeLayer: Konva.Layer;
	readonly previewLayer: Konva.Layer;
	/** Transformer など操作用 UI を載せるレイヤー（shapeLayer 再構築の影響を受けない）。 */
	private uiLayer: Konva.Layer;
	private transformer: Konva.Transformer;
	private image: Konva.Image;
	/** モザイクのサンプリング元（キャプチャ原寸のベース画像）。 */
	private baseImage: HTMLImageElement;
	private contentSize: { width: number; height: number };
	/** クロップ操作の UI とライフサイクルを持つコントローラ。 */
	private crop: CropController;
	/** 操作成功を知らせる軽量トースト。 */
	private toast: Toast;

	private history: History<EditorDoc>;
	private currentTool: ToolName = "select";
	private tools = new Map<ToolName, Tool>();
	/**
	 * 選択中の図形 id 群（描画順。複数選択対応の正）。単一選択は要素数 1、未選択は空配列
	 * として扱う。既存の select(id) API・selectedId ゲッタは、この配列の先頭を単一選択
	 * として見せることで後方互換を保つ。
	 */
	private selectedIds: string[] = [];
	/**
	 * 矢印キーによる連続 nudge をまとめて 1 commit にするためのデバウンス状態。
	 * nudgeTimer は満了で flushNudge を呼ぶタイマー、nudgeBaseDoc はバースト開始前の
	 * doc（確定時にここへ戻してから移動後を 1 回 commit する）。バースト外は両方 null。
	 */
	private nudgeTimer: number | null = null;
	private nudgeBaseDoc: EditorDoc | null = null;
	/** Alt(Option)+ドラッグ中フラグ。true の間の dragend は元を残して複製を追加する。 */
	private altDragging = false;
	/**
	 * ラバーバンド（範囲選択矩形）の状態。select ツールで空き領域から始めたドラッグの間、
	 * start に開始点（doc 座標）・rect に描画中の矩形ノードを持つ。additive は Shift 併用
	 * （既存選択へ追加/除外する）か。ドラッグ外は start/rect とも null。
	 */
	private band: {
		start: Point;
		rect: Konva.Rect;
		additive: boolean;
	} | null = null;
	/**
	 * 新規図形に適用する現在のスタイル。fontSize は新規テキストのデフォルト。
	 * 作成後のサイズ変更は選択して四隅ハンドルをドラッグする（fontSize=24 は
	 * 従来と同じ既定値で、既存保存データの互換を壊さない）。フォントは
	 * Mochiy Pop One 固定なのでスタイルには持たない。線の太さは 4px 固定で、
	 * 選択 UI は持たない（既存保存データが 2/8 を持っていてもその図形は
	 * 保存値のまま描画され、新規図形だけが 4px になる）。
	 */
	style = {
		stroke: DEFAULT_STYLE_PREFS.stroke,
		strokeWidth: 4,
		fontSize: DEFAULT_STYLE_PREFS.fontSize,
		/** 新規の線系図形（矢印・矩形・楕円・ペン）を破線にするか。既定は実線。 */
		dash: DEFAULT_STYLE_PREFS.dash,
		/** 新規矢印のスタイル（片側 / 両側 / 曲線）。既定は片側。 */
		arrowStyle: DEFAULT_STYLE_PREFS.arrowStyle,
		/** 新規の矩形・楕円に半透明の塗りを付けるか。既定は塗りなし。 */
		fill: DEFAULT_STYLE_PREFS.fill,
		/** 新規のモザイク・ぼかしの強度（弱 / 標準 / 強）。既定は標準。 */
		intensity: DEFAULT_STYLE_PREFS.intensity,
		/** 新規 doc のスポットライト暗幕の暗さ（不透明度）。既定は標準（0.7）。 */
		spotlightAlpha: DEFAULT_STYLE_PREFS.spotlightAlpha,
		/** 新規フキダシのしっぽの向き（下 / 上 / 左 / 右 の部分集合）。空配列＝しっぽなし。既定は ["down"]。 */
		calloutTails: [...DEFAULT_STYLE_PREFS.calloutTails] as CalloutTail[],
		/** クロップ枠のアスペクト比拘束（自由 / 1:1 / 4:3 / 16:9）。既定は自由。 */
		cropRatio: DEFAULT_STYLE_PREFS.cropRatio,
		/** 書き出し形式（PNG / JPEG / WebP）。既定は PNG。 */
		exportFormat: DEFAULT_STYLE_PREFS.exportFormat,
		/** 書き出し品質（高 / 標準 / 低。JPEG / WebP のみ有効）。既定は標準。 */
		exportQuality: DEFAULT_STYLE_PREFS.exportQuality,
	};

	/**
	 * 次に置くステップバッジの番号の明示上書き（セッション内の一時状態）。
	 * フライアウトの「次を 1 に戻す」を押すと 1 を入れ、StepTool が 1 個置いたら
	 * clearStepNumberOverride() で破棄する（以降はまた連番）。doc・style-prefs には
	 * 保存しない（保存不要な一時状態）。null は上書きなし＝通常の連番採番。
	 */
	private stepNumberOverride: number | null = null;

	/**
	 * 色・線種・フォントサイズの変更を storage.local に保存するセーバ。
	 * 同値なら書かないので、色や線種を切り替えたときだけ書き込みが走る。
	 */
	private stylePrefsSaver: { save(prefs: StylePrefs): void };

	private toolbar: Toolbar;
	private idCounter = 0;
	/**
	 * ユーザーがまだ手動でズーム/パンしていない間 true。
	 * この間は window/コンテナのリサイズに追従して自動で全体フィットする
	 * （初期レイアウト確定前に fit すると 0 サイズ基準で極小になるため）。
	 */
	private autoFit = true;

	/** doc がコミットされるたびに呼ばれる（自動保存のフック）。 */
	onDocCommitted?: (doc: EditorDoc) => void;
	/** 選択が変わるたびに呼ばれる（select ツールの Transformer 更新用）。 */
	onSelectionChanged?: (id: string | null) => void;

	constructor(
		container: HTMLDivElement,
		toolbarRoot: HTMLElement,
		record: CaptureRecord,
		imageEl: HTMLImageElement,
		initialDoc?: EditorDoc,
		stylePrefs?: StylePrefs,
	) {
		this.contentSize = { width: record.width, height: record.height };
		this.baseImage = imageEl;
		// 前回のスタイル設定（色・線種・フォントサイズ）を復元する。線の太さは 4px 固定。
		// この時点で this.style に反映しておくことで、下の Toolbar 生成後の
		// syncToolbar() がスウォッチのアクティブ表示・線種トグルへ復元値を映す。
		const prefs = stylePrefs ?? DEFAULT_STYLE_PREFS;
		this.style.stroke = prefs.stroke;
		this.style.dash = prefs.dash;
		this.style.fontSize = prefs.fontSize;
		this.style.arrowStyle = prefs.arrowStyle;
		this.style.fill = prefs.fill;
		this.style.intensity = prefs.intensity;
		this.style.spotlightAlpha = prefs.spotlightAlpha;
		this.style.calloutTails = [...prefs.calloutTails];
		this.style.cropRatio = prefs.cropRatio;
		this.style.exportFormat = prefs.exportFormat;
		this.style.exportQuality = prefs.exportQuality;
		// 復元値を初期値としてセーバに渡し、起動直後の同値保存を抑止する。
		this.stylePrefsSaver = createStylePrefsSaver(prefs);
		// crop フィールドが無い旧保存データも読めるよう null で補完する。
		const startDoc: EditorDoc = initialDoc
			? { ...initialDoc, crop: initialDoc.crop ?? null }
			: emptyDoc();
		this.history = initHistory(startDoc);

		this.stage = new Konva.Stage({
			container,
			width: container.clientWidth,
			height: container.clientHeight,
		});

		this.bgLayer = new Konva.Layer({ listening: false });
		this.shapeLayer = new Konva.Layer();
		this.previewLayer = new Konva.Layer({ listening: false });
		this.uiLayer = new Konva.Layer();

		this.image = new Konva.Image({
			image: imageEl,
			x: 0,
			y: 0,
			width: record.width,
			height: record.height,
		});
		this.bgLayer.add(this.image);

		this.transformer = new Konva.Transformer({
			flipEnabled: false,
			ignoreStroke: true,
			rotateEnabled: true,
			anchorSize: 9,
			borderStroke: "#3b82f6",
			anchorStroke: "#3b82f6",
			anchorFill: "#ffffff",
		});
		this.uiLayer.add(this.transformer);

		this.stage.add(
			this.bgLayer,
			this.shapeLayer,
			this.previewLayer,
			this.uiLayer,
		);

		this.crop = new CropController(this);
		this.crop.attach(this.stage);

		// トーストは stage コンテナの親（相対配置の main）に載せる。
		this.toast = new Toast(container.parentElement ?? container);

		this.toolbar = new Toolbar(toolbarRoot, {
			onToolChange: (t) => this.setTool(t),
			onColorChange: (c) => this.setColor(c),
			onDashChange: (d) => this.setDash(d),
			onArrowStyleChange: (s) => this.setArrowStyle(s),
			onFontSizeChange: (px) => this.setFontSize(px),
			onFillChange: (f) => this.setFill(f),
			onIntensityChange: (i) => this.setIntensity(i),
			onSpotlightDimChange: (a) => this.setSpotlightDim(a),
			onCalloutTailToggle: (t) => this.toggleCalloutTail(t),
			onStepNumberReset: () => this.resetStepNumber(),
			onCropRatioChange: (r) => this.setCropRatio(r),
			onExportFormatChange: (f) => this.setExportFormat(f),
			onExportQualityChange: (q) => this.setExportQuality(q),
			onUndo: () => this.undo(),
			onRedo: () => this.redo(),
			onSave: () => this.save(),
			onCopy: () => void this.copyToClipboard(),
		});

		this.bindStageEvents();
		this.bindKeyboard();
		this.bindResize(container);

		this.fitView();
		this.render();
		this.syncToolbar();
	}

	/** ツール実体を登録する（app 構築後に呼ぶ）。 */
	registerTool(tool: Tool): void {
		this.tools.set(tool.name, tool);
	}

	/** ツールが app を操作するための context。 */
	context(): EditorContext {
		return {
			previewLayer: this.previewLayer,
			style: this.style,
			stage: this.stage,
			contentSize: () => this.contentSize,
			scale: () => this.stage.scaleX(),
			newId: () => this.newId(),
			docPointer: () => this.docPointer(),
			docToClient: (docPos) => this.docToClient(docPos),
			commitDoc: (next) => this.commitDoc(next),
			getDoc: () => this.history.present,
			select: (id) => this.select(id),
			stepNumberOverride: () => this.getStepNumberOverride(),
			clearStepNumberOverride: () => this.clearStepNumberOverride(),
			setTextEditing: (editing) => this.setTextEditing(editing),
			setNodeVisible: (id, visible) => this.setNodeVisible(id, visible),
		};
	}

	/** ドキュメント座標を画面（ページ）上のクライアント座標に変換する。 */
	private docToClient(docPos: Point): Point {
		const abs = this.shapeLayer.getAbsoluteTransform().point(docPos);
		const box = this.stage.container().getBoundingClientRect();
		return { x: box.left + abs.x, y: box.top + abs.y };
	}

	/** id の図形ノードの表示/非表示を切り替える（テキスト編集中に元ノードを隠す用）。 */
	private setNodeVisible(id: string, visible: boolean): void {
		const node = this.shapeLayer.findOne(`#${id}`);
		if (node) {
			node.visible(visible);
			this.shapeLayer.batchDraw();
		}
	}

	// --- doc / 履歴 ---

	getDoc(): EditorDoc {
		return this.history.present;
	}

	/** doc を差し替えて履歴に commit し、再描画・自動保存する（唯一の書き込み経路）。 */
	commitDoc(next: EditorDoc): void {
		if (next === this.history.present) return;
		this.history = commit(this.history, next);
		this.render();
		this.syncToolbar();
		this.onDocCommitted?.(next);
	}

	undo(): void {
		// 進行中の nudge を先に確定し、その 1 手をまるごと戻せるようにする。
		this.flushNudge();
		if (!canUndo(this.history)) return;
		this.history = undo(this.history);
		this.selectedIds = [];
		this.render();
		this.syncToolbar();
		this.onSelectionChanged?.(null);
		this.onDocCommitted?.(this.history.present);
	}

	redo(): void {
		this.flushNudge();
		if (!canRedo(this.history)) return;
		this.history = redo(this.history);
		this.selectedIds = [];
		this.render();
		this.syncToolbar();
		this.onSelectionChanged?.(null);
		this.onDocCommitted?.(this.history.present);
	}

	// --- 描画 ---

	private render(): void {
		// select ツールでは全図形をドラッグ可能にする。
		// text ツールでも既存テキストの選択・移動を許すため、テキストノードだけは
		// 個別に draggable + 確定/選択ハンドラを付ける（下の bindTextNodeEvents）。
		const selectable = this.currentTool === "select";
		renderShapes(
			this.shapeLayer,
			this.history.present,
			selectable,
			this.baseImage,
		);
		if (selectable) this.bindNodeEvents();
		else if (this.currentTool === "text") this.bindTextNodeEvents();
		this.applyCropView();
		this.syncTransformer();
		this.applyViewTransform(this.readTransform());
	}

	/**
	 * doc.crop に応じて各レイヤーを原点合わせ（-crop.x,-crop.y のオフセット）し、
	 * 表示を crop 寸法で clip する。クロップ座標は焼き込まず、render のたびに
	 * ここで張り直す（undo でそのまま戻る）。crop が null なら原点・clip 解除。
	 */
	private applyCropView(): void {
		const crop = this.history.present.crop;
		const offset = { x: -(crop?.x ?? 0), y: -(crop?.y ?? 0) };
		const size = this.displaySize();
		const clip = { x: 0, y: 0, width: size.width, height: size.height };

		this.bgLayer.position(offset);
		this.shapeLayer.position(offset);
		this.previewLayer.position(offset);
		this.uiLayer.position(offset);
		this.crop.setOffset(offset.x, offset.y);

		this.bgLayer.clip(crop ? clip : null);
		this.shapeLayer.clip(crop ? clip : null);
	}

	/** 表示・エクスポートの基準サイズ（crop があれば crop 寸法、無ければ画像原寸）。 */
	private displaySize(): { width: number; height: number } {
		return croppedSize(this.history.present.crop, this.contentSize);
	}

	/**
	 * 各図形ノードに移動・変形の確定ハンドラとクリック選択を付ける（select ツール時）。
	 * ドラッグ/変形の終了時にノードの状態を Shape へ焼き込んで commit する。
	 */
	private bindNodeEvents(): void {
		for (const child of this.shapeLayer.getChildren()) {
			this.attachNodeInteractions(child);
		}
	}

	/**
	 * text ツール中でも既存テキストを選択・移動できるよう、テキストノードだけに
	 * draggable と確定/選択ハンドラを付ける。空き領域の pointerdown は素通りして
	 * TextTool 側の新規作成に回る（既存テキスト上の pointerdown は選択に吸収する）。
	 */
	private bindTextNodeEvents(): void {
		for (const child of this.shapeLayer.getChildren()) {
			if (findShape(this.history.present, child.id())?.type !== "text")
				continue;
			child.draggable(true);
			this.attachNodeInteractions(child);
		}
	}

	/**
	 * 複数選択でグループドラッグ中に、掴んだノード以外の選択ノードへ同じ移動量を伝える
	 * ための一時状態。掴んだノードのドラッグ開始位置と、他ノードの開始位置を覚えておき、
	 * dragmove で「掴んだノードの移動量」を全員へ適用する。ドラッグ外は null。
	 */
	private groupDrag: {
		anchorId: string;
		anchorStart: Point;
		others: { node: Konva.Node; start: Point }[];
	} | null = null;

	/**
	 * 1 つの図形ノードに、変形/移動の確定コミットと pointerdown 選択を配線する。
	 * select ツールと text ツール（テキストノードのみ）の双方から使う。
	 */
	private attachNodeInteractions(node: Konva.Node): void {
		// Alt(Option)+ドラッグ開始なら「複製をドラッグ」モードに入る。ドラッグ中の
		// 見た目の見せ方は問わず、確定時（dragend）に元を残して複製を追加する。
		node.on("dragstart.altdup", (e: Konva.KonvaEventObject<DragEvent>) => {
			this.altDragging = e.evt.altKey;
			// 複数選択中に選択ノードを掴んだら、他の選択ノードも一緒に動かす準備をする
			// （Alt 複製ドラッグは単一選択のときだけ扱い、複数選択では素の一括移動にする）。
			if (this.selectedIds.length > 1 && this.selectedIds.includes(node.id())) {
				this.altDragging = false;
				this.beginGroupDrag(node);
			}
		});
		node.on("dragmove.group", (e: Konva.KonvaEventObject<DragEvent>) => {
			// まずグループドラッグの一括移動を反映（掴んだノードの移動量を他へ伝える）。
			this.updateGroupDrag(node);
			// 続いて整列スナップ: 移動中の図形の端を他図形の端へ吸着し、ガイド線を出す。
			// Shift 押下中は無効（自由移動）。単一ドラッグ・グループドラッグの双方で効く。
			this.applyDragSnap(node, e.evt.shiftKey);
		});
		node.on("dragend.commit transformend.commit", () => {
			// ドラッグ終了でスナップのガイド線を消す（変形終了時も無害に消える）。
			this.clearSnapGuides();
			// グループドラッグ確定: 選択中の全ノードの新位置をまとめて 1 回 commit する。
			if (this.groupDrag) {
				this.finishGroupDrag();
				return;
			}
			const id = node.id();
			const prev = findShape(this.history.present, id);
			if (!prev) return;
			const next = shapeFromNode(node, prev);
			if (this.altDragging) {
				// Alt ドラッグ確定: 元図形は据え置き、ドロップ位置に新 id の複製を追加して
				// そちらを選択する。ドロップ位置は next が持つので複製オフセットは 0。
				// step は次の連番、text/callout は文言ごと複製される（duplicateShape）。
				this.altDragging = false;
				const copy = duplicateShape(
					next,
					this.newId(),
					this.history.present.shapes,
					0,
					0,
				);
				// Alt ドラッグ複製は単一図形のみ（複数選択中はグループドラッグに切り替わる）。
				// 単独の複製がソースのグループへ紛れ込まないよう、groupId は引き継がない。
				const { groupId: _omit, ...solo } = copy;
				this.commitDoc(addShape(this.history.present, solo as Shape));
				this.select(solo.id);
				return;
			}
			this.commitDoc(replaceShape(this.history.present, id, next));
		});
		node.on("pointerdown.select", (e: Konva.KonvaEventObject<PointerEvent>) => {
			// select ツール、または text ツールでテキストノードを掴んだときに選択する。
			// これにより text ツール中でも既存テキスト上の pointerdown は新規作成でなく
			// 選択（＋そのままドラッグ移動）になる。
			if (this.currentTool !== "select" && this.currentTool !== "text") return;
			e.cancelBubble = true; // 背景の選択解除・新規作成に伝播させない
			// Shift+クリックは選択へ追加/除外（select ツールのみ。複数選択の構築）。
			if (this.currentTool === "select" && e.evt.shiftKey) {
				this.toggleInSelection(node.id());
				return;
			}
			// 既に複数選択に含まれるノードを掴んだ場合は選択を維持（そのままグループ
			// ドラッグへ）。含まれないノードなら単一選択に切り替える。
			if (this.selectedIds.length > 1 && this.selectedIds.includes(node.id())) {
				return;
			}
			this.select(node.id());
		});
	}

	/** グループドラッグ開始: 掴んだノードと他の選択ノードの開始位置を記録する。 */
	private beginGroupDrag(anchor: Konva.Node): void {
		const others: { node: Konva.Node; start: Point }[] = [];
		for (const id of this.selectedIds) {
			if (id === anchor.id()) continue;
			const n = this.shapeLayer.findOne(`#${id}`);
			if (n) others.push({ node: n, start: { x: n.x(), y: n.y() } });
		}
		this.groupDrag = {
			anchorId: anchor.id(),
			anchorStart: { x: anchor.x(), y: anchor.y() },
			others,
		};
	}

	/** グループドラッグ中: 掴んだノードの移動量を他の選択ノードへ反映する。 */
	private updateGroupDrag(anchor: Konva.Node): void {
		const g = this.groupDrag;
		if (!g || g.anchorId !== anchor.id()) return;
		const dx = anchor.x() - g.anchorStart.x;
		const dy = anchor.y() - g.anchorStart.y;
		for (const o of g.others) {
			o.node.position({ x: o.start.x + dx, y: o.start.y + dy });
		}
		this.shapeLayer.batchDraw();
	}

	/** グループドラッグ確定: 選択中の全ノードの新位置を 1 回で焼き込み commit する。 */
	private finishGroupDrag(): void {
		const g = this.groupDrag;
		this.groupDrag = null;
		if (!g) return;
		let next = this.history.present;
		for (const id of this.selectedIds) {
			const node = this.shapeLayer.findOne(`#${id}`);
			const prev = findShape(next, id);
			if (!node || !prev) continue;
			next = replaceShape(next, id, shapeFromNode(node, prev));
		}
		this.commitDoc(next);
	}

	// --- 整列スナップ（ドラッグ中の吸着ガイド） ---

	/**
	 * ドラッグ中に描いているガイド線ノード（previewLayer 上）。ドラッグ終了・
	 * 次フレームの描き直しで破棄する。ドラッグ外は空配列。
	 */
	private snapGuideNodes: Konva.Line[] = [];

	/**
	 * ドラッグ中の図形の端を他図形の端へ吸着させ、赤いガイド線を出す。
	 * dragmove から毎フレーム呼ぶ。手順:
	 *   1) Shift 押下中は自由移動（吸着せずガイドを消す）。
	 *   2) 移動中のノード集合（選択中の全ノード。単一ドラッグなら 1 つ）の現在位置から
	 *      合成バウンディングボックスを取る（getClientRect で回転・スケール込みの doc 座標）。
	 *   3) 吸着候補は「移動対象でない他図形の doc バウンディングボックス」＋「画像全体の
	 *      ボックス（キャンバス境界・中央への吸着）」。
	 *   4) computeSnap で最近傍の吸着量（dx,dy）とガイド線を求め、しきい値は画面 px を
	 *      ズーム率で割った doc 座標のしきい値にする（画面上で一定の吸着感）。
	 *   5) 吸着量ぶん移動中の全ノードをずらし（Konva が次フレームでポインタ位置へ戻すため
	 *      累積しない）、ガイド線を描く。
	 */
	private applyDragSnap(anchor: Konva.Node, shiftKey: boolean): void {
		if (shiftKey) {
			this.clearSnapGuides();
			return;
		}
		// 移動中のノード集合を決める。掴んだノードが選択に含まれるなら選択全体
		// （グループ／複数選択の一括移動）、含まれなければ掴んだノード単体。
		const movingIds = this.selectedIds.includes(anchor.id())
			? this.selectedIds
			: [anchor.id()];
		const movingNodes = movingIds
			.map((id) => this.shapeLayer.findOne(`#${id}`))
			.filter((n): n is Konva.Node => n != null);
		if (movingNodes.length === 0) {
			this.clearSnapGuides();
			return;
		}
		const movingBox = this.unionLiveBox(movingNodes);
		if (!movingBox) {
			this.clearSnapGuides();
			return;
		}

		// 吸着候補: 移動対象でない図形の doc バウンディングボックス＋画像全体のボックス。
		const movingSet = new Set(movingIds);
		const others: BBox[] = [];
		for (const shape of this.history.present.shapes) {
			if (movingSet.has(shape.id)) continue;
			others.push(shapeBoundingBox(shape));
		}
		// 画像全体（キャンバス境界・中央）への吸着も候補に含める。
		const size = this.contentSize;
		others.push({ x: 0, y: 0, width: size.width, height: size.height });

		const threshold = SNAP_THRESHOLD_PX / this.stage.scaleX();
		const snap = computeSnap(movingBox, others, threshold);

		// 吸着量ぶん移動中の全ノードをずらす（Konva が次の dragmove でポインタ位置へ
		// 戻すため、このずれは累積しない）。
		if (snap.dx !== 0 || snap.dy !== 0) {
			for (const n of movingNodes) {
				n.position({ x: n.x() + snap.dx, y: n.y() + snap.dy });
			}
			this.shapeLayer.batchDraw();
		}
		this.drawSnapGuides(snap.guides);
	}

	/**
	 * ノード集合の合成バウンディングボックス（doc 座標）を返す。各ノードの
	 * getClientRect を shapeLayer 基準で取り（現在のドラッグ位置・回転・スケール込み）、
	 * それらを内包する外接矩形を求める。ノードが無ければ null。
	 */
	private unionLiveBox(nodes: Konva.Node[]): BBox | null {
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const n of nodes) {
			const r = n.getClientRect({ relativeTo: this.shapeLayer });
			if (r.width === 0 && r.height === 0) continue;
			minX = Math.min(minX, r.x);
			minY = Math.min(minY, r.y);
			maxX = Math.max(maxX, r.x + r.width);
			maxY = Math.max(maxY, r.y + r.height);
		}
		if (!Number.isFinite(minX)) return null;
		return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
	}

	/**
	 * 整列ガイド線を previewLayer に赤の細線で描き直す。既存のガイドは毎回捨てて
	 * 描き直す（本数は 0〜2 本）。線幅はズームに依らず画面上で 1px 相当にする。
	 */
	private drawSnapGuides(guides: SnapGuide[]): void {
		this.clearSnapGuides();
		const scale = this.stage.scaleX();
		for (const g of guides) {
			const points =
				g.axis === "x"
					? [g.position, g.from, g.position, g.to] // 縦線
					: [g.from, g.position, g.to, g.position]; // 横線
			const line = new Konva.Line({
				points,
				stroke: SNAP_GUIDE_COLOR,
				// ズームで割って画面上 1px 相当の細線に保つ。
				strokeWidth: 1 / scale,
				listening: false,
			});
			this.previewLayer.add(line);
			this.snapGuideNodes.push(line);
		}
		this.previewLayer.batchDraw();
	}

	/** 描画中の整列ガイド線をすべて破棄する（ドラッグ終了・描き直し時）。 */
	private clearSnapGuides(): void {
		if (this.snapGuideNodes.length === 0) return;
		for (const line of this.snapGuideNodes) line.destroy();
		this.snapGuideNodes = [];
		this.previewLayer.batchDraw();
	}

	/**
	 * 選択 id 群のノードに Transformer をアタッチする。未選択なら外す。
	 * - 単一選択: type に応じてアンカー・回転・比率を設定（従来どおり）。
	 * - 複数選択: リサイズ・回転を無効化（枠だけ出して一括移動のみ許す）。加工系の
	 *   リサイズ再計算やテキストの比例スケール等と干渉させず単純に保つ。
	 * select ツールは全図形、text ツールはテキストシェイプ単一選択時のみ表示する。
	 */
	private syncTransformer(): void {
		const ids = this.selectedIds;
		const shapes = ids
			.map((id) => findShape(this.history.present, id))
			.filter((s): s is Shape => s != null);
		const single = shapes.length === 1 ? shapes[0] : undefined;
		// text ツールでは単一のテキスト選択のときだけ変形を許す（従来の挙動）。
		const canTransform =
			this.currentTool === "select" ||
			(this.currentTool === "text" && single?.type === "text");
		if (shapes.length === 0 || !canTransform) {
			this.transformer.nodes([]);
			this.uiLayer.batchDraw();
			return;
		}
		const nodes = ids
			.map((id) => this.shapeLayer.findOne(`#${id}`))
			.filter((n): n is Konva.Node => n != null);
		if (nodes.length === 0) {
			this.transformer.nodes([]);
			this.uiLayer.batchDraw();
			return;
		}
		if (single) {
			this.configureTransformerFor(single.type);
		} else {
			// 複数選択はリサイズ・回転とも無効（一括移動のみ）。
			this.transformer.enabledAnchors([]);
			this.transformer.keepRatio(false);
			this.transformer.rotateEnabled(false);
		}
		this.transformer.nodes(nodes);
		this.transformer.moveToTop();
		this.uiLayer.batchDraw();
	}

	/**
	 * 選択図形の type に応じて Transformer のアンカー・回転・比率固定を切り替える。
	 * Transformer は全図形で共有するため、type ごとに毎回明示的に設定し直す。
	 * - text: 四隅アンカーのみ・縦横比固定・回転無効。四隅ドラッグの比例スケールを
	 *   fontSize へ焼き込む運用のため、辺アンカー（片軸だけ伸ばす）を出さない。
	 * - step: アンカー・回転とも無効（固定サイズの丸バッジ）。選択枠だけ出して
	 *   ドラッグ移動のみを許す。
	 * - mosaic / blur / erase / spotlight: 全アンカーだが回転無効（加工の再計算・
	 *   なじませ塗り・暗幕の穴を矩形に限定する）。
	 * - それ以外: 全アンカー・回転あり（既定）。
	 */
	private configureTransformerFor(type: Shape["type"] | undefined): void {
		if (type === "text") {
			this.transformer.enabledAnchors(TEXT_CORNER_ANCHORS);
			this.transformer.keepRatio(true);
			this.transformer.rotateEnabled(false);
			return;
		}
		if (type === "step") {
			this.transformer.enabledAnchors([]);
			this.transformer.keepRatio(false);
			this.transformer.rotateEnabled(false);
			return;
		}
		this.transformer.enabledAnchors(ALL_ANCHORS);
		this.transformer.keepRatio(false);
		// モザイク・ぼかし・スマート消しゴム・スポットライトは回転不可。他は回転可。
		const noRotate =
			type === "mosaic" ||
			type === "blur" ||
			type === "erase" ||
			type === "spotlight";
		this.transformer.rotateEnabled(!noRotate);
	}

	private readTransform(): ViewTransform {
		return { scale: this.stage.scaleX(), x: this.stage.x(), y: this.stage.y() };
	}

	private applyViewTransform(t: ViewTransform): void {
		this.stage.scale({ x: t.scale, y: t.scale });
		this.stage.position({ x: t.x, y: t.y });
		this.stage.batchDraw();
		this.toolbar.setZoom(t.scale);
	}

	// --- ビュー（ズーム/パン/フィット） ---

	/** コンテンツ全体（crop 適用後）をコンテナに収めて中央寄せする。 */
	fitView(): void {
		// フィット状態にしたので、以降のリサイズには自動フィットで追従する。
		this.autoFit = true;
		const t = fitTransform(
			{ width: this.stage.width(), height: this.stage.height() },
			this.displaySize(),
		);
		this.applyViewTransform(t);
	}

	private zoomAt(pivot: Point, nextScale: number): void {
		this.autoFit = false; // 手動ズーム後はリサイズで勝手にフィットしない
		this.applyViewTransform(
			zoomAtTransform(this.readTransform(), pivot, nextScale),
		);
	}

	// --- ツール・スタイル ---

	setTool(tool: ToolName): void {
		if (tool === this.currentTool) return;
		this.tools.get(this.currentTool)?.deactivate?.();
		// crop はツールマップ外の特殊モード。CropController でライフサイクル管理する。
		if (this.currentTool === "crop") this.crop.deactivate();
		this.currentTool = tool;
		if (tool !== "select") this.select(null);
		this.tools.get(tool)?.activate?.();
		if (tool === "crop") this.crop.activate();
		// draggable の切り替えのため再描画。
		this.render();
		this.syncToolbar();
		this.updateCursor();
	}

	/** ツール外（CropController 等）から select 等へ戻すための入口。 */
	setToolExternal(tool: ToolName): void {
		this.setTool(tool);
	}

	getTool(): ToolName {
		return this.currentTool;
	}

	/** 現在のクロップ矩形（元画像座標系）。無ければ null。 */
	getCrop(): CropRect | null {
		return this.history.present.crop;
	}

	/** 現在のクロップ枠アスペクト比拘束（自由 / 1:1 / 4:3 / 16:9）。CropController が読む。 */
	getCropRatio(): CropRatio {
		return this.style.cropRatio;
	}

	/**
	 * 新規図形の色（stroke）を設定する。色を持つ図形を選択中なら、その図形へ即時
	 * 適用して履歴に 1 回 commit する（線種トグルの「選択中へ即適用」と同じパターン）。
	 */
	setColor(color: string): void {
		this.style.stroke = color;
		this.applyColorToSelection(color);
		this.toolbar.setColor(color);
		this.persistStylePrefs();
	}

	/**
	 * 選択中が色を持つ図形なら stroke を差し替えて commit する。
	 * 全図形の色の正は stroke（step バッジ・フキダシ・テキスト・矢印・矩形なども
	 * stroke が色）。モザイク・ぼかし・スポットライトは色を持たない（stroke は
	 * ShapeBase 上にあるが描画に使わない）ので対象外。同値なら何もしない。
	 */
	private applyColorToSelection(color: string): void {
		const id = this.selectedId;
		if (!id) return;
		const shape = findShape(this.history.present, id);
		if (!shape || !shapeSupportsColor(shape.type)) return;
		if (shape.stroke === color) return;
		this.commitDoc(updateShape(this.history.present, id, { stroke: color }));
	}

	/**
	 * 線種（実線/破線）を新規の線系図形の既定にする。線系シェイプを選択中は
	 * そのシェイプへ即時適用して履歴に 1 回 commit する（同値なら no-op）。
	 */
	setDash(dash: boolean): void {
		this.style.dash = dash;
		this.applyDashToSelection(dash);
		this.toolbar.setDash(dash);
		this.persistStylePrefs();
	}

	/**
	 * 矢印スタイル（片側 / 両側 / 曲線）を新規矢印の既定にする。矢印を選択中は
	 * そのシェイプへ即時適用して履歴に 1 回 commit する（線種と同じパターン・同値なら no-op）。
	 */
	setArrowStyle(style: ArrowStyle): void {
		this.style.arrowStyle = style;
		this.applyArrowStyleToSelection(style);
		this.toolbar.setArrowStyle(style);
		this.persistStylePrefs();
	}

	/**
	 * 選択中が矢印なら arrowStyle を差し替えて commit する。現在値（未設定は "single"）と
	 * 同じなら何もしない。矢印以外は対象外。
	 */
	private applyArrowStyleToSelection(style: ArrowStyle): void {
		const id = this.selectedId;
		if (!id) return;
		const shape = findShape(this.history.present, id);
		if (!shape || shape.type !== "arrow") return;
		if (normalizeArrowStyle(shape.arrowStyle) === style) return;
		this.commitDoc(
			updateShape(this.history.present, id, { arrowStyle: style }),
		);
	}

	/**
	 * フォントサイズ（テキスト・フキダシの S/M/L プリセット）を新規テキスト・フキダシの
	 * 既定にする。テキスト/フキダシを選択中はそのシェイプへ即時適用して 1 回 commit する
	 * （フキダシは高さがテキスト折返しに追従するため、fontSize を更新すれば render.ts の
	 * calloutBodyHeight が自動で高さを再計算する）。同値なら no-op。
	 */
	setFontSize(size: number): void {
		this.style.fontSize = clampFontSize(size);
		this.applyFontSizeToSelection(this.style.fontSize);
		this.toolbar.setFontSize(this.style.fontSize);
		this.persistStylePrefs();
	}

	/**
	 * 選択中がテキストまたはフキダシなら fontSize を差し替えて commit する。
	 * 現在値と同じなら何もしない。テキスト・フキダシ以外は対象外。フキダシの本体高さは
	 * doc に fontSize を書けば render.ts が calloutBodyHeight で再計算するので、ここでは
	 * fontSize だけ更新すればよい（高さフィールドは下限なので、文字が大きくなれば広がる）。
	 */
	private applyFontSizeToSelection(size: number): void {
		const id = this.selectedId;
		if (!id) return;
		const shape = findShape(this.history.present, id);
		if (!shape || (shape.type !== "text" && shape.type !== "callout")) return;
		if (shape.fontSize === size) return;
		this.commitDoc(updateShape(this.history.present, id, { fontSize: size }));
	}

	/**
	 * 塗り（なし / 半透明）を新規の矩形・楕円の既定にする。矩形・楕円を選択中は
	 * そのシェイプへ即時適用して 1 回 commit する（線種と同じパターン・同値なら no-op）。
	 */
	setFill(fill: boolean): void {
		this.style.fill = fill;
		this.applyFillToSelection(fill);
		this.toolbar.setFill(fill);
		this.persistStylePrefs();
	}

	/**
	 * 選択中が矩形・楕円なら fill を差し替えて commit する。未設定（レガシー）は塗りなし
	 * 相当なので、現在の解決値（?? false）と比較して no-op を判定する。他は対象外。
	 */
	private applyFillToSelection(fill: boolean): void {
		const id = this.selectedId;
		if (!id) return;
		const shape = findShape(this.history.present, id);
		if (!shape || (shape.type !== "rect" && shape.type !== "ellipse")) return;
		if ((shape.fill ?? false) === fill) return;
		this.commitDoc(updateShape(this.history.present, id, { fill }));
	}

	/**
	 * 強度（弱 / 標準 / 強）を新規のモザイク・ぼかしの既定にする。モザイク・ぼかしを
	 * 選択中はそのシェイプへ即時適用して 1 回 commit する（次の renderShapes で粒度・
	 * ぼかし半径を新強度から再計算＝再ピクセル化 / 再ぼかしになる）。同値なら no-op。
	 */
	setIntensity(intensity: MosaicBlurIntensity): void {
		this.style.intensity = intensity;
		this.applyIntensityToSelection(intensity);
		this.toolbar.setIntensity(intensity);
		this.persistStylePrefs();
	}

	/**
	 * 選択中がモザイク・ぼかしなら intensity を差し替えて commit する。未設定
	 * （レガシー）は "normal" 相当なので、現在の解決値（?? "normal"）と比較して
	 * no-op を判定する。他は対象外。
	 */
	private applyIntensityToSelection(intensity: MosaicBlurIntensity): void {
		const id = this.selectedId;
		if (!id) return;
		const shape = findShape(this.history.present, id);
		if (!shape || (shape.type !== "mosaic" && shape.type !== "blur")) return;
		if ((shape.intensity ?? "normal") === intensity) return;
		this.commitDoc(updateShape(this.history.present, id, { intensity }));
	}

	/**
	 * スポットライト暗幕の暗さ（薄め / 標準 / 濃いめ）を設定する。暗幕は doc 内の全
	 * spotlight で 1 枚なので、値は doc レベルのフィールド（spotlightAlpha）へ commit する
	 * （undo 対象）。同時に style.spotlightAlpha を新規 doc の既定として更新し記憶する。
	 *
	 * doc に spotlight が 1 つも無いときは doc を書かない（見た目に何も変わらない undo が
	 * 積まれるのを避ける）。この場合は既定の更新・保存だけ行い、最初の spotlight を描いた
	 * ときに SpotlightTool が style.spotlightAlpha を doc へ焼き込む。spotlight があり、かつ
	 * doc の現在値（未設定は標準 0.7）と異なるときだけ commit する。
	 */
	setSpotlightDim(alpha: number): void {
		this.style.spotlightAlpha = alpha;
		const doc = this.history.present;
		const hasSpotlight = doc.shapes.some((s) => s.type === "spotlight");
		if (hasSpotlight && resolveSpotlightAlpha(doc.spotlightAlpha) !== alpha) {
			this.commitDoc({ ...doc, spotlightAlpha: alpha });
		}
		this.toolbar.setSpotlightDim(alpha);
		this.persistStylePrefs();
	}

	/**
	 * しっぽの向き（下 / 上 / 左 / 右）を 1 つトグルする（複数選択・全 OFF 可）。
	 * 現在のしっぽ集合に含まれていれば外し、無ければ足して normalize（重複除去・並び順）
	 * する。空集合＝しっぽなし。新規フキダシの既定にし、フキダシを選択中はそのシェイプへ
	 * 即時適用して 1 回 commit する。
	 */
	toggleCalloutTail(tail: CalloutTail): void {
		const has = this.style.calloutTails.includes(tail);
		const next = has
			? this.style.calloutTails.filter((t) => t !== tail)
			: [...this.style.calloutTails, tail];
		// normalize で重複除去・4 方向の並び順に整える（空配列はそのまま）。
		this.style.calloutTails = normalizeCalloutTails(next);
		this.applyCalloutTailsToSelection(this.style.calloutTails);
		this.toolbar.setCalloutTails(this.style.calloutTails);
		this.persistStylePrefs();
	}

	/**
	 * 選択中がフキダシなら tails を差し替えて commit する。現在の解決値
	 * （normalizeCalloutTails）と同値なら何もしない。他は対象外。
	 */
	private applyCalloutTailsToSelection(tails: CalloutTail[]): void {
		const id = this.selectedId;
		if (!id) return;
		const shape = findShape(this.history.present, id);
		if (!shape || shape.type !== "callout") return;
		const current = normalizeCalloutTails(shape.tails, shape.tail);
		if (
			current.length === tails.length &&
			current.every((t, i) => t === tails[i])
		) {
			return;
		}
		// 配列はコピーして持たせる（style 側の配列と共有しない）。
		this.commitDoc(
			updateShape(this.history.present, id, { tails: [...tails] }),
		);
	}

	/**
	 * 書き出し形式（PNG / JPEG / WebP）を設定する。記憶（style-prefs）のみで doc は
	 * 書かない（形式は画像内容でなく出力方法の設定）。保存ボタンのツールチップも更新する。
	 */
	setExportFormat(format: ExportFormat): void {
		this.style.exportFormat = format;
		this.toolbar.setExportFormat(format);
		this.persistStylePrefs();
	}

	/** 書き出し品質（高 / 標準 / 低）を設定する。記憶のみ（doc は書かない）。 */
	setExportQuality(quality: ExportQuality): void {
		this.style.exportQuality = quality;
		this.toolbar.setExportQuality(quality);
		this.persistStylePrefs();
	}

	/**
	 * クロップ枠のアスペクト比拘束（自由 / 1:1 / 4:3 / 16:9）を設定する。
	 * 記憶（style-prefs）だけでなく、クロップ操作中なら CropController へ即時反映し、
	 * 既存の選択枠を中心を保ってその比率に整形する。doc には保存しない
	 * （クロップ確定値は従来どおり CropRect）。
	 */
	setCropRatio(ratio: CropRatio): void {
		this.style.cropRatio = ratio;
		this.crop.setRatio(ratio);
		this.toolbar.setCropRatio(ratio);
		this.persistStylePrefs();
	}

	/**
	 * 「次を 1 に戻す」: 次に置くステップバッジの番号を 1 に明示上書きする
	 * （セッション内の一時状態）。1 個置いたら StepTool が破棄し、以降はまた連番。
	 * doc・style-prefs には保存しない。
	 */
	resetStepNumber(): void {
		this.stepNumberOverride = 1;
	}

	/** 次に置くステップ番号の明示上書き（無ければ null）。StepTool が resolveNextStepNumber へ渡す。 */
	getStepNumberOverride(): number | null {
		return this.stepNumberOverride;
	}

	/** ステップ番号の明示上書きを破棄する（バッジを 1 個置いた後に StepTool が呼ぶ）。 */
	clearStepNumberOverride(): void {
		this.stepNumberOverride = null;
	}

	/**
	 * 現在の新規図形用スタイル（色・線種・フォントサイズ・塗り・強度・暗さ・しっぽ・比率）を
	 * storage.local に保存する。セーバ側で直前の保存値と同値なら書き込みをスキップ
	 * するので、いずれかを切り替えたときだけ実際の書き込みが走る。線の太さは固定
	 * なので保存しない。ステップの番号上書きは一時状態なので保存しない。
	 */
	private persistStylePrefs(): void {
		this.stylePrefsSaver.save({
			stroke: this.style.stroke,
			dash: this.style.dash,
			fontSize: this.style.fontSize,
			arrowStyle: this.style.arrowStyle,
			fill: this.style.fill,
			intensity: this.style.intensity,
			spotlightAlpha: this.style.spotlightAlpha,
			calloutTails: [...this.style.calloutTails],
			cropRatio: this.style.cropRatio,
			exportFormat: this.style.exportFormat,
			exportQuality: this.style.exportQuality,
		});
	}

	/**
	 * 選択中が線種を持つ図形（矢印・矩形・楕円・ペン）なら dash を適用して commit する。
	 * 現在値と同じなら何もしない（連続選択で履歴が荒れないように）。
	 * マーカー・テキスト・モザイク・ステップ・フキダシは線種を持たないので対象外。
	 */
	private applyDashToSelection(dash: boolean): void {
		const id = this.selectedId;
		if (!id) return;
		const shape = findShape(this.history.present, id);
		if (!shape || !shapeSupportsDash(shape.type)) return;
		// 未設定（レガシー）は実線相当。false を指定したときも実質同値なので
		// 現在の解決値（?? false）と比較して no-op を判定する。
		if ((shape.dash ?? false) === dash) return;
		this.commitDoc(updateShape(this.history.present, id, { dash }));
	}

	private updateCursor(): void {
		const container = this.stage.container();
		// select と crop はハンドル操作なので通常カーソル、描画系は十字。
		const pointerTools =
			this.currentTool === "select" || this.currentTool === "crop";
		container.style.cursor = pointerTools ? "default" : "crosshair";
	}

	// --- 選択 ---

	/**
	 * 単一選択の id（後方互換の見せ方）。選択が「ちょうど 1 個」のときだけその id を、
	 * それ以外（未選択・複数選択）は null を返す。色・線種・矢印スタイルの「選択中図形へ
	 * 即適用」やコントロール表示は単一選択のときだけ働かせたいので、この getter を使う。
	 */
	private get selectedId(): string | null {
		return this.selectedIds.length === 1 ? (this.selectedIds[0] ?? null) : null;
	}

	/**
	 * 図形を選択状態にする（単一選択）。null で選択解除。既存 API を壊さないよう、
	 * 内部の複数選択配列を「要素数 1（または 0）」として設定する薄いラッパ。
	 */
	select(id: string | null): void {
		this.setSelection(id ? [id] : []);
	}

	/**
	 * 選択集合をまとめて差し替える（複数選択の実処理）。
	 * まずグループ所属図形を同グループ全体へ拡張し（expandSelectionToGroups）、その後
	 * doc に存在する図形へ正規化（存在しない id・重複を除去し、描画順に整える）してから
	 * 反映する。これによりクリック・ラバーバンド・Shift 追加・複製結果のどの経路でも
	 * グループはひとまとまりとして選ばれる（グループは分割選択できない）。
	 * 変化が無ければ何もしない。
	 */
	private setSelection(ids: string[]): void {
		const expanded = expandSelectionToGroups(ids, this.history.present.shapes);
		const next = this.normalizeSelection(expanded);
		if (this.sameSelection(next, this.selectedIds)) return;
		this.selectedIds = next;
		this.syncTransformer();
		// 線系図形・矢印の選択有無でコントロールの表示と値が変わる。
		this.syncDashControls();
		this.syncArrowStyleControls();
		this.onSelectionChanged?.(this.selectedId);
	}

	/** ids から存在しない id・重複を除き、doc の描画順に並べ直す。 */
	private normalizeSelection(ids: string[]): string[] {
		const set = new Set(ids);
		return this.history.present.shapes
			.map((s) => s.id)
			.filter((id) => set.has(id));
	}

	/** 2 つの選択集合が（順序も含め）同値か。 */
	private sameSelection(a: string[], b: string[]): boolean {
		return a.length === b.length && a.every((id, i) => id === b[i]);
	}

	/**
	 * Shift+クリックで 1 つの図形を選択に追加/除外する（トグル）。既に選択中なら外し、
	 * そうでなければ加える。既存選択は保つ。
	 */
	private toggleInSelection(id: string): void {
		const has = this.selectedIds.includes(id);
		const next = has
			? this.selectedIds.filter((x) => x !== id)
			: [...this.selectedIds, id];
		this.setSelection(next);
	}

	getSelectedId(): string | null {
		return this.selectedId;
	}

	/** 選択中の全 id（複数選択対応）。順序は描画順。 */
	getSelectedIds(): string[] {
		return [...this.selectedIds];
	}

	// --- ラバーバンド（範囲選択） ---

	/**
	 * 空き領域からのドラッグでラバーバンド（範囲選択矩形）を始める。
	 * additive（Shift 併用）でないときは、まず選択を解除する。矩形は doc 座標系で
	 * previewLayer に描く（shapeLayer と同じオフセット・スケールが掛かる）。
	 */
	private beginBand(start: Point, additive: boolean): void {
		if (!additive) this.select(null);
		const rect = new Konva.Rect({
			x: start.x,
			y: start.y,
			width: 0,
			height: 0,
			// 選択枠と同系色の半透明矩形。ヒット判定は不要。
			fill: "rgba(59, 130, 246, 0.12)",
			stroke: "#3b82f6",
			strokeWidth: 1,
			dash: [4, 4],
			listening: false,
		});
		this.previewLayer.add(rect);
		this.previewLayer.batchDraw();
		this.band = { start, rect, additive };
	}

	/** ラバーバンドの矩形を現在のポインタ位置まで広げる（負方向ドラッグ対応）。 */
	private updateBand(pos: Point): void {
		const band = this.band;
		if (!band) return;
		const x = Math.min(band.start.x, pos.x);
		const y = Math.min(band.start.y, pos.y);
		band.rect.setAttrs({
			x,
			y,
			width: Math.abs(pos.x - band.start.x),
			height: Math.abs(pos.y - band.start.y),
		});
		this.previewLayer.batchDraw();
	}

	/**
	 * ラバーバンドを確定する。矩形に交差する図形を選択に反映する（純粋関数 shapesInBand）。
	 * - additive（Shift 併用）: 既存選択と交差図形を XOR（重なりはトグル）する。
	 * - 非 additive: 交差図形だけを新しい選択にする。
	 * ドラッグ距離が極小（ほぼクリック）なら選択操作はしない（非 additive のときは
	 * beginBand で既に選択解除済み）。
	 */
	private finishBand(pos: Point | null): void {
		const band = this.band;
		this.band = null;
		if (!band) return;
		const end = pos ?? band.start;
		band.rect.destroy();
		this.previewLayer.batchDraw();

		const boxWidth = Math.abs(end.x - band.start.x);
		const boxHeight = Math.abs(end.y - band.start.y);
		// ほぼ動いていない（クリック相当）なら範囲選択はしない。
		if (boxWidth < 3 && boxHeight < 3) return;

		const rect = {
			x: Math.min(band.start.x, end.x),
			y: Math.min(band.start.y, end.y),
			width: boxWidth,
			height: boxHeight,
		};
		const hit = shapesInBand(this.history.present.shapes, rect);
		if (band.additive) {
			// Shift 併用: 既存選択に対し、交差図形をトグル（重なりは外し、他は足す）。
			const set = new Set(this.selectedIds);
			for (const id of hit) {
				if (set.has(id)) set.delete(id);
				else set.add(id);
			}
			this.setSelection([...set]);
		} else {
			this.setSelection(hit);
		}
	}

	// --- 座標 ---

	/** ズーム/パンを考慮したドキュメント座標のポインタ位置。 */
	private docPointer(): Point | null {
		return this.shapeLayer.getRelativePointerPosition() ?? null;
	}

	private newId(): string {
		this.idCounter += 1;
		return `s${Date.now().toString(36)}-${this.idCounter}`;
	}

	// --- イベント配線 ---

	private bindStageEvents(): void {
		this.stage.on("wheel", (e) => {
			e.evt.preventDefault();
			if (e.evt.ctrlKey || e.evt.metaKey) {
				const pointer = this.stage.getPointerPosition();
				if (!pointer) return;
				const factor = Math.exp(-e.evt.deltaY * 0.002);
				this.zoomAt(pointer, this.stage.scaleX() * factor);
			} else {
				this.autoFit = false; // 手動パン後はリサイズで勝手にフィットしない
				this.stage.position({
					x: this.stage.x() - e.evt.deltaX,
					y: this.stage.y() - e.evt.deltaY,
				});
				this.stage.batchDraw();
			}
		});

		this.stage.on("pointerdown", (e) => {
			if (this.currentTool === "select") {
				// Transformer のハンドル操作は選択解除しない。
				if (e.target?.getLayer() === this.uiLayer) return;
				// 図形ノードのクリックは node.on("pointerdown") が処理する。
				// ここに来て target が図形でない＝背景クリックなら、空き領域からの
				// ラバーバンド（範囲選択）を始める。Shift 併用は既存選択への追加/除外。
				const targetId = e.target?.id();
				const hitShape = targetId
					? findShape(this.history.present, targetId)
					: undefined;
				if (!hitShape) {
					const pos = this.docPointer();
					if (pos) this.beginBand(pos, e.evt.shiftKey);
					else this.select(null);
				}
				return;
			}
			// text ツール中の空き領域 pointerdown（既存テキスト上は node.on が
			// cancelBubble で吸収するのでここには来ない）。
			if (this.currentTool === "text") {
				// Transformer のハンドル操作（uiLayer）は新規作成しない。
				if (e.target?.getLayer() === this.uiLayer) return;
				// テキスト選択中に空きをクリックしたら、まず選択解除だけ（誤って
				// 既存テキストへ新規テキストを重ねる事故を防ぐ。次のクリックで新規作成）。
				if (this.selectedId) {
					this.select(null);
					return;
				}
			}
			const pos = this.docPointer();
			if (!pos) return;
			this.tools.get(this.currentTool)?.onPointerDown?.(pos, modifiers(e));
		});
		this.stage.on("pointermove", (e) => {
			const pos = this.docPointer();
			if (!pos) return;
			// ラバーバンド描画中は矩形を更新する（ツールへは渡さない）。
			if (this.band) {
				this.updateBand(pos);
				return;
			}
			this.tools.get(this.currentTool)?.onPointerMove?.(pos, modifiers(e));
		});
		this.stage.on("pointerup", (e) => {
			const pos = this.docPointer();
			// ラバーバンド確定。pos が null（範囲外）でも band は畳む。
			if (this.band) {
				this.finishBand(pos);
				return;
			}
			if (!pos) return;
			this.tools.get(this.currentTool)?.onPointerUp?.(pos, modifiers(e));
		});
		this.stage.on("dblclick dbltap", (e) => {
			// フキダシは Konva.Group で、内側の Rect/Text が e.target になり得る。
			// その場合 id を持たないので、自身→祖先の順に doc の図形へ対応する id を探す。
			const shape = this.shapeForNode(e.target);
			if (!shape) return;
			// テキスト・フキダシの再編集はどのツール中でも効くようにする。
			if (shape.type === "text") {
				this.setTool("text");
			} else if (shape.type === "callout") {
				this.setTool("callout");
			}
			this.tools.get(this.currentTool)?.onDblClick?.(shape);
		});
	}

	/** テキスト編集オーバーレイ表示中はキーボードショートカットを止めるためのフラグ。 */
	private textEditing = false;
	setTextEditing(editing: boolean): void {
		this.textEditing = editing;
	}

	private bindKeyboard(): void {
		window.addEventListener("keydown", (e) => {
			if (this.textEditing) return;

			const mod = e.ctrlKey || e.metaKey;
			if (mod && (e.key === "z" || e.key === "Z")) {
				e.preventDefault();
				if (e.shiftKey) this.redo();
				else this.undo();
				return;
			}
			if (mod && (e.key === "y" || e.key === "Y")) {
				e.preventDefault();
				this.redo();
				return;
			}
			// Cmd/Ctrl+C でクリップボードへコピー。
			// テキスト編集中は冒頭で return 済み。クロップ操作中は無効（範囲確定を優先）。
			if (mod && (e.key === "c" || e.key === "C")) {
				if (this.currentTool === "crop") return;
				e.preventDefault();
				void this.copyToClipboard();
				return;
			}
			// Cmd/Ctrl+D で選択図形を複製する（クロップ操作中は無効）。
			if (mod && (e.key === "d" || e.key === "D")) {
				if (this.currentTool === "crop") return;
				e.preventDefault();
				this.duplicateSelection();
				return;
			}
			// Cmd/Ctrl+G でグループ化、Shift 併用でグループ解除（クロップ操作中は無効）。
			if (mod && (e.key === "g" || e.key === "G")) {
				if (this.currentTool === "crop") return;
				e.preventDefault();
				if (e.shiftKey) this.ungroupSelection();
				else this.groupSelection();
				return;
			}
			if (mod) return; // 他の修飾キー付きは無視

			// クロップ操作中は Enter で適用 / Esc でキャンセル（他ショートカットより優先）。
			if (this.currentTool === "crop") {
				if (e.key === "Enter") {
					e.preventDefault();
					this.crop.apply();
					return;
				}
				if (e.key === "Escape") {
					e.preventDefault();
					this.crop.cancel();
					return;
				}
			}

			switch (e.key) {
				case "v":
				case "V":
					this.setTool("select");
					break;
				case "a":
				case "A":
					this.setTool("arrow");
					break;
				case "l":
				case "L":
					this.setTool("line");
					break;
				case "r":
				case "R":
					this.setTool("rect");
					break;
				case "e":
				case "E":
					this.setTool("ellipse");
					break;
				case "t":
				case "T":
					this.setTool("text");
					break;
				case "p":
				case "P":
					this.setTool("pen");
					break;
				case "m":
				case "M":
					this.setTool("marker");
					break;
				case "s":
				case "S":
					this.setTool("step");
					break;
				case "b":
				case "B":
					this.setTool("callout");
					break;
				case "x":
				case "X":
					this.setTool("mosaic");
					break;
				case "u":
				case "U":
					this.setTool("blur");
					break;
				case "d":
				case "D":
					this.setTool("erase");
					break;
				case "o":
				case "O":
					this.setTool("spotlight");
					break;
				case "c":
				case "C":
					this.setTool("crop");
					break;
				case "0":
					this.fitView();
					break;
				// z 順変更。US 配列では Shift+] が "}"、Shift+[ が "{" になるため両方受ける。
				case "]":
					e.preventDefault();
					this.reorderSelection(moveShapeForward);
					break;
				case "}":
					e.preventDefault();
					this.reorderSelection(moveShapeToFront);
					break;
				case "[":
					e.preventDefault();
					this.reorderSelection(moveShapeBackward);
					break;
				case "{":
					e.preventDefault();
					this.reorderSelection(moveShapeToBack);
					break;
				// 矢印キーで微移動（1px、Shift 併用で 10px）。
				case "ArrowUp":
					e.preventDefault();
					this.nudgeSelection(0, e.shiftKey ? -10 : -1);
					break;
				case "ArrowDown":
					e.preventDefault();
					this.nudgeSelection(0, e.shiftKey ? 10 : 1);
					break;
				case "ArrowLeft":
					e.preventDefault();
					this.nudgeSelection(e.shiftKey ? -10 : -1, 0);
					break;
				case "ArrowRight":
					e.preventDefault();
					this.nudgeSelection(e.shiftKey ? 10 : 1, 0);
					break;
				case "Escape":
					this.handleEscape();
					break;
				case "Delete":
				case "Backspace":
					this.handleDelete();
					break;
			}
		});
	}

	/** Esc: 選択解除 → ツールを選択に戻す。 */
	private handleEscape(): void {
		if (this.selectedIds.length > 0) {
			this.select(null);
		} else if (this.currentTool !== "select") {
			this.setTool("select");
		}
	}

	/** Delete/Backspace: 選択図形を（複数選択なら一括で）削除する。 */
	private handleDelete(): void {
		const ids = this.selectedIds;
		if (ids.length === 0) return;
		this.select(null);
		let next = this.history.present;
		for (const id of ids) next = removeShape(next, id);
		this.commitDoc(next);
	}

	/**
	 * Cmd/Ctrl+D: 選択図形を +16/+16 のオフセットで複製し、複製側を選択状態にする。
	 * 複数選択時は全図形を一括複製して複製群を選択に切り替える（1 回だけ commit）。
	 * step バッジは次の連番を自動採番、テキスト・フキダシは文言ごと複製する
	 * （duplicateShape に集約。baseShapes を伸ばしながら渡し番号の重複を避ける）。
	 * グループ所属の図形は remapDuplicatedGroups で「複製側だけの新しいグループ」へ
	 * 振り直す（複製同士が元グループと混ざらない。setSelection の拡張で複製群が
	 * まとまって選ばれる）。
	 */
	private duplicateSelection(): void {
		this.flushNudge(); // 進行中の nudge があれば先に確定してから複製する
		const ids = this.selectedIds;
		if (ids.length === 0) return;
		let next = this.history.present;
		// まず複製図形（新 id・位置ずらし・step 採番）を作る。step の連番は
		// baseShapes を伸ばしながら渡すため、いったん next へ順次追加していく。
		const copies: Shape[] = [];
		for (const id of ids) {
			const shape = findShape(next, id);
			if (!shape) continue;
			const copy = duplicateShape(shape, this.newId(), next.shapes);
			next = addShape(next, copy);
			copies.push(copy);
		}
		if (copies.length === 0) return;
		// 複製群のグループ所属を新グループへ振り直し、doc 内の該当図形へ焼き込む。
		const remapped = remapDuplicatedGroups(copies, () => this.newGroupId());
		for (const shape of remapped) next = replaceShape(next, shape.id, shape);
		this.commitDoc(next);
		this.setSelection(remapped.map((s) => s.id));
	}

	/**
	 * Cmd/Ctrl+G: 複数選択中の図形に新しい groupId を付与してグループ化する。
	 * 2 つ以上選択しているときだけ意味を持つ（assignGroup が 1 つ以下なら no-op）。
	 * 以降はこのグループのどれかを選ぶと全体が選ばれる（setSelection の拡張）。
	 */
	private groupSelection(): void {
		this.flushNudge();
		const ids = this.selectedIds;
		if (ids.length < 2) return;
		const next = assignGroup(this.history.present, ids, this.newGroupId());
		if (next === this.history.present) return;
		this.commitDoc(next);
	}

	/**
	 * Shift+Cmd/Ctrl+G: 選択中の図形のグループを解除する（groupId を除去）。
	 * 選択がグループ全体に拡張されている前提なので、選択中 id からまとめて外せば
	 * そのグループは解散する。非所属だけなら no-op。
	 */
	private ungroupSelection(): void {
		this.flushNudge();
		const ids = this.selectedIds;
		if (ids.length === 0) return;
		const next = ungroup(this.history.present, ids);
		if (next === this.history.present) return;
		this.commitDoc(next);
	}

	/** グループ用の一意な id を生成する（図形 id と衝突しないよう接頭辞を分ける）。 */
	private newGroupId(): string {
		this.idCounter += 1;
		return `g${Date.now().toString(36)}-${this.idCounter}`;
	}

	/**
	 * z 順変更（前面/背面/最前面/最背面）を選択図形へ適用する。
	 * 複数選択時も各図形へ順に適用する（同一操作を全 id に流す）。
	 */
	private reorderSelection(
		op: (doc: EditorDoc, id: string) => EditorDoc,
	): void {
		this.flushNudge();
		const ids = this.selectedIds;
		if (ids.length === 0) return;
		let next = this.history.present;
		for (const id of ids) next = op(next, id);
		this.commitDoc(next);
	}

	/**
	 * 進行中の nudge バーストがあれば履歴へ 1 回だけ確定する。
	 * 別操作（複製・z 順・undo 等）へ移る前や、デバウンス満了時に呼ぶ。
	 */
	private flushNudge(): void {
		if (this.nudgeTimer !== null) {
			clearTimeout(this.nudgeTimer);
			this.nudgeTimer = null;
		}
		if (!this.nudgeBaseDoc) return;
		const base = this.nudgeBaseDoc;
		const moved = this.history.present;
		this.nudgeBaseDoc = null;
		// present は既に移動後を映しているので、いったんバースト開始前へ戻してから
		// 移動後を commit することで、履歴には「まとめて 1 回の移動」だけが積まれる。
		this.history.present = base;
		this.commitDoc(moved);
	}

	/**
	 * 矢印キーによる微移動。見た目は即時に動かし、履歴の確定だけ約 500ms
	 * デバウンスして連続 nudge を 1 commit にまとめる（連打で履歴を埋めない）。
	 * テキスト編集中（textEditing）は bindKeyboard 冒頭で弾かれるためここには来ない。
	 */
	private nudgeSelection(dx: number, dy: number): void {
		const ids = this.selectedIds;
		if (ids.length === 0) return;
		// バースト開始時に「確定前の状態」を退避しておく。
		if (!this.nudgeBaseDoc) this.nudgeBaseDoc = this.history.present;
		// present を直接差し替えて即時に再描画・自動保存する（履歴は積まない）。
		// 複数選択時は全図形を同じ量だけ動かす。
		let next = this.history.present;
		for (const id of ids) {
			const shape = findShape(next, id);
			if (!shape) continue;
			next = replaceShape(next, id, translateShape(shape, dx, dy));
		}
		if (next === this.history.present) return;
		this.history.present = next;
		this.render();
		this.onDocCommitted?.(next);
		// デバウンス: 一定時間追加の nudge が無ければ 1 回だけ履歴へ commit する。
		if (this.nudgeTimer !== null) clearTimeout(this.nudgeTimer);
		this.nudgeTimer = window.setTimeout(
			() => this.flushNudge(),
			NUDGE_COMMIT_MS,
		);
	}

	// --- 出力 ---

	/** 現在の doc からキャプチャ原寸の PNG canvas を組み立てる（表示ズーム非依存）。 */
	private exportCanvas(): HTMLCanvasElement {
		return exportToCanvas({
			doc: this.history.present,
			image: this.baseImage,
			imageSize: this.contentSize,
		});
	}

	/**
	 * クロップ適用後の原寸画像を、選択中の形式（PNG / JPEG / WebP）・品質でダウンロードする。
	 * JPEG は白背景合成される（canvasToBlob 内・透過安全策）。ファイル名の拡張子も形式に追従する。
	 */
	save(): void {
		const format = this.style.exportFormat;
		const canvas = this.exportCanvas();
		canvasToBlob(canvas, format, this.style.exportQuality)
			.then((blob) => {
				downloadBlob(blob, exportFilename(new Date(), format));
				this.toast.show("保存しました");
			})
			.catch(() => this.toast.show("保存に失敗しました", "error"));
	}

	/**
	 * クロップ適用後の原寸 PNG をクリップボードへコピーする。
	 * ユーザージェスチャ判定を切らさないよう、ClipboardItem には Blob の Promise を
	 * そのまま渡す（await してから作らない）。拡張タブのクリック起点なので追加権限は不要。
	 */
	async copyToClipboard(): Promise<void> {
		try {
			const canvas = this.exportCanvas();
			const item = new ClipboardItem({ "image/png": canvasToPngBlob(canvas) });
			await navigator.clipboard.write([item]);
			this.toast.show("コピーしました");
		} catch {
			this.toast.show("コピーに失敗しました", "error");
		}
	}

	private bindResize(container: HTMLDivElement): void {
		const ro = new ResizeObserver(() => {
			this.stage.width(container.clientWidth);
			this.stage.height(container.clientHeight);
			// まだユーザーがズーム/パンしていなければ全体フィットに追従する。
			// 初期化直後はレイアウト未確定で clientWidth が 0 のことがあり、
			// ここで確定後のサイズを使って正しくフィットさせる。
			if (this.autoFit) {
				this.fitView();
			} else {
				this.stage.batchDraw();
			}
		});
		ro.observe(container);
	}

	private syncToolbar(): void {
		this.toolbar.setTool(this.currentTool);
		this.toolbar.setColor(this.style.stroke);
		this.syncDashControls();
		this.syncArrowStyleControls();
		this.syncFontSizeControls();
		this.syncFillControls();
		this.syncIntensityControls();
		this.syncSpotlightDimControls();
		this.syncCalloutTailControls();
		this.syncStepNumberControls();
		this.syncCropRatioControls();
		// アンカー先ボタンはセクション表示を確定させた後に渡す（表示位置を最終決定する）。
		this.syncStyleAnchor();
		// 出力形式・品質は選択に依らず現在の style を反映する（ツールバー右端の形式ボタン）。
		this.toolbar.setExportFormat(this.style.exportFormat);
		this.toolbar.setExportQuality(this.style.exportQuality);
		this.toolbar.setUndoRedo(canUndo(this.history), canRedo(this.history));
		this.updateCursor();
	}

	/** 現在のツールと単一選択図形の型を求める（フライアウトの表示判定・アンカー決定に使う）。 */
	private selectedShapeType(): Shape["type"] | null {
		const selected = this.selectedId
			? findShape(this.history.present, this.selectedId)
			: undefined;
		return selected?.type ?? null;
	}

	/** 現在のツールと単一選択図形から、フライアウトに出すセクションを求める。 */
	private currentStyleSections(): StyleSections {
		return styleSectionsFor(this.currentTool, this.selectedShapeType());
	}

	/**
	 * フライアウトを真下に出すツールボタンを決めてツールバーへ渡す。
	 * 線系図形を選択中はその図形のツール、そうでなく線系ツール中はそのツール、
	 * どちらでもなければ null（非表示）。判定は純粋関数 styleAnchorToolFor に集約。
	 */
	private syncStyleAnchor(): void {
		this.toolbar.setStyleAnchor(
			styleAnchorToolFor(this.currentTool, this.selectedShapeType()),
		);
	}

	/**
	 * 矢印スタイル（片側 / 両側 / 曲線）コントロールの表示と現在値を同期する。
	 * 矢印を選択中はそのシェイプのスタイルを、そうでなく矢印ツール選択中は新規デフォルト
	 * （style）のスタイルを表示する。どちらでもなければ隠す（矢印以外では出さない）。
	 * 表示可否の判定は純粋関数 styleSectionsFor に集約している。
	 */
	private syncArrowStyleControls(): void {
		const visible = this.currentStyleSections().arrow;
		this.toolbar.setArrowStyleControlsVisible(visible);
		if (!visible) return;
		const selected = this.selectedId
			? findShape(this.history.present, this.selectedId)
			: undefined;
		const selectedArrow = selected?.type === "arrow" ? selected : undefined;
		const style = selectedArrow
			? normalizeArrowStyle(selectedArrow.arrowStyle)
			: this.style.arrowStyle;
		this.toolbar.setArrowStyle(style);
	}

	/**
	 * 線種（実線/破線）コントロールの表示と現在値を同期する。
	 * 線系図形（矢印・矩形・楕円・ペン）を選択中はそのシェイプの線種を、
	 * そうでなく線系ツールを選択中は新規デフォルト（style）の線種を表示する。
	 * どちらでもなければ隠す（線種を持たない図形・ツールでは出さない）。
	 * 表示可否の判定は純粋関数 styleSectionsFor に集約している。
	 */
	private syncDashControls(): void {
		const visible = this.currentStyleSections().dash;
		this.toolbar.setDashControlsVisible(visible);
		if (!visible) return;
		const selected = this.selectedId
			? findShape(this.history.present, this.selectedId)
			: undefined;
		const selectedLine =
			selected && shapeSupportsDash(selected.type) ? selected : undefined;
		const dash = selectedLine?.dash ?? this.style.dash;
		this.toolbar.setDash(dash);
	}

	/**
	 * サイズ（S/M/L）コントロールの表示と現在値を同期する。
	 * テキスト/フキダシを選択中はそのシェイプの fontSize を、そうでなくテキストツール
	 * 選択中は新規デフォルト（style.fontSize）を表示する。現在値がプリセット外（ハンドル
	 * ドラッグで変えた連続値）ならどのボタンも active にしない（toolbar 側で判定）。
	 */
	private syncFontSizeControls(): void {
		const visible = this.currentStyleSections().fontSize;
		this.toolbar.setFontSizeControlsVisible(visible);
		if (!visible) return;
		const selected = this.selectedId
			? findShape(this.history.present, this.selectedId)
			: undefined;
		const selectedText =
			selected?.type === "text" || selected?.type === "callout"
				? selected
				: undefined;
		const size = selectedText ? selectedText.fontSize : this.style.fontSize;
		this.toolbar.setFontSize(size);
	}

	/**
	 * 塗り（なし/半透明）コントロールの表示と現在値を同期する。
	 * 矩形・楕円を選択中はそのシェイプの塗り（未設定は塗りなし）を、そうでなく
	 * 矩形・楕円ツール選択中は新規デフォルト（style.fill）を表示する。
	 */
	private syncFillControls(): void {
		const visible = this.currentStyleSections().fill;
		this.toolbar.setFillControlsVisible(visible);
		if (!visible) return;
		const selected = this.selectedId
			? findShape(this.history.present, this.selectedId)
			: undefined;
		const selectedFillable =
			selected?.type === "rect" || selected?.type === "ellipse"
				? selected
				: undefined;
		const fill = selectedFillable?.fill ?? this.style.fill;
		this.toolbar.setFill(fill);
	}

	/**
	 * 強度（弱/標準/強）コントロールの表示と現在値を同期する。
	 * モザイク・ぼかしを選択中はそのシェイプの強度（未設定は "normal"）を、そうでなく
	 * モザイク・ぼかしツール選択中は新規デフォルト（style.intensity）を表示する。
	 */
	private syncIntensityControls(): void {
		const visible = this.currentStyleSections().intensity;
		this.toolbar.setIntensityControlsVisible(visible);
		if (!visible) return;
		const selected = this.selectedId
			? findShape(this.history.present, this.selectedId)
			: undefined;
		const selectedProc =
			selected?.type === "mosaic" || selected?.type === "blur"
				? selected
				: undefined;
		const intensity = selectedProc?.intensity ?? this.style.intensity;
		this.toolbar.setIntensity(intensity);
	}

	/**
	 * 暗さ（薄め/標準/濃いめ）コントロールの表示と現在値を同期する。
	 * 暗さは doc レベルの単一値なので、選択の有無に依らず doc.spotlightAlpha（未設定は
	 * 標準 0.7）を表示する。spotlight ツール中・spotlight 図形選択中のどちらでも同じ
	 * doc の値を出す（プリセット外の値ならどのボタンも active にしない）。
	 */
	private syncSpotlightDimControls(): void {
		const visible = this.currentStyleSections().dim;
		this.toolbar.setSpotlightDimControlsVisible(visible);
		if (!visible) return;
		this.toolbar.setSpotlightDim(
			resolveSpotlightAlpha(this.history.present.spotlightAlpha),
		);
	}

	/**
	 * しっぽ（下/上/左/右）コントロールの表示と現在値を同期する。
	 * フキダシを選択中はそのシェイプのしっぽ集合（未設定は ["down"]）を、そうでなく
	 * フキダシツール選択中は新規デフォルト（style.calloutTails）を表示する。各ボタンは
	 * 独立トグル（空集合＝しっぽなしのときは全 OFF）。
	 */
	private syncCalloutTailControls(): void {
		const visible = this.currentStyleSections().calloutTail;
		this.toolbar.setCalloutTailControlsVisible(visible);
		if (!visible) return;
		const selected = this.selectedId
			? findShape(this.history.present, this.selectedId)
			: undefined;
		const tails =
			selected?.type === "callout"
				? normalizeCalloutTails(selected.tails, selected.tail)
				: this.style.calloutTails;
		this.toolbar.setCalloutTails(tails);
	}

	/**
	 * 番号（次を1に戻す）コントロールの表示を同期する。ステップツール選択中のみ出す
	 * アクションボタンで、選択状態は持たないので表示可否だけを切り替える。
	 */
	private syncStepNumberControls(): void {
		this.toolbar.setStepNumberControlsVisible(
			this.currentStyleSections().stepNumber,
		);
	}

	/**
	 * 比率（自由/1:1/4:3/16:9）コントロールの表示と現在値を同期する。
	 * クロップツール選択中のみ出し、現在の style.cropRatio を表示する
	 * （クロップは図形選択アンカーを持たない＝ツール中だけの設定）。
	 */
	private syncCropRatioControls(): void {
		const visible = this.currentStyleSections().cropRatio;
		this.toolbar.setCropRatioControlsVisible(visible);
		if (!visible) return;
		this.toolbar.setCropRatio(this.style.cropRatio);
	}

	getContentSize(): { width: number; height: number } {
		return this.contentSize;
	}

	getShapeById(id: string): Shape | undefined {
		return findShape(this.history.present, id);
	}

	/**
	 * Konva ノード（イベントの target）から、対応する doc の図形を求める。
	 * フキダシは Group で、内側の Rect/Text が target になり得るが id を持たない。
	 * そこで自身から祖先へ辿り、id が doc の図形に一致する最初のノードの図形を返す。
	 * 見つからなければ undefined。
	 */
	private shapeForNode(node: Konva.Node | undefined): Shape | undefined {
		let cur: Konva.Node | null | undefined = node;
		while (cur) {
			const id = cur.id?.();
			if (id) {
				const shape = findShape(this.history.present, id);
				if (shape) return shape;
			}
			cur = cur.getParent();
		}
		return undefined;
	}
}
