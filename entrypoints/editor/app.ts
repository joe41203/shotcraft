import Konva from "konva";
import type { CaptureRecord } from "@/lib/capture-store";
import { croppedSize } from "@/lib/editor/crop";
import { shapeSupportsDash } from "@/lib/editor/dash";
import {
	type CropRect,
	type EditorDoc,
	emptyDoc,
	findShape,
	removeShape,
	replaceShape,
	type Shape,
	updateShape,
} from "@/lib/editor/doc";
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
	createStylePrefsSaver,
	DEFAULT_STYLE_PREFS,
	type StylePrefs,
} from "@/lib/editor/style-prefs";
import { CropController } from "./crop-controller";
import {
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
import type { EditorContext, Tool, ToolName } from "./tools/types";

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
	private selectedId: string | null = null;
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
	};

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
			onUndo: () => this.undo(),
			onRedo: () => this.redo(),
			onSavePng: () => this.savePng(),
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
		if (!canUndo(this.history)) return;
		this.history = undo(this.history);
		this.selectedId = null;
		this.render();
		this.syncToolbar();
		this.onSelectionChanged?.(null);
		this.onDocCommitted?.(this.history.present);
	}

	redo(): void {
		if (!canRedo(this.history)) return;
		this.history = redo(this.history);
		this.selectedId = null;
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
	 * 1 つの図形ノードに、変形/移動の確定コミットと pointerdown 選択を配線する。
	 * select ツールと text ツール（テキストノードのみ）の双方から使う。
	 */
	private attachNodeInteractions(node: Konva.Node): void {
		node.on("dragend.commit transformend.commit", () => {
			const id = node.id();
			const prev = findShape(this.history.present, id);
			if (!prev) return;
			const next = shapeFromNode(node, prev);
			this.commitDoc(replaceShape(this.history.present, id, next));
		});
		node.on("pointerdown.select", (e: Konva.KonvaEventObject<PointerEvent>) => {
			// select ツール、または text ツールでテキストノードを掴んだときに選択する。
			// これにより text ツール中でも既存テキスト上の pointerdown は新規作成でなく
			// 選択（＋そのままドラッグ移動）になる。
			if (this.currentTool !== "select" && this.currentTool !== "text") return;
			e.cancelBubble = true; // 背景の選択解除・新規作成に伝播させない
			this.select(node.id());
		});
	}

	/**
	 * 選択 id のノードに Transformer をアタッチする。未選択なら外す。
	 * select ツールは全図形、text ツールはテキストシェイプ選択時のみ表示する
	 * （text ツール中に既存テキストを選んでハンドルでリサイズできるようにするため）。
	 */
	private syncTransformer(): void {
		const shape = this.selectedId
			? findShape(this.history.present, this.selectedId)
			: undefined;
		const canTransform =
			this.currentTool === "select" ||
			(this.currentTool === "text" && shape?.type === "text");
		if (!shape || !canTransform) {
			this.transformer.nodes([]);
			this.uiLayer.batchDraw();
			return;
		}
		const node = this.shapeLayer.findOne(`#${this.selectedId}`);
		if (node) {
			this.configureTransformerFor(shape.type);
			this.transformer.nodes([node as Konva.Node]);
			this.transformer.moveToTop();
		} else {
			this.transformer.nodes([]);
		}
		this.uiLayer.batchDraw();
	}

	/**
	 * 選択図形の type に応じて Transformer のアンカー・回転・比率固定を切り替える。
	 * Transformer は全図形で共有するため、type ごとに毎回明示的に設定し直す。
	 * - text: 四隅アンカーのみ・縦横比固定・回転無効。四隅ドラッグの比例スケールを
	 *   fontSize へ焼き込む運用のため、辺アンカー（片軸だけ伸ばす）を出さない。
	 * - step: アンカー・回転とも無効（固定サイズの丸バッジ）。選択枠だけ出して
	 *   ドラッグ移動のみを許す。
	 * - mosaic / blur / spotlight: 全アンカーだが回転無効（加工の再計算・暗幕の穴を
	 *   矩形に限定する）。
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
		// モザイク・ぼかし・スポットライトは回転不可。他は回転可。
		const noRotate =
			type === "mosaic" || type === "blur" || type === "spotlight";
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

	setColor(color: string): void {
		this.style.stroke = color;
		this.toolbar.setColor(color);
		this.persistStylePrefs();
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
	 * 現在の新規図形用スタイル（色・線種・フォントサイズ）を storage.local に保存する。
	 * セーバ側で直前の保存値と同値なら書き込みをスキップするので、色や線種を
	 * 切り替えたときだけ実際の書き込みが走る。線の太さは固定なので保存しない。
	 */
	private persistStylePrefs(): void {
		this.stylePrefsSaver.save({
			stroke: this.style.stroke,
			dash: this.style.dash,
			fontSize: this.style.fontSize,
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

	select(id: string | null): void {
		if (id === this.selectedId) return;
		this.selectedId = id;
		this.syncTransformer();
		// 線系図形の選択有無で線種コントロールの表示と値が変わる。
		this.syncDashControls();
		this.onSelectionChanged?.(id);
	}

	getSelectedId(): string | null {
		return this.selectedId;
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
				// ここに来て target が図形でない＝背景クリックなら選択解除する。
				const targetId = e.target?.id();
				const hitShape = targetId
					? findShape(this.history.present, targetId)
					: undefined;
				if (!hitShape) this.select(null);
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
			this.tools.get(this.currentTool)?.onPointerDown?.(pos);
		});
		this.stage.on("pointermove", () => {
			const pos = this.docPointer();
			if (!pos) return;
			this.tools.get(this.currentTool)?.onPointerMove?.(pos);
		});
		this.stage.on("pointerup", () => {
			const pos = this.docPointer();
			if (!pos) return;
			this.tools.get(this.currentTool)?.onPointerUp?.(pos);
		});
		this.stage.on("dblclick dbltap", (e) => {
			const id = e.target?.id();
			if (!id) return;
			const shape = findShape(this.history.present, id);
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
		if (this.selectedId) {
			this.select(null);
		} else if (this.currentTool !== "select") {
			this.setTool("select");
		}
	}

	/** Delete/Backspace: 選択図形を削除する。 */
	private handleDelete(): void {
		const id = this.selectedId;
		if (!id) return;
		this.select(null);
		this.commitDoc(removeShape(this.history.present, id));
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

	/** クロップ適用後の原寸 PNG をダウンロードする。 */
	savePng(): void {
		const canvas = this.exportCanvas();
		canvasToPngBlob(canvas)
			.then((blob) => {
				downloadBlob(blob, exportFilename());
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
		this.toolbar.setUndoRedo(canUndo(this.history), canRedo(this.history));
		this.updateCursor();
	}

	/**
	 * 線種（実線/破線）コントロールの表示と現在値を同期する。
	 * 線系図形（矢印・矩形・楕円・ペン）を選択中はそのシェイプの線種を、
	 * そうでなく線系ツールを選択中は新規デフォルト（style）の線種を表示する。
	 * どちらでもなければ隠す（線種を持たない図形・ツールでは出さない）。
	 */
	private syncDashControls(): void {
		const selected = this.selectedId
			? findShape(this.history.present, this.selectedId)
			: undefined;
		const selectedLine =
			selected && shapeSupportsDash(selected.type) ? selected : undefined;
		const toolIsLine =
			this.currentTool === "arrow" ||
			this.currentTool === "rect" ||
			this.currentTool === "ellipse" ||
			this.currentTool === "pen";
		const visible = selectedLine != null || toolIsLine;
		this.toolbar.setDashControlsVisible(visible);
		if (!visible) return;
		const dash = selectedLine?.dash ?? this.style.dash;
		this.toolbar.setDash(dash);
	}

	getContentSize(): { width: number; height: number } {
		return this.contentSize;
	}

	getShapeById(id: string): Shape | undefined {
		return findShape(this.history.present, id);
	}
}
