import type Konva from "konva";
import { addShape, type MarkerShape, type PenShape } from "@/lib/editor/doc";
import type { Point } from "../geometry-view";
import { shapeToNode } from "../render";
import type { EditorContext, Tool, ToolName } from "./types";

/** 前回点からこの距離未満なら点を追加しない（点列の間引き）。 */
const MIN_POINT_DISTANCE = 2;
/** これ未満の総点数（＝ほぼ動いていない）は図形を作らず破棄する。 */
const MIN_POINTS = 2;

/**
 * フリーハンドの線を描く共通ツール。ペン・マーカーで共有する。
 * 描画の見た目（マーカーの太さ・半透明）は render.ts が type に応じて付けるので、
 * doc に保存するのは素の stroke/strokeWidth と opacity: 1 のプレーンな線列。
 */
export abstract class StrokeTool implements Tool {
	abstract readonly name: ToolName;
	protected abstract readonly shapeType: "pen" | "marker";

	private points: number[] = [];
	private last: Point | null = null;
	private preview: Konva.Shape | null = null;

	constructor(protected ctx: EditorContext) {}

	onPointerDown(pos: Point): void {
		this.points = [pos.x, pos.y];
		this.last = pos;
		// pen/marker は必ず Konva.Shape（Group にならない type）を返す。
		this.preview = shapeToNode(this.makeShape()) as Konva.Shape;
		this.ctx.previewLayer.add(this.preview);
		this.ctx.previewLayer.batchDraw();
	}

	onPointerMove(pos: Point): void {
		if (!this.last || !this.preview) return;
		if (
			Math.hypot(pos.x - this.last.x, pos.y - this.last.y) < MIN_POINT_DISTANCE
		) {
			return;
		}
		this.points.push(pos.x, pos.y);
		this.last = pos;
		(this.preview as Konva.Line).points(this.points);
		this.ctx.previewLayer.batchDraw();
	}

	onPointerUp(): void {
		if (!this.last) return;
		const enough = this.points.length >= MIN_POINTS * 2;
		this.clearPreview();
		this.last = null;
		if (enough) {
			this.ctx.commitDoc(addShape(this.ctx.getDoc(), this.makeShape()));
		}
		this.points = [];
	}

	deactivate(): void {
		this.clearPreview();
		this.last = null;
		this.points = [];
	}

	private clearPreview(): void {
		if (this.preview) {
			this.preview.destroy();
			this.preview = null;
			this.ctx.previewLayer.batchDraw();
		}
	}

	private makeShape(): PenShape | MarkerShape {
		return {
			id: this.ctx.newId(),
			type: this.shapeType,
			points: [...this.points],
			stroke: this.ctx.style.stroke,
			strokeWidth: this.ctx.style.strokeWidth,
			// 破線はペンのみ。マーカー（太い半透明のハイライト）は常に実線にする。
			dash: this.shapeType === "pen" ? this.ctx.style.dash : false,
			rotation: 0,
			opacity: 1,
		};
	}
}

/** フリーハンドのペン。 */
export class PenTool extends StrokeTool {
	readonly name: ToolName = "pen";
	protected readonly shapeType = "pen" as const;
}

/** 蛍光マーカー。太く半透明の描画は render.ts が付ける。 */
export class MarkerTool extends StrokeTool {
	readonly name: ToolName = "marker";
	protected readonly shapeType = "marker" as const;
}
