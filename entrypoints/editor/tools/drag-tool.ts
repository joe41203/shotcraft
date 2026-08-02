import type Konva from "konva";
import type { Shape } from "@/lib/editor/doc";
import { addShape } from "@/lib/editor/doc";
import type { Point } from "../geometry-view";
import type { EditorContext, PointerModifiers, Tool, ToolName } from "./types";

/** 修飾キーを見ないツール向けの既定（無し扱い）。 */
const NO_MODS: PointerModifiers = { shift: false, alt: false };

/** ドラッグの始点・終点で 1 つの図形を作るツールの共通基底。 */
export abstract class DragTool implements Tool {
	abstract readonly name: ToolName;
	/** これ未満のドラッグ距離は図形を作らず破棄する（クリックのみの誤生成防止）。 */
	protected readonly minDrag: number = 4;

	private start: Point | null = null;
	private preview: Konva.Shape | null = null;

	constructor(protected ctx: EditorContext) {}

	/** 始点・終点からプレビュー用の Konva ノードを作る（previewLayer に載る）。 */
	protected abstract createPreview(start: Point, end: Point): Konva.Shape;
	/** 既存プレビューを始点・終点で更新する。 */
	protected abstract updatePreview(
		node: Konva.Shape,
		start: Point,
		end: Point,
	): void;
	/** 始点・終点から確定図形（doc に入る Shape）を作る。小さすぎるなら null。 */
	protected abstract buildShape(start: Point, end: Point): Shape | null;

	/**
	 * Shift 押下時に終点を制約する（既定は素通り）。矢印・直線は角度スナップ、
	 * 矩形・楕円は正方形/正円へ。プレビュー・確定の両方で同じ制約を通すため、
	 * end 座標を差し替える 1 か所に集約する。
	 */
	protected constrainEnd(
		start: Point,
		end: Point,
		mods: PointerModifiers,
	): Point {
		return mods.shift ? this.constrain(start, end) : end;
	}

	/** Shift 押下時の終点変換（サブクラスが上書き）。既定は素通り。 */
	protected constrain(_start: Point, end: Point): Point {
		return end;
	}

	onPointerDown(pos: Point): void {
		this.start = pos;
		this.preview = this.createPreview(pos, pos);
		this.ctx.previewLayer.add(this.preview);
		this.ctx.previewLayer.batchDraw();
	}

	onPointerMove(pos: Point, mods: PointerModifiers = NO_MODS): void {
		if (!this.start || !this.preview) return;
		const end = this.constrainEnd(this.start, pos, mods);
		this.updatePreview(this.preview, this.start, end);
		this.ctx.previewLayer.batchDraw();
	}

	onPointerUp(pos: Point, mods: PointerModifiers = NO_MODS): void {
		if (!this.start) return;
		const start = this.start;
		const end = this.constrainEnd(start, pos, mods);
		this.clearPreview();
		this.start = null;

		if (distance(start, end) < this.minDrag) return;
		const shape = this.buildShape(start, end);
		if (!shape) return;
		this.ctx.commitDoc(addShape(this.ctx.getDoc(), shape));
	}

	deactivate(): void {
		this.clearPreview();
		this.start = null;
	}

	private clearPreview(): void {
		if (this.preview) {
			this.preview.destroy();
			this.preview = null;
			this.ctx.previewLayer.batchDraw();
		}
	}

	protected base() {
		return {
			id: this.ctx.newId(),
			stroke: this.ctx.style.stroke,
			strokeWidth: this.ctx.style.strokeWidth,
			dash: this.ctx.style.dash,
			rotation: 0,
			opacity: 1,
		};
	}
}

function distance(a: Point, b: Point): number {
	return Math.hypot(b.x - a.x, b.y - a.y);
}
