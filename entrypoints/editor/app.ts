import Konva from "konva";
import type { CaptureRecord } from "@/lib/capture-store";
import {
	type EditorDoc,
	emptyDoc,
	findShape,
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
import {
	fitTransform,
	type Point,
	type ViewTransform,
	zoomAtTransform,
} from "./geometry-view";
import { renderShapes } from "./render";
import { Toolbar } from "./toolbar";
import type { EditorContext, Tool, ToolName } from "./tools/types";

/** キャプチャ画像とドキュメントを載せる Konva エディタ本体。 */
export class EditorApp {
	readonly stage: Konva.Stage;
	private bgLayer: Konva.Layer;
	private shapeLayer: Konva.Layer;
	readonly previewLayer: Konva.Layer;
	private image: Konva.Image;
	private contentSize: { width: number; height: number };

	private history: History<EditorDoc>;
	private currentTool: ToolName = "select";
	private tools = new Map<ToolName, Tool>();
	private selectedId: string | null = null;
	style = { stroke: "#ef4444", strokeWidth: 4 };

	private toolbar: Toolbar;
	private idCounter = 0;

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
		this.history = initHistory(initialDoc ?? emptyDoc());

		this.stage = new Konva.Stage({
			container,
			width: container.clientWidth,
			height: container.clientHeight,
		});

		this.bgLayer = new Konva.Layer({ listening: false });
		this.shapeLayer = new Konva.Layer();
		this.previewLayer = new Konva.Layer({ listening: false });

		this.image = new Konva.Image({
			image: imageEl,
			x: 0,
			y: 0,
			width: record.width,
			height: record.height,
		});
		this.bgLayer.add(this.image);
		this.stage.add(this.bgLayer, this.shapeLayer, this.previewLayer);

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
			commitDoc: (next) => this.commitDoc(next),
			getDoc: () => this.history.present,
			select: (id) => this.select(id),
		};
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
		renderShapes(
			this.shapeLayer,
			this.history.present,
			this.currentTool === "select",
		);
		this.applyViewTransform(this.readTransform());
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

	/** 画像全体をコンテナに収めて中央寄せする。 */
	fitView(): void {
		const t = fitTransform(
			{ width: this.stage.width(), height: this.stage.height() },
			this.contentSize,
		);
		this.applyViewTransform(t);
	}

	private zoomAt(pivot: Point, nextScale: number): void {
		this.applyViewTransform(
			zoomAtTransform(this.readTransform(), pivot, nextScale),
		);
	}

	// --- ツール・スタイル ---

	setTool(tool: ToolName): void {
		if (tool === this.currentTool) return;
		this.tools.get(this.currentTool)?.deactivate?.();
		this.currentTool = tool;
		if (tool !== "select") this.select(null);
		this.tools.get(tool)?.activate?.();
		// draggable の切り替えのため再描画。
		this.render();
		this.syncToolbar();
		this.updateCursor();
	}

	getTool(): ToolName {
		return this.currentTool;
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
		container.style.cursor =
			this.currentTool === "select" ? "default" : "crosshair";
	}

	// --- 選択 ---

	select(id: string | null): void {
		if (id === this.selectedId) return;
		this.selectedId = id;
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
				this.stage.position({
					x: this.stage.x() - e.evt.deltaX,
					y: this.stage.y() - e.evt.deltaY,
				});
				this.stage.batchDraw();
			}
		});

		this.stage.on("pointerdown", () => {
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
			if (shape) this.tools.get(this.currentTool)?.onDblClick?.(shape);
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
		const doc = this.history.present;
		const next = { shapes: doc.shapes.filter((s) => s.id !== id) };
		this.select(null);
		this.commitDoc(next);
	}

	private bindResize(container: HTMLDivElement): void {
		const ro = new ResizeObserver(() => {
			this.stage.width(container.clientWidth);
			this.stage.height(container.clientHeight);
			this.stage.batchDraw();
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
