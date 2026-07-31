import Konva from "konva";
import type { CaptureRecord } from "@/lib/capture-store";
import { croppedSize } from "@/lib/editor/crop";
import {
	type CropRect,
	type EditorDoc,
	emptyDoc,
	findShape,
	removeShape,
	replaceShape,
	setCrop,
	type Shape,
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
import { CropController } from "./crop-controller";
import {
	fitTransform,
	type Point,
	type ViewTransform,
	zoomAtTransform,
} from "./geometry-view";
import { renderShapes, shapeFromNode } from "./render";
import { Toolbar } from "./toolbar";
import type { EditorContext, Tool, ToolName } from "./tools/types";

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

	private history: History<EditorDoc>;
	private currentTool: ToolName = "select";
	private tools = new Map<ToolName, Tool>();
	private selectedId: string | null = null;
	style = { stroke: "#ef4444", strokeWidth: 4 };

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
	) {
		this.contentSize = { width: record.width, height: record.height };
		this.baseImage = imageEl;
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

		this.toolbar = new Toolbar(toolbarRoot, {
			onToolChange: (t) => this.setTool(t),
			onColorChange: (c) => this.setColor(c),
			onStrokeWidthChange: (w) => this.setStrokeWidth(w),
			onUndo: () => this.undo(),
			onRedo: () => this.redo(),
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
		// select ツールのときだけドラッグ可能にする。
		const selectable = this.currentTool === "select";
		renderShapes(
			this.shapeLayer,
			this.history.present,
			selectable,
			this.baseImage,
		);
		if (selectable) this.bindNodeEvents();
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
	 * 各図形ノードに移動・変形の確定ハンドラを付ける。
	 * ドラッグ/変形の終了時にノードの状態を Shape へ焼き込んで commit する。
	 */
	private bindNodeEvents(): void {
		for (const child of this.shapeLayer.getChildren()) {
			const node: Konva.Node = child;
			node.on("dragend.commit transformend.commit", () => {
				const id = node.id();
				const prev = findShape(this.history.present, id);
				if (!prev) return;
				const next = shapeFromNode(node, prev);
				this.commitDoc(replaceShape(this.history.present, id, next));
			});
			// クリックで選択（select ツール時）。
			node.on(
				"pointerdown.select",
				(e: Konva.KonvaEventObject<PointerEvent>) => {
					if (this.currentTool !== "select") return;
					e.cancelBubble = true; // 背景の選択解除に伝播させない
					this.select(node.id());
				},
			);
		}
	}

	/** 選択 id のノードに Transformer をアタッチする。未選択なら外す。 */
	private syncTransformer(): void {
		if (this.currentTool !== "select" || !this.selectedId) {
			this.transformer.nodes([]);
			this.uiLayer.batchDraw();
			return;
		}
		const node = this.shapeLayer.findOne(`#${this.selectedId}`);
		if (node) {
			// モザイクは回転を無効にする（ピクセル化の再計算を矩形に限定するため）。
			const shape = findShape(this.history.present, this.selectedId);
			this.transformer.rotateEnabled(shape?.type !== "mosaic");
			this.transformer.nodes([node as Konva.Node]);
			this.transformer.moveToTop();
		} else {
			this.transformer.nodes([]);
		}
		this.uiLayer.batchDraw();
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
	}

	setStrokeWidth(width: number): void {
		this.style.strokeWidth = width;
		this.toolbar.setStrokeWidth(width);
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
			// テキストの再編集はどのツール中でも効くようにする。
			if (shape.type === "text") {
				this.setTool("text");
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
				case "x":
				case "X":
					this.setTool("mosaic");
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
		this.toolbar.setStrokeWidth(this.style.strokeWidth);
		this.toolbar.setUndoRedo(canUndo(this.history), canRedo(this.history));
		this.updateCursor();
	}

	getContentSize(): { width: number; height: number } {
		return this.contentSize;
	}

	getShapeById(id: string): Shape | undefined {
		return findShape(this.history.present, id);
	}
}
